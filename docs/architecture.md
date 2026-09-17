# Architecture — AI API Monitoring & Incident Management Platform (V1)

Status: **Approved for implementation.** This document reflects the
architecture decisions confirmed before any application code was written.

## 1. Overview

Three-tier system with an in-process background scheduler:

```
┌─────────────┐      REST/JSON      ┌──────────────┐        ┌──────────────┐
│ React+Vite  │ ──────────────────► │ Node/Express │ ──────►│ PostgreSQL   │
│  Frontend   │ ◄────────────────── │   API Server │ ◄──────│              │
└─────────────┘                     └──────┬───────┘        └──────┬───────┘
                                            │                        ▲
                                            │ triggers/reads         │
                                            ▼                        │
                                    ┌──────────────┐                 │
                                    │ node-cron    │ ────────────────┘
                                    │ scheduler,   │  writes checks/incidents
                                    │ same process │
                                    └──────┬───────┘
                                            │ HTTP requests
                                            ▼
                                    ┌──────────────┐
                                    │ Monitored    │
                                    │ APIs/Services│
                                    └──────────────┘
```

- **Frontend (React + Vite)** — CRUD UI for services, dashboard, incident
  views. Talks only to the Express REST API.
- **API server (Express)** — handles CRUD and read endpoints. Does not
  perform health checks inside a request; it only reads/writes state.
- **Scheduler (`node-cron`, in-process)** — runs periodic health checks,
  writes results to Postgres, and opens/resolves incidents.
- **PostgreSQL** — single source of truth: services, health checks,
  incidents. Accessed via raw `pg` queries behind a repository layer
  (no ORM), by decision.

## 2. Folder Structure

```
api-monitoring-incident-platform/
├── backend/
│   ├── src/
│   │   ├── config/                   # db pool, env validation
│   │   ├── db/
│   │   │   ├── migrations/           # SQL migration files
│   │   │   └── seed.sql
│   │   ├── modules/
│   │   │   ├── services/             # controller, routes, repository, validation
│   │   │   ├── healthChecks/         # controller, routes, repository
│   │   │   ├── incidents/            # controller, routes, repository
│   │   │   └── dashboard/            # controller, routes
│   │   ├── worker/
│   │   │   ├── scheduler.js          # node-cron setup
│   │   │   ├── checkRunner.js        # performs the HTTP probe
│   │   │   └── incidentEngine.js     # opens/resolves incidents
│   │   ├── middleware/               # errorHandler, requestLogger
│   │   ├── app.js                    # express app assembly
│   │   └── server.js                 # entrypoint (starts app + scheduler)
│   ├── tests/
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/                      # fetch/axios client wrapper
│   │   ├── components/               # ServiceList, ServiceForm, StatusBadge, IncidentList, DashboardCards
│   │   ├── pages/                    # ServicesPage, ServiceDetailPage, IncidentsPage, DashboardPage
│   │   ├── hooks/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── docker/                           # added later
├── docs/
│   └── architecture.md
├── .gitignore
└── README.md
```

Feature-based modules (services / healthChecks / incidents) rather than a
layer-based split, so related routes/repository/validation code stays
co-located.

## 3. Database Schema (PostgreSQL)

```sql
-- services being monitored
CREATE TABLE services (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    url             TEXT NOT NULL,
    method          VARCHAR(10) NOT NULL DEFAULT 'GET',
    expected_status INTEGER NOT NULL DEFAULT 200,
    check_interval_seconds INTEGER NOT NULL DEFAULT 60,
    timeout_ms      INTEGER NOT NULL DEFAULT 5000,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    current_status  VARCHAR(10) NOT NULL DEFAULT 'unknown', -- 'up' | 'down' | 'unknown'
    last_checked_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- every health check result (append-only history)
CREATE TABLE health_checks (
    id              BIGSERIAL PRIMARY KEY,
    service_id      UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    status          VARCHAR(10) NOT NULL,        -- 'up' | 'down'
    status_code     INTEGER,                     -- nullable: request errored/timed out
    response_time_ms INTEGER,                    -- nullable if it failed to connect
    error_message   TEXT,                        -- nullable
    checked_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- incidents auto-created on failure
CREATE TABLE incidents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id      UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    status          VARCHAR(15) NOT NULL DEFAULT 'open', -- 'open' | 'resolved'
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at     TIMESTAMPTZ,
    failure_count   INTEGER NOT NULL DEFAULT 1,          -- consecutive failures seen
    root_cause_summary TEXT,       -- filled in later by AI
    suggested_steps TEXT,          -- filled in later by AI
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_health_checks_service_time ON health_checks (service_id, checked_at DESC);
CREATE INDEX idx_incidents_service_status ON incidents (service_id, status);
CREATE INDEX idx_incidents_open ON incidents (status) WHERE status = 'open';
```

Notes:
- `services.current_status` is a denormalized cache, updated by the worker
  after each check, so list/dashboard views avoid scanning `health_checks`.
- `health_checks` grows unboundedly in V1 — retention/partitioning is a
  deferred concern (see §9).
- "One open incident per service" is enforced in the application layer
  (checked before insert), not via a DB constraint.

## 4. REST API Endpoints

```
Services
  POST   /api/services              create a monitored service
  GET    /api/services              list all services (current_status, last check)
  GET    /api/services/:id          get one service detail
  PATCH  /api/services/:id          update (name/url/interval/active)
  DELETE /api/services/:id          remove a service (cascades checks/incidents)

Health Checks
  GET    /api/services/:id/checks   history for one service (paginated, ?limit=&before=)

Incidents
  GET    /api/incidents             list all incidents (filter ?status=open|resolved)
  GET    /api/incidents/:id         incident detail (+ health checks around the failure window)
  PATCH  /api/incidents/:id         manually resolve/annotate an incident

Dashboard
  GET    /api/dashboard/summary     counts: total services, up, down, open incidents, avg uptime %
```

Health checks are only ever written by the worker, never by a client — there
is no public `POST` endpoint for creating a health check.

Example `GET /api/services` response shape:

```json
[
  {
    "id": "uuid",
    "name": "Payments API",
    "url": "https://...",
    "currentStatus": "up",
    "lastCheckedAt": "2026-09-16T10:00:00Z",
    "lastResponseTimeMs": 142,
    "uptimePercent24h": 99.8
  }
]
```

## 5. Background Monitoring

**Mechanism:** `node-cron` runs inside the same Node process as the Express
server, ticking every 10–15s and checking which services are "due" based on
each service's own `check_interval_seconds` and `last_checked_at`.

**Per-tick logic:**

1. Query `services WHERE is_active = true AND (last_checked_at IS NULL OR last_checked_at < now() - interval)`.
2. For each due service, dispatch an async HTTP request (timeout via
   `AbortController`, using `timeout_ms`).
3. Classify the result:
   - status code matches `expected_status` → `up`
   - wrong status, network error, or timeout → `down`
4. Insert a row into `health_checks`.
5. Update `services.current_status` and `last_checked_at`.
6. Run the incident engine.

**Incident engine rules (approved: threshold = 1):**
- On failure: if no `open` incident exists for the service, create one
  immediately (after 1 failed check).
- On a later failure while an incident is open: increment `failure_count`.
- On success: if an `open` incident exists, mark it `resolved` and set
  `resolved_at = now()`.

**Concurrency:** checks across different services run in parallel via
`Promise.allSettled`; a single service is never checked concurrently with
itself, since `last_checked_at` is only updated after its check completes.

**Why in-process instead of Redis/BullMQ:** avoids extra infrastructure for
a portfolio-scale project. `worker/scheduler.js` is isolated so it can be
swapped for a queue-backed worker later without touching `checkRunner.js`
or `incidentEngine.js`.

## 6. Data Flow

- **Add a service:** `ServiceForm` → `POST /api/services` → validate →
  insert → frontend adds it to the list with `current_status = 'unknown'`
  until the first check runs.
- **Background check cycle:** `scheduler.js` tick → `checkRunner.js` probes
  the URL → `healthChecks` repository inserts a row → `incidentEngine.js`
  evaluates → `incidents` repository inserts/updates as needed →
  `services` repository updates `current_status`/`last_checked_at`.
- **Dashboard view:** `DashboardPage` polls `GET /api/dashboard/summary`
  and `GET /api/services` on an interval (e.g. every 15–30s) — no
  WebSockets in V1.
- **Incident history:** `IncidentsPage` → `GET /api/incidents?status=...`
  → detail view → `GET /api/incidents/:id` (includes surrounding health
  checks, useful later as AI-summary input).

## 7. Validation & Failure Handling

**Input validation (`POST`/`PATCH /api/services`):**
- `name`: required, 1–255 chars.
- `url`: required, valid `http(s)://` URL only (reject other schemes).
- `method`: enum, default `GET`.
- `expected_status`: integer 100–599.
- `check_interval_seconds`: integer, min 10, max 86400.
- `timeout_ms`: integer, min 100, max 30000, sane relative to interval.

**SSRF note:** since the app makes outbound requests to user-supplied URLs,
blocking requests to private/internal IP ranges is a known gap, acceptable
for a local portfolio project but called out here for future hardening —
see §9.

**Health-check failure classification:**
- Network error / DNS failure / connection refused → `down`, `error_message`
  set, `status_code = null`.
- Timeout exceeded → `down`, `error_message = 'timeout'`.
- Response received but wrong status code → `down`, `status_code` set.
- Response received matching expected status → `up`.

**API error handling:** centralized Express error middleware returns
`{ error: { message, code } }`; 404 for unknown IDs, 400 for validation
failures (schema-validated), 500 for unexpected errors (logged, not leaked).

**Worker resilience:** one service's failing/throwing check must never
crash the scheduler tick (`try/catch` per check, `Promise.allSettled`
across services). A failed DB write is logged, not retried indefinitely.

## 8. Implementation Roadmap

1. Repo scaffolding — backend (Express) and frontend (Vite+React), env
   files, lint/format config.
2. Database — Postgres setup, migrations for the 3 tables, seed script.
3. Backend: services module (CRUD + validation + repository).
4. Backend: `checkRunner.js` as a standalone, manually-tested function.
5. Backend: scheduler wiring (`node-cron` → `checkRunner` → `health_checks`
   → `services.current_status`).
6. Backend: incident engine (open/resolve logic).
7. Backend: incidents + dashboard read endpoints.
8. Frontend: services list + add-service form.
9. Frontend: service detail + check-history view.
10. Frontend: incidents page (list + detail).
11. Frontend: dashboard page with polling refresh.
12. Polish: loading/error/empty states, basic styling.
13. (Later) Docker Compose for backend, frontend, Postgres.
14. (Later) AI-generated incident summaries.

Build vertically — one full feature slice end-to-end before the next — so
the project stays demoable at every step.

## 9. Deferred to Later Versions

- AI-generated incident root-cause summaries and suggested steps.
- Authentication / multi-user support (V1 is single-user/local).
- Notifications (email/Slack/webhook on incident open).
- Redis/BullMQ-based distributed worker, horizontal scaling.
- Health-check retention policy / partitioning.
- Configurable consecutive-failure threshold before opening an incident
  (hardcoded to 1 in V1).
- SSRF protection / private-IP blocking for monitored URLs.
- WebSocket/live-push updates in place of polling.
- Response-time percentile charts, richer SLA/uptime reporting.
- Multi-region checks, custom headers/auth/request bodies for checks.
- Docker/Kubernetes deployment configs.

## 10. Approved Decisions (for reference)

| Decision | Choice |
|---|---|
| Scheduler location | `node-cron`, in-process with Express |
| Incident open threshold | 1 failed check |
| Frontend refresh strategy | Polling, not WebSockets |
| Repo layout | Plain `backend/` + `frontend/`, no monorepo tooling |
| ID strategy | UUIDs for `services` and `incidents` |
| Database | PostgreSQL |
| Data access | Raw `pg` queries behind a repository layer, no ORM |

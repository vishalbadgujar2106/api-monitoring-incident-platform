# BeaconOps

A self-hosted API uptime monitor that turns failures into incidents automatically, and can explain what went wrong when you ask it to.

## Why I built this

Most "toy" monitoring projects stop at pinging a URL and showing a green or red dot. What actually makes an incident tool useful is what happens *after* something breaks: how fast you notice, how much history you have to diagnose it, and whether you can figure out the likely cause without digging through raw logs by hand.

BeaconOps is my attempt at that fuller loop. You register a service with a URL and an expected status code, and a background scheduler checks it on its own schedule. The moment a check fails, an incident opens automatically — no manual "report an outage" step. Every incident carries its health-check history with it, and you can ask an AI model to read that history and give you a plain-English root cause and a first set of things to check, on demand, without it being baked permanently into the database.

It's built to be run and read like a real small service, not a demo script: input validation at the API boundary, a background worker that can't be taken down by one bad target, production-safe CORS and env-var handling, and a data model that was designed before any code was written (see `docs/architecture.md`).

![BeaconOps dashboard](docs/screenshots/hero.png)
*Screenshot placeholder — see "Screenshots to add" below.*

## Key Features

- **Automatic health checks** — a `node-cron` scheduler ticks every 10 seconds and checks whichever services are due, based on each service's own configurable interval.
- **Automatic incident lifecycle** — the first failed check opens an incident; later failures increment its failure count; the first successful check after that resolves it. No manual "mark as down" step.
- **Manual on-demand check** — a "check now" action runs a real probe immediately through the same code path the scheduler uses, without waiting for the next tick.
- **Per-service and fleet-wide dashboards** — KPI cards, uptime sparklines, and a bucketed time series over 1h / 6h / 24h / 7d windows.
- **Incident timeline** — a chronological view of an incident merging its start/resolve markers with the surrounding health checks, with long runs of identical checks collapsed into a single summary row so a 3 a.m. outage doesn't render as 200 nearly-identical lines.
- **AI-powered incident analysis** — on request, sends an incident's own data (service config, timing, and its health-check window — nothing else) to OpenAI and gets back a structured root cause, evidence, and suggested next steps.
- **Light / dark / system theme**, persisted per browser, with no flash of the wrong theme on load.
- **Pause/resume, edit, and delete** for monitored services, with confirmation dialogs and toast feedback for destructive actions.
- **Production-safe by default** — origin-restricted CORS, a DB-backed health endpoint, and startup/build-time checks that fail loudly instead of silently misbehaving when required configuration is missing.

## Screenshots

> Placeholders — see "Screenshots to add" at the bottom of this README.

| | |
|---|---|
| **Dashboard — dark mode** | ![Dashboard dark mode](docs/screenshots/dashboard-dark.png) |
| **Dashboard — light mode** | ![Dashboard light mode](docs/screenshots/dashboard-light.png) |
| **Service detail** | ![Service detail](docs/screenshots/service-detail.png) |
| **Incident detail / timeline** | ![Incident detail](docs/screenshots/incident-detail.png) |
| **AI incident analysis** | ![AI incident analysis](docs/screenshots/ai-analysis.png) |

## End-to-end demo workflow

This is the actual loop the system runs, start to finish:

1. **Register a service** — give it a name, a URL, an expected status code, a check interval, and a timeout.
2. **Healthy** — the scheduler checks it on schedule; each result is stored in `health_checks`; the service's dashboard status stays "up".
3. **Failure** — the monitored endpoint starts returning the wrong status, times out, or refuses the connection. The very next check is classified "down" and an incident opens immediately (V1 uses a 1-failure threshold, by design — see "Important decisions" below).
4. **Ongoing outage** — every further failed check increments the incident's failure count and adds to its health-check history; the dashboard's open-incident count and the service's status both reflect it live via polling.
5. **Recovery** — the first check that matches the expected status again resolves the incident (`resolved_at` is set) automatically — no manual close step.
6. **AI analysis (optional, on demand)** — from the incident's detail page, clicking "Analyze with AI" sends that incident's own timing and health-check window to OpenAI and renders back a root cause, supporting evidence, and suggested next steps. Nothing is saved to the database — re-opening the incident later shows a blank analysis panel again, and clicking the button re-runs it.

## Architecture overview

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
                                            
                          POST /api/incidents/:id/analyze
                                            │
                                            ▼
                                    ┌──────────────┐
                                    │ OpenAI API   │  (incident context only,
                                    │ (Responses)  │   result not persisted)
                                    └──────────────┘
```

The scheduler runs **in the same Node process** as the API server, not as a separate worker or queue — a deliberate choice for a project at this scale (see "Important decisions"). The frontend never talks to Postgres or OpenAI directly; everything goes through the Express REST API.

## Tech Stack

**Backend**
- Node.js + Express (REST API)
- PostgreSQL, accessed via raw `pg` queries behind a repository layer — no ORM
- `node-cron` for the in-process background scheduler
- OpenAI's Responses API via native `fetch` — no SDK dependency

**Frontend**
- React 19 + Vite 8
- No routing library — a single dashboard page with state-based view switching (list → service detail / incident detail)
- Plain CSS with theme tokens (light/dark/system), no CSS framework
- `oxlint` for linting

**Infrastructure**
- Docker Compose for the local PostgreSQL instance only — the backend and frontend run natively (`npm run dev` / `npm start`), there's no Dockerfile for the app itself yet

## Important engineering/design decisions

A few choices that were deliberate, not accidental — most are recorded in `docs/architecture.md` before any code was written:

- **In-process scheduler, not a queue.** `node-cron` runs inside the same process as the API server instead of Redis/BullMQ. It's isolated in `worker/scheduler.js` so it could be swapped for a real queue later without touching the check-running or incident logic.
- **1 failed check opens an incident, not N consecutive failures.** This is intentional for V1 — it favors noticing problems immediately over reducing noise from flaky single failures. A configurable threshold is a listed, deferred improvement.
- **AI analysis is generated on demand and never persisted to Postgres.** This was a deliberate reversal during development: an earlier version wrote the AI's output into the `incidents` table, but that was rolled back in favor of calling the model fresh each time and returning the result directly in the API response. The database columns still exist for a possible future version, they're just unused by the current write path.
- **Raw SQL over an ORM.** A repository layer wraps `pg` queries per module. For a schema this small, an ORM would have added a dependency and an abstraction layer without much payoff.
- **Polling, not WebSockets.** The frontend polls REST endpoints every 15 seconds. Simpler to reason about and debug than a live-push layer, at the cost of near-real-time rather than instant updates.
- **CORS fails closed.** In production, only origins explicitly listed via `FRONTEND_ORIGIN` are allowed (plus the local Vite dev origin, always). There's no wildcard fallback — a misconfigured deployment blocks requests rather than accepting them from anywhere.
- **Frontend production builds fail fast, not silently.** `vite build` refuses to produce a bundle if `VITE_API_BASE_URL` isn't set, because Vite only bundles code at build time — it doesn't execute it — so a runtime-only check would never surface until someone loaded a broken page in a browser.

## Project structure

```
api-monitoring-incident-platform/
├── backend/
│   ├── src/
│   │   ├── config/          # db pool (with optional TLS for hosted Postgres)
│   │   ├── db/
│   │   │   ├── migrations/  # numbered, idempotent SQL migrations
│   │   │   └── migrate.js   # migration runner
│   │   ├── modules/
│   │   │   ├── services/    # CRUD + validation + repository
│   │   │   ├── healthChecks/# repository only — no public write endpoint
│   │   │   ├── incidents/   # list/detail + AI analysis endpoint
│   │   │   └── dashboard/   # summary + time-bucketed metrics
│   │   ├── worker/
│   │   │   ├── scheduler.js       # node-cron tick loop
│   │   │   ├── checkRunner.js     # performs the HTTP probe
│   │   │   ├── recordHealthCheck.js
│   │   │   └── incidentEngine.js  # opens/increments/resolves incidents
│   │   ├── middleware/       # error handling, async wrapper
│   │   ├── app.js            # express app assembly (CORS, routes, health)
│   │   └── server.js         # entrypoint — validates env, starts app + scheduler
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/              # fetch wrapper + per-module API clients
│   │   ├── components/       # ServicesTable, IncidentTimeline, MetricCards, etc.
│   │   ├── pages/            # DashboardPage, ServiceDetailPage, IncidentDetailPage
│   │   ├── hooks/            # polling, theme, toast, metric history
│   │   └── App.jsx
│   ├── vite.config.js        # includes the production env-var build guard
│   └── .env.example
├── docs/
│   └── architecture.md       # the approved design doc, written before implementation
├── docker-compose.yml        # PostgreSQL only
└── .env.example               # docker-compose Postgres credentials
```

## Local development setup

**Prerequisites:** Node.js 18+ (native `fetch` is used for the OpenAI integration), Docker (for Postgres), and an OpenAI API key if you want the AI analysis feature. Developed and tested on Node 24.

```bash
# 1. Start Postgres
cp .env.example .env
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env      # edit DATABASE_URL / AI_* if needed
npm install
npm run migrate           # safe to re-run — skips already-applied migrations
npm run dev                # http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                # http://localhost:5173
```

Open `http://localhost:5173`, add a service (any `http://` or `https://` URL works, including one that doesn't exist yet, to see a failure), and watch it move through the lifecycle described above.

## Environment variables

**Root `.env`** (used only by `docker-compose.yml`):

| Variable | Required | Notes |
|---|---|---|
| `POSTGRES_USER` | No | Defaults to `postgres` |
| `POSTGRES_PASSWORD` | No | Defaults to `postgres` |
| `POSTGRES_DB` | No | Defaults to `api_monitoring` |

**`backend/.env`:**

| Variable | Required | Notes |
|---|---|---|
| `PORT` | No | Defaults to `4000` |
| `DATABASE_URL` | **Yes** | Server and migrations refuse to start without it |
| `DATABASE_SSL` | No | Set `true` for hosted Postgres providers that require TLS |
| `FRONTEND_ORIGIN` | Only for production | Exact deployed frontend origin, for CORS. Not needed for local dev |
| `AI_PROVIDER` | Only for AI analysis | Must be `openai` — any other value fails loudly rather than silently doing nothing |
| `AI_MODEL` | Only for AI analysis | e.g. `gpt-5-mini` |
| `AI_API_KEY` | Only for AI analysis | Feature is disabled gracefully (clear error, not a crash) if unset |

**`frontend/.env`:**

| Variable | Required | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | Only for production builds | Falls back to `http://localhost:4000` in dev; a production build fails immediately without it |

No `.env` file is committed anywhere in this repo — only `.env.example` files with placeholder values.

## Main API endpoints

```
Services
  POST   /api/services              create a monitored service
  GET    /api/services              list services (?range=1h|6h|24h|7d)
  GET    /api/services/:id          service detail + metrics series + recent checks/incidents
  PATCH  /api/services/:id          update name/url/interval/timeout/active
  DELETE /api/services/:id          remove a service (cascades its checks/incidents)
  POST   /api/services/:id/check    run one on-demand check now

Incidents
  GET    /api/incidents             list incidents (?status=open|resolved)
  GET    /api/incidents/:id         incident detail + surrounding health checks
  POST   /api/incidents/:id/analyze generate an AI root-cause analysis (not persisted)

Dashboard
  GET    /api/dashboard/summary     current counts: services up/down, open/resolved incidents, 24h uptime
  GET    /api/dashboard/metrics     bucketed time series (?range=1h|6h|24h|7d)

Health
  GET    /api/health                200 if the DB is reachable, 503 if not
```

There's no endpoint to create a health check directly — only the background worker writes to that table.

## Testing / validated scenarios

There's no automated test suite yet (no Jest/Vitest configured) — validation so far has been direct, functional testing against a real local Postgres instance and, for the AI feature, real OpenAI API calls:

- Full incident lifecycle: healthy → failing → incident opens on the first failure → failure count increments → recovers → incident auto-resolves.
- Manual on-demand check, independent of the scheduler's own timing.
- Input validation: rejected non-`http(s)` URLs, out-of-range intervals/timeouts, a timeout that doesn't fit inside its check interval.
- Worker resilience: one failing/unreachable service doesn't stop other services' checks or crash the scheduler.
- AI analysis: a real incident with genuine `ECONNREFUSED` health checks, run through the actual OpenAI call — correct structured output, and confirmed that repeated calls never write to the database.
- AI error handling: missing config, wrong `AI_PROVIDER`, malformed/incomplete model output, refusals, auth failures, and rate limits — each mapped to a distinct, clear error rather than a generic 500.
- CORS: local dev origin, a configured production origin, and an unrecognized origin (rejected with `403`).
- Health endpoint: `200` with the database reachable, `503` when it isn't, without crashing the process.
- Migrations: confirmed idempotent — re-running skips already-applied files.
- Production frontend build: fails clearly without `VITE_API_BASE_URL`, and correctly bakes in the real URL (verified no `localhost` reference survives in the built bundle) when it's set.

## AI incident analysis, in more detail

When you click "Analyze with AI" on an incident:

1. The backend loads that incident's own record and the health checks in its failure window — nothing from other services, other incidents, or the `.env` file.
2. It calls OpenAI's Responses API (native `fetch`, no SDK) with a strict JSON schema requiring five fields: `summary`, `likelyCause`, `suggestedSteps`, `evidence`, and `confidence` (`low`/`medium`/`high`).
3. The response is validated against that shape again in code, independent of the schema enforcement, before it's trusted.
4. The result is returned directly in the API response — it is **not** written to Postgres. Closing and reopening the incident, or asking again, always calls the model fresh.

This was a deliberate constraint for V1: keeping AI output out of the database avoids stale or misleading analysis sitting next to real monitoring data, and keeps the feature obviously opt-in and cost-visible (each click is one real API call).

## Security notes

- Every monitored URL is validated to use `http://` or `https://` only.
- There is **no SSRF protection** — the app will happily make outbound requests to whatever URL you give it, including private/internal addresses. This is a known, deliberate gap for a local/portfolio-scale project, not an oversight (see `docs/architecture.md` §9).
- There is **no authentication** — V1 is single-user/local by design.
- CORS is an explicit allowlist in production (`FRONTEND_ORIGIN`), not a wildcard.
- Health checks can only ever be written by the background worker — there's no public endpoint for a client to insert one.
- The OpenAI API key is read from `AI_API_KEY` at request time, never logged, never included in any error response, and never sent anywhere except OpenAI's API. Only the specific incident/health-check context needed for that analysis is sent — not `.env` contents or unrelated data.
- No `.env` files are committed; only `.env.example` placeholders.

## Current limitations

- No authentication or multi-user support.
- No notifications (email/Slack/webhook) when an incident opens.
- The 1-failed-check incident threshold isn't configurable.
- No SSRF protection on monitored URLs.
- `health_checks` grows without a retention policy — nothing prunes old rows yet.
- Polling-based UI updates (15s interval), not real-time push.
- No automated test suite.
- Single Postgres instance, single Node process — no horizontal scaling or distributed worker.
- The app itself (backend/frontend) isn't containerized yet, only Postgres is.
- AI analysis costs a real API call every time it's run, since nothing is cached or persisted.

## Roadmap

- Containerize the backend and frontend (Docker Compose already covers Postgres).
- Deploy a live instance (the production-readiness groundwork — CORS, env validation, hosted-Postgres support — is done; nothing is deployed yet).
- Notifications on incident open (email/Slack/webhook).
- Configurable consecutive-failure threshold before opening an incident.
- Basic SSRF protection for monitored URLs.
- Authentication / multi-user support.
- Retention policy for `health_checks`.
- Richer uptime/SLA reporting (percentiles, not just averages).

## What I learned building BeaconOps

A few things stuck with me more than I expected going in:

- **The scheduler-isolation decision paid off.** Keeping `node-cron` wiring in its own small file, separate from the actual check/incident logic, meant I could reason about "what happens on a slow check" or "what happens on two overlapping ticks" without touching anything else — and it's the one piece I'd swap first if this ever needed real scale.
- **Reversing a decision after shipping it is normal, and cheaper if you designed for it.** I originally persisted the AI analysis to Postgres, then rolled that back to a request-time-only result once it was clear that wasn't the right call for V1. Because the write path was isolated behind one repository function, removing it was a small, contained change — not a rewrite.
- **`vite build` doesn't run your code — it bundles it.** I first tried to fail a misconfigured production build by throwing inside application code. That silently did nothing at build time and only would have surfaced as a broken page in someone's browser. The real fix had to live in `vite.config.js`, which actually executes during the build.
- **CORS is a design decision, not a checkbox.** `cors()` with no arguments "works" in the sense that requests succeed, but it's not a decision — it's the absence of one. Writing an explicit allowlist forced me to actually think about what a production deployment needs versus what local development needs, instead of hoping they'd never diverge.
- **A schema you write down before coding is worth more than it looks like at the time.** `docs/architecture.md` was written before any application code, and going back to it repeatedly — for endpoint shapes, the incident threshold, what's explicitly deferred — kept later decisions consistent instead of ad hoc.

---

### Screenshots to add

These are referenced above as placeholders and don't exist in the repo yet:

- `docs/screenshots/hero.png` — main dashboard, used as the top-of-README hero image
- `docs/screenshots/dashboard-dark.png` — dashboard in dark mode
- `docs/screenshots/dashboard-light.png` — dashboard in light mode
- `docs/screenshots/service-detail.png` — a service's detail page (metrics + history)
- `docs/screenshots/incident-detail.png` — an incident's detail/timeline view
- `docs/screenshots/ai-analysis.png` — the AI incident analysis panel with a real result showing

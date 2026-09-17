# AI API Monitoring & Incident Management Platform

A portfolio project for monitoring the uptime and response time of registered
APIs/services, automatically opening incidents when they fail, and (in a
later version) using AI to summarize likely causes and suggest next
investigation steps.

## Goal

Let a user register APIs/services to watch. The system periodically checks
each one, records uptime and response-time history, automatically opens an
incident when a service goes down, and gives the user a dashboard to see
current status, response times, and incident history at a glance.

## V1 Scope

- Add an API/service to monitor
- View all monitored services with current status (up/down) and response time
- Store health-check history per service
- Automatically create an incident when a service fails
- View incident history (open and resolved)
- Dashboard with basic uptime/status metrics

V1 deliberately excludes authentication, notifications, AI summaries, and
distributed/queue-based workers. See `docs/architecture.md` for the full
design and the list of features deferred to later versions.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express (REST API)
- Database: PostgreSQL (raw `pg` queries, repository layer — no ORM)
- Background jobs: `node-cron`, in-process with the Express server
- Containerization: Docker (planned, not yet implemented)
- AI integration: planned for a later version

## Repository Layout

```
backend/    Express API server + background health-check worker
frontend/   React + Vite dashboard UI
docs/       Architecture and design documentation
```

## Status

Setup phase — architecture and project scaffolding only. Application code
has not been implemented yet.

## Getting Started

Not yet available — backend and frontend implementation is pending.

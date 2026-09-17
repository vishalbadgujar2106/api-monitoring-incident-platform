# CLAUDE.md

Guidance for Claude Code (or any AI assistant) working in this repository.

## Project

AI API Monitoring & Incident Management Platform — see `README.md` for
scope and `docs/architecture.md` for the full approved architecture
(schema, endpoints, worker design, roadmap). Read `docs/architecture.md`
before implementing any backend or frontend feature; do not re-derive or
silently deviate from the decisions recorded there.

## Approved Architecture Constraints (do not change without asking)

- Background jobs run via `node-cron` **in the same process** as the
  Express server. Do not introduce Redis/BullMQ or a separate worker
  process/service without explicit approval.
- Database access uses **raw `pg` queries behind a repository layer**.
  Do not add an ORM (Prisma, Sequelize, TypeORM, Knex, etc.) without
  explicit approval.
- IDs for `services` and `incidents` are **UUIDs** (`gen_random_uuid()`).
  `health_checks` uses a `BIGSERIAL`. Do not change ID strategies.
- Frontend uses **polling** for live updates, not WebSockets/SSE.
- An incident opens after **1** failed health check (not N consecutive
  failures) — this is intentional for V1, not a bug.
- Folder layout is a plain two-folder repo (`backend/`, `frontend/`), no
  npm/pnpm workspaces or monorepo tooling.

If a task seems to require deviating from one of these, stop and ask
rather than silently reinterpreting the architecture.

## Safe Development Rules

- **No secrets in the repo.** Never commit `.env` files, API keys, DB
  credentials, or AI provider keys. Use `backend/.env.example` for
  documenting required variables with placeholder values only.
- **Migrations are additive and reviewed.** Write new migration files for
  schema changes rather than editing already-applied ones. Do not run
  destructive migrations (`DROP TABLE`, `DROP COLUMN`, data-deleting
  `UPDATE`/`DELETE`) against any real data without explicit confirmation.
- **Validate all external input** at the API boundary (request bodies,
  query params) before touching the database — especially `url`, which
  must be restricted to `http(s)://` schemes.
- **Health checks only write, never the API.** `POST`-ing a health check
  result is not a public endpoint; only `backend/src/worker/` should write
  to the `health_checks` table.
- **The worker must not crash the server.** Any exception inside a single
  service's health check must be caught locally (`try/catch` per check)
  so one bad target never takes down the scheduler or the API process.
- **No destructive git operations** (`git reset --hard`, `git push
  --force`, `git clean -f`, deleting branches) without explicit
  confirmation, and never as a shortcut to "fix" a broken state — diagnose
  first.
- **Never commit or push automatically.** Only commit/push when the user
  explicitly asks for it in that message.
- **Don't add dependencies casually.** Adding a new npm package (backend
  or frontend) should be called out, not silently introduced, especially
  anything that contradicts the constraints above (an ORM, a queue
  library, a WebSocket library, an auth framework).
- **Keep V1 scope.** Do not implement features listed as "deferred" in
  `docs/architecture.md` §9 (AI summaries, auth, notifications, etc.)
  unless the user explicitly asks to start a later version.
- **AI integration (future):** when the AI summary feature is eventually
  built, never send secrets, `.env` contents, or unrelated user data to
  the AI provider — only the specific incident/health-check context
  needed for the summary.

## Working Style

- Prefer editing/extending the structure defined in
  `docs/architecture.md` over introducing new folders or patterns.
- Keep backend modules feature-based (`modules/services`,
  `modules/healthChecks`, `modules/incidents`, `modules/dashboard`) as
  already laid out — don't reorganize into a layer-based structure.
- Build vertically: complete one feature end-to-end (DB → API → UI)
  before starting the next, per the roadmap in `docs/architecture.md` §8.

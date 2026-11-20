# Team Task & Sprint Tracker

A mini SaaS for teams to plan sprints and track tasks: JWT authentication with Admin/Member roles, a filterable task dashboard with live metrics, and a REST API with server-side pagination, filtering and validation.

| | |
|---|---|
| **Web app** | https://team-task-sprint-tracker.vercel.app |
| **API** | https://task-tracker-api-90rd.onrender.com · [Swagger UI](https://task-tracker-api-90rd.onrender.com/docs) · [ReDoc](https://task-tracker-api-90rd.onrender.com/redoc) |
| **Note** | The API runs on Render's free tier and sleeps when idle — the first request after a pause can take 30–60 s. |
| **Demo logins** | `admin@demo.com` / `member@demo.com` — password `Password123!` |

**Stack:** Next.js 16 (App Router, TypeScript, Tailwind, shadcn/ui, TanStack Query) · FastAPI (Python 3.13, SQLAlchemy 2, Alembic, Pydantic v2) · PostgreSQL 16 · Docker Compose · GitHub Actions

## Assessment coverage

| Requirement | Implementation |
|---|---|
| Frontend authentication and task dashboard | Next.js login/register flows, responsive dashboard, task CRUD, filtering, search, pagination, assignee/sprint views, and summary metrics |
| Backend API and access control | FastAPI REST API with JWT authentication, Admin/Member RBAC, validation, standardized response envelopes, and explicit error codes |
| Database design | PostgreSQL schema managed by Alembic, foreign-key relationships, dashboard-oriented indexes, and idempotent demo seed data |
| Local setup and deployment | `docker compose up --build` starts the database, API, and web app; Render and Vercel deployment instructions are included below |
| API documentation | Live Swagger UI/ReDoc links plus the committed [`docs/openapi.json`](docs/openapi.json) snapshot |
| CI and quality checks | GitHub Actions runs backend lint/tests, frontend lint/type-check/tests/build, and a Docker Compose smoke test |
| Scaling plan | The [Architecture & Scaling Note](#architecture--scaling-note) covers the 100k+ daily active user target |

---

## Contents
- [Quick start](#quick-start-docker)
- [Assessment coverage](#assessment-coverage)
- [Features](#features)
- [Architecture](#architecture)
- [API documentation](#api-documentation)
- [Database](#database)
- [Local development without Docker](#local-development-without-docker)
- [Environment variables](#environment-variables)
- [Testing & CI](#testing--ci)
- [Demo Environment & Security Limitations](#demo-environment--security-limitations)
- [Security Headers & CSP](#security-headers--csp)
- [Deployment](#deployment)
- [Architecture & Scaling Note](#architecture--scaling-note)
- [Project structure](#project-structure)

## Quick start (Docker)

```bash
git clone https://github.com/kkazei/team-task-sprint-tracker.git
cd team-task-sprint-tracker
docker compose up --build
```

| Service | URL |
|---|---|
| Web app | http://localhost:3000 |
| API + Swagger UI | http://localhost:8000/docs |
| PostgreSQL | `localhost:5432` (user/password/db: `tracker`) |

On startup the API container applies the Alembic migrations and loads demo data (6 users, 4 sprints, 60 tasks dated relative to today), so you can sign in immediately with the demo accounts above — the login page has one-click buttons for both. No `.env` file is needed; copy [`.env.example`](.env.example) to `.env` only to override defaults.

## Features

**Frontend**
- Login and registration with client-side validation; API field errors are shown on the matching inputs.
- Dashboard with summary metrics — total, completed (with completion rate), pending, overdue, due this week — plus a status breakdown. Metrics follow the selected assignee/sprint scope.
- **My tasks / Reported by me / All tasks** tabs. Members land on *My tasks* sorted **most urgent first** (open work, then soonest due date, then priority); admins land on *All tasks*. The last tab you picked is remembered.
- One-click **Overdue** and **Due this week** chips, plus filters for **status, priority, assignee, sprint** and a debounced **title search**, sorting and server-side pagination. Filters live in the URL, so views can be bookmarked and shared.
- **Change status right in the row**: the status cell is a dropdown on tasks you're allowed to edit.
- **Claim unassigned work**: tasks without an assignee show an *Assign to me* button (or menu item) for any signed-in user. The claim is a conditional update, so if two people click at once the second gets a clear "someone else just picked up this task" conflict instead of overwriting the first.
- Create, edit, delete (with confirmation) and quick "move to status" actions. Actions are shown according to per-task permissions returned by the API; tasks you can't change show a lock with an explanation.
- **Sprints page:** sprint cards with status, dates, goal and progress, plus a link to each sprint's tasks. Admins create, edit, start, complete and delete sprints.
- **Team page:** everyone's role at a glance; admins promote or demote members.
- Responsive: table on desktop, cards on mobile. Loading skeletons, empty and error states, toasts.

**Backend**
- REST API under `/api/v1` with JWT bearer authentication and role-based access control.
- Server-side pagination, filtering, searching and sorting; Pydantic validation on every input.
- One response envelope for everything — success or failure — with stable error codes.
- Single-query aggregate metrics endpoint (`COUNT(*) FILTER (...)`).

**Roles**

| Action | Member | Admin |
|---|:---:|:---:|
| View tasks, sprints, metrics, team | ✅ | ✅ |
| Create tasks | ✅ | ✅ |
| Edit a task | if reporter or assignee | ✅ any |
| Claim an unassigned task (assign it to yourself) | ✅ | ✅ |
| Delete a task | if reporter | ✅ any |
| Create / edit / start / complete / delete sprints (Sprints page) | — | ✅ |
| Change a user's role (Team page) | — | ✅ (not their own) |

New sign-ups are always Members. Roles are re-read from the database on every request, so a demotion takes effect immediately. The UI hides actions a role can't perform, but the API enforces every rule on its own.

**Try it — compare the two demo accounts**
1. Sign in as **Member demo**. The dashboard explains the member's permissions; only Max's own or assigned tasks have an actions menu (others show a lock). Sprints and Team are read-only.
2. Sign out and sign in as **Admin demo**. Every task is editable, Sprints gains *New sprint* plus start/complete/delete, and Team shows a role dropdown for everyone except yourself.
3. Optional: on Team, promote Max Member to admin, sign back in as Max and see the admin controls — then demote him again.

## Architecture

```mermaid
flowchart LR
    B[Browser] -- "httpOnly session cookie" --> N["Next.js<br/>pages + BFF route handlers"]
    N -- "Authorization: Bearer JWT" --> A["FastAPI<br/>/api/v1"]
    A -- "SQLAlchemy 2 / psycopg 3" --> P[(PostgreSQL)]
```

- **Backend-for-frontend auth.** The browser never sees the JWT. Next.js route handlers (`/api/auth/*`, `/api/backend/*`) exchange credentials with the API, keep the token in an **httpOnly, SameSite=Lax** cookie, and forward requests with the `Authorization` header. The proxy only forwards to a fixed origin and an allowlist of resources, and rejects cross-site state-changing requests (`Origin` check) as CSRF defence in depth. The API itself stays a plain bearer-token service, usable from Swagger, Postman or other clients.
- **Route protection.** `src/proxy.ts` (Next 16's middleware) redirects signed-out users to `/login?next=…`; the API remains the source of truth and a 401 anywhere sends the user back to login.
- **Layered backend.** Routes (HTTP + dependencies) → services (business rules, queries) → models. RBAC is expressed as FastAPI dependencies (`CurrentUser`, `AdminUser`) and per-task permission checks.
- **Consistent responses.** Every endpoint returns `{success, data, meta, error}`; global exception handlers convert validation errors, domain errors, unknown routes, integrity races and unexpected exceptions into that envelope.

## API documentation

- **Swagger UI:** https://task-tracker-api-90rd.onrender.com/docs · **ReDoc:** https://task-tracker-api-90rd.onrender.com/redoc · **OpenAPI JSON:** https://task-tracker-api-90rd.onrender.com/openapi.json
- A snapshot of the spec is committed at [`docs/openapi.json`](docs/openapi.json) — import it into **Postman** (Import → File) to get a ready-made collection. Regenerate with `cd backend && uv run python -m scripts.export_openapi`.
- In Swagger: call `POST /api/v1/auth/login`, copy `access_token`, click **Authorize**.

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Create a member account, returns a token | Public |
| `POST` | `/api/v1/auth/login` | Email + password → access token | Public |
| `GET` | `/api/v1/auth/me` | Current user | Authenticated |
| `GET` | `/api/v1/tasks` | List tasks (filters, search, sort, pagination) | Authenticated |
| `GET` | `/api/v1/tasks/summary` | Dashboard metrics (same filters) | Authenticated |
| `GET` | `/api/v1/tasks/{id}` | Get a task | Authenticated |
| `POST` | `/api/v1/tasks` | Create a task | Authenticated |
| `PATCH` | `/api/v1/tasks/{id}` | Partial update; `{"assignee_id": <self id>}` on an unassigned task also claims it | Admin, reporter or assignee; any user may claim unassigned work |
| `DELETE` | `/api/v1/tasks/{id}` | Delete | Admin or reporter |
| `GET` | `/api/v1/sprints` | List sprints with progress | Authenticated |
| `GET` | `/api/v1/sprints/{id}` | Get a sprint | Authenticated |
| `POST` / `PATCH` / `DELETE` | `/api/v1/sprints[/{id}]` | Manage sprints | Admin |
| `GET` | `/api/v1/users` | Team directory (search, pagination) | Authenticated |
| `PATCH` | `/api/v1/users/{id}/role` | Change a role | Admin |
| `GET` | `/health`, `/health/ready` | Liveness / readiness (checks DB) | Public |

**Task list query parameters:** `status` and `priority` (repeatable), `assignee_id`, `unassigned`, `reporter_id`, `sprint_id`, `q` (case-insensitive title search; wildcards matched literally), `overdue`, `due_soon`, `sort` (`-created_at` default, `urgency`, `created_at`, `-updated_at`, `due_date`, `-due_date`, `priority`, `-priority`, `title`), `page`, `page_size` (≤ 100).

**Response envelope**

```jsonc
// 200
{ "success": true, "data": [ /* tasks */ ], "meta": { "page": 1, "page_size": 20, "total": 57, "total_pages": 3 }, "error": null }
// 422
{ "success": false, "data": null, "meta": null,
  "error": { "code": "validation_error", "message": "Request validation failed",
             "details": [{ "field": "title", "location": "body", "message": "String should have at least 1 character", "type": "string_too_short" }] } }
```

Error codes include `validation_error`, `unauthorized`, `invalid_credentials`, `token_expired`, `invalid_token`, `forbidden`, `not_found`, `email_taken`, `conflict` and `internal_error`.

## Database

```mermaid
erDiagram
    users ||--o{ tasks : "assignee"
    users ||--o{ tasks : "reporter"
    users ||--o{ sprints : "created_by"
    sprints ||--o{ tasks : "contains"
    users {
        int id PK
        string email UK
        string full_name
        string password_hash
        enum role
        bool is_active
    }
    sprints {
        int id PK
        string name
        text goal
        date start_date
        date end_date
        enum status
    }
    tasks {
        int id PK
        string title
        text description
        enum status
        enum priority
        date due_date
        timestamptz completed_at
        int assignee_id FK
        int reporter_id FK
        int sprint_id FK
    }
```

- Native PostgreSQL enums declared in workflow order, so `ORDER BY priority` sorts low → urgent.
- Foreign keys use `ON DELETE SET NULL` (deleting a sprint moves its tasks to the backlog); a check constraint enforces `end_date >= start_date`.
- **Indexes chosen for the dashboard's queries** (verified with `EXPLAIN`):

| Index | Serves |
|---|---|
| `(assignee_id, status)` | "My tasks" / assignee filter + status |
| `(status, priority)` | Status filter, priority filter/sort |
| partial `(due_date) WHERE status <> 'done'` | Overdue filter and count — finished work is excluded, keeping it small |
| GIN trigram on `title` (`pg_trgm`) | `ILIKE '%term%'` search |
| `created_at`, `sprint_id`, `reporter_id` | Default sort and FK lookups |

Migrations live in [`backend/alembic/versions`](backend/alembic/versions); demo data in [`backend/app/db/seed.py`](backend/app/db/seed.py) (idempotent).

## Local development without Docker

Requirements: Python 3.13 with [uv](https://docs.astral.sh/uv/), Node 24, PostgreSQL 16.

```bash
# API
cd backend
cp .env.example .env               # point DATABASE_URL at your Postgres
uv sync
uv run alembic upgrade head
uv run python -m app.db.seed
uv run uvicorn app.main:app --reload    # http://localhost:8000/docs

# Web (another terminal)
cd frontend
cp .env.example .env.local         # API_URL=http://localhost:8000
npm install
npm run dev                         # http://localhost:3000
```

## Environment variables

| Variable | Service | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | API | `postgresql+psycopg://tracker:tracker@localhost:5432/tracker` | PostgreSQL URL; `postgres://` / `postgresql://` URLs from hosts are accepted |
| `JWT_SECRET_KEY` | API | dev-only value | **Required in production** (startup fails if left at the default when `ENVIRONMENT=production`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | API | `60` | Token and session-cookie lifetime |
| `ENVIRONMENT` | API | `development` | `production` enables the secret check |
| `CORS_ORIGINS` | API | `http://localhost:3000` | Comma-separated origins for direct browser access |
| `SEED_DEMO_DATA` | API (container) | `true` | Load demo data on start if the DB has no users |
| `BCRYPT_ROUNDS` | API | `12` | Password hashing cost |
| `CLIENT_IP_SECRET` | API + Web | unset | Shared secret signing the browser IP from the BFF. When unset, no assertion is accepted and rate limits key on the direct peer (all BFF traffic shares one bucket). Set it to the same value on both services. |
| `CLIENT_IP_TRUST_PROXY` | Web | unset | Only `true` when a trusted edge overwrites `X-Real-IP`/`X-Forwarded-For` (Vercel is detected automatically via `VERCEL=1`). Leave unset for a directly reachable Next.js server, or clients could choose their own rate-limit bucket. |
| `RATE_LIMIT_STORAGE_URI` | API | `memory://` | SlowAPI store. Set a Redis URL (e.g. `redis://…:6379/0`) when running multiple workers/instances; `memory://` is per process and resets on restart. |
| `API_URL` | Web | `http://localhost:8000` | Server-side only; read at request time |

Templates: [`.env.example`](.env.example) (Compose), [`backend/.env.example`](backend/.env.example), [`frontend/.env.example`](frontend/.env.example).

## Testing & CI

```bash
cd backend
uv run ruff check . && uv run ruff format --check .
TEST_DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/tracker_test uv run pytest

cd frontend
npm test
npm run lint && npm run typecheck && npm run build
```

The **90 backend tests** run against a real PostgreSQL database built by the Alembic migrations, with each test in a rolled-back transaction. They cover auth (registration rules, expired/tampered tokens, deactivated users), rate limiting per trusted client identity, forged forwarding headers, RBAC for every role, every filter and combination, search escaping, sorting, pagination, partial updates, summary maths, task claiming/races and sprint rules.

The **13 frontend tests** use Vitest, jsdom and Testing Library. They cover login validation, demo filling, server-error display and the open-redirect guard; creating, editing and validating tasks; inline status changes and their error toast; and claiming/read-only actions. No browser or running API is required.

[GitHub Actions](.github/workflows/ci.yml) runs on every push: backend lint + tests (Postgres service container), frontend lint + type-check + tests + build, then a **Docker Compose smoke test** that boots the full stack, checks readiness, logs in with a seeded account and loads the web app.

## Demo Environment & Security Limitations

This is a portfolio/demo deployment. The limitations below are intentional and must be
understood before the application is used for anything real.

### Shared, publicly writable demo data

- The seed script creates two accounts that are documented in this README and on the login page:
  `admin@demo.com` (Admin) and `member@demo.com` (Member), both with password `Password123!`.
  Anyone can sign in with them.
- **All visitors share the same data.** Tasks, sprints and user roles are rows in one database;
  there are no per-visitor workspaces. Changes made by one visitor are visible to everyone.
- The demo **Admin** can edit and delete every task, create/start/complete/delete sprints, and
  promote or demote every other user. Visitors can therefore damage or wipe the shared demo
  data, including each other's work. Treat the demo as disposable and do not enter personal,
  confidential or production data.
- Demo seeding is controlled by `SEED_DEMO_DATA`. It only runs when the database has no users,
  so it will not restore data that a demo admin deletes.

### JWT lifetime and logout

- Authentication uses stateless HS256 JWTs with a **60-minute lifetime**
  (`ACCESS_TOKEN_EXPIRE_MINUTES`). The Next.js BFF keeps the token in an httpOnly cookie; the
  browser never reads it directly.
- **Logout only clears the cookie.** The API has no token denylist or server-side session, so a
  token that was already copied (from logs, a proxy, a compromised browser, or a saved API
  client) remains valid until its `exp` claim. Do not claim immediate revocation on logout.
- If a token must be invalidated across the whole deployment, rotating `JWT_SECRET_KEY` does that
  immediately by invalidating every existing token — at the cost of signing everyone out.
  Per-token revocation would require adding a `jti` claim plus a server-side denylist/session
  store, which this demo intentionally does not have.
- The API re-reads the user and role from the database on each request, so deleting/deactivating
  a user or demoting a role takes effect immediately even though the JWT itself stays valid.

### Production recommendations

1. Set `SEED_DEMO_DATA=false`, remove the shared demo accounts, and provision real users.
2. Set a strong, unique `JWT_SECRET_KEY` (startup refuses the development default in production).
3. Set a shared `CLIENT_IP_SECRET` on Vercel and Render so rate limits are per browser IP. Only enable `CLIENT_IP_TRUST_PROXY` where the edge is known to overwrite client-IP headers (Vercel does this automatically).
4. Run more than one API process only with `RATE_LIMIT_STORAGE_URI` pointing at Redis; the
   in-memory limiter is per process and resets on restart.
5. If immediate logout/revocation is a requirement, add a `jti` denylist or server-side session
   store before calling the app production-ready.

### Rate limiting details

Rate limiting deserves a note: the API excludes proxy-header trust at the Uvicorn layer, so `X-Forwarded-For` cannot change the identity used for throttling. The BFF asserts the browser IP with an HMAC-SHA256 signature over the IP and a short timestamp; the API accepts it only with the shared secret and rejects stale assertions. Without the secret it falls back to the direct peer. For more than one process, set `RATE_LIMIT_STORAGE_URI` to Redis — the default store is in-memory, so each process counts independently and restarts reset counters.

## Security Headers & CSP

`frontend/next.config.ts` sets `Content-Security-Policy-Report-Only` plus `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, a `Referrer-Policy` and a restrictive `Permissions-Policy`.
The policy is:

```
default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self' data:;
form-action 'self'; frame-ancestors 'none'; img-src 'self' blob: data:; object-src 'none';
script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'
```

The app loads no third-party scripts, fonts, images or APIs; Next.js injects inline bootstrap
scripts and Tailwind/Radix use inline styles, which is why `'unsafe-inline'` is present for
`script-src` and `style-src`. The policy is intentionally report-only in this demo because no
production violation reports are collected or reviewed yet and enforcement has not been observed
against real traffic. A local headless-Chrome check of the production build logged one report-only
violation from a library's CSP feature detection (`Function("")` inside a `try/catch`), which is
harmless but would still appear as console noise if enforced.

**Decision:** do not flip enforcement blindly. Stage it:

1. Deploy with the report-only header and add a reporting endpoint
   (`report-uri`/`report-to`) if you want automated evidence.
2. Load login, dashboard, sprints and team with DevTools open; a CSP violation appears in the
   console as `Refused to …` and has no legitimate source in this app. Any violation is a
   blocker.
3. Only then rename the header to `Content-Security-Policy` in `next.config.ts`, redeploy and
   repeat the smoke checks (console, login, task update, logout).

Because `'unsafe-inline'` is allowed for compatibility, CSP here is defence in depth against
loading external content, not an XSS mitigation; keep React escaping and the httpOnly session
cookie as the primary controls.

## Deployment

The stack runs on free tiers: **Neon** (PostgreSQL), **Render** (API, Docker) and **Vercel** (web).

1. **Neon:** create a project and copy the connection string (`postgresql://…?sslmode=require`).
2. **Render:** New → **Blueprint** → select this repo. [`render.yaml`](render.yaml) defines the service; paste the Neon string as `DATABASE_URL` (`JWT_SECRET_KEY` is generated). Migrations and demo data run on start; Render health-checks `/health/ready`.
3. **Vercel:** import the repo, set **Root Directory** to `frontend`, add `API_URL=https://<your-render-service>.onrender.com`, deploy.
4. **Rate limiting (recommended):** generate one secret and set `CLIENT_IP_SECRET` on **both** Render and Vercel — the BFF signs the browser IP and the API validates it. Without it the API refuses every assertion and keys limits on Render's proxy address, so all users share one login/register bucket. The BFF only reads edge IP headers on Vercel (`VERCEL=1`) or when `CLIENT_IP_TRUST_PROXY=true`; do not enable the latter on a directly reachable server.
5. **Multiple API workers/instances:** point `RATE_LIMIT_STORAGE_URI` at a Redis-compatible URL so limits are shared. The default in-memory store is per process and resets on restart.

> Render's free instances sleep when idle; the first request after a pause can take ~30–60 s.

## Architecture & Scaling Note

At 100,000+ daily active users, I would expect database capacity and connection limits to need attention before splitting the application into more services. The current Next.js and FastAPI setup can stay. Vercel can serve the frontend through its CDN, while FastAPI runs in multiple instances behind a load balancer. Because the API is stateless, instances can be added as traffic grows. I would also move rate-limit storage from process memory to Redis so every API instance shares the same counters.

PostgreSQL would need connection pooling through PgBouncer and monitoring for slow queries, locks, and connection usage. I would keep the existing indexes where production query plans show they help. Read replicas could handle read-heavy traffic, while cursor pagination would avoid the cost of deep offset pages. Redis could cache dashboard summaries, with affected entries invalidated after task or sprint updates.

Notifications, exports, and webhooks should run in background workers instead of holding up API requests. Before supporting multiple customer workspaces, I would add organization-level data isolation and enforce it in database queries. Partitioning or sharding can wait until measured load justifies them. Load tests, tracing, error monitoring, and latency alerts would guide each step.

## Project structure

```
backend/
  app/
    api/          routes (auth, users, tasks, sprints), dependencies (auth, RBAC, pagination)
    core/         settings, security (JWT, bcrypt), response envelope, error handlers
    models/       SQLAlchemy models and enums
    schemas/      Pydantic request/response models
    services/     business logic and queries
    db/           engine/session, seed script
  alembic/        migrations
  tests/          pytest suite (real Postgres)
  scripts/        container entrypoint, OpenAPI export
frontend/
  src/
    app/          pages (login, register, dashboard) and BFF route handlers (app/api)
    components/   dashboard, auth, layout, shadcn/ui
    lib/          API client, query hooks, server-side session helpers
    proxy.ts      route guard
docs/openapi.json
docker-compose.yml · render.yaml · .github/workflows/ci.yml
```

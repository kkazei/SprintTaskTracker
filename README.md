# Team Task & Sprint Tracker

A mini SaaS for teams to plan sprints and track tasks: JWT authentication with Admin/Member roles, a filterable task dashboard with live metrics, and a REST API with server-side pagination, filtering and validation.

| | |
|---|---|
| **Web app** | https://team-task-sprint-tracker.vercel.app |
| **API** | https://task-tracker-api-90rd.onrender.com · [Swagger UI](https://task-tracker-api-90rd.onrender.com/docs) · [ReDoc](https://task-tracker-api-90rd.onrender.com/redoc) |
| **Note** | The API runs on Render's free tier and sleeps when idle — the first request after a pause can take 30–60 s. |
| **Demo logins** | `admin@demo.com` / `member@demo.com` — password `Password123!` |

**Stack:** Next.js 16 (App Router, TypeScript, Tailwind, shadcn/ui, TanStack Query) · FastAPI (Python 3.13, SQLAlchemy 2, Alembic, Pydantic v2) · PostgreSQL 16 · Docker Compose · GitHub Actions

---

## Contents
- [Quick start](#quick-start-docker)
- [Features](#features)
- [Architecture](#architecture)
- [API documentation](#api-documentation)
- [Database](#database)
- [Local development without Docker](#local-development-without-docker)
- [Environment variables](#environment-variables)
- [Testing & CI](#testing--ci)
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
- Task list with filters for **status, priority, assignee, sprint, overdue** and a debounced **title search**, plus sorting and server-side pagination. Filters live in the URL, so views can be bookmarked and shared.
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
| `PATCH` | `/api/v1/tasks/{id}` | Partial update | Admin, reporter or assignee |
| `DELETE` | `/api/v1/tasks/{id}` | Delete | Admin or reporter |
| `GET` | `/api/v1/sprints` | List sprints with progress | Authenticated |
| `GET` | `/api/v1/sprints/{id}` | Get a sprint | Authenticated |
| `POST` / `PATCH` / `DELETE` | `/api/v1/sprints[/{id}]` | Manage sprints | Admin |
| `GET` | `/api/v1/users` | Team directory (search, pagination) | Authenticated |
| `PATCH` | `/api/v1/users/{id}/role` | Change a role | Admin |
| `GET` | `/health`, `/health/ready` | Liveness / readiness (checks DB) | Public |

**Task list query parameters:** `status` and `priority` (repeatable), `assignee_id`, `unassigned`, `reporter_id`, `sprint_id`, `q` (case-insensitive title search; wildcards matched literally), `overdue`, `sort` (`-created_at` default, `created_at`, `-updated_at`, `due_date`, `-due_date`, `priority`, `-priority`, `title`), `page`, `page_size` (≤ 100).

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
| `API_URL` | Web | `http://localhost:8000` | Server-side only; read at request time |

Templates: [`.env.example`](.env.example) (Compose), [`backend/.env.example`](backend/.env.example), [`frontend/.env.example`](frontend/.env.example).

## Testing & CI

```bash
cd backend
uv run ruff check . && uv run ruff format --check .
TEST_DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/tracker_test uv run pytest

cd frontend
npm run lint && npm run typecheck && npm run build
```

The 72 backend tests run against a real PostgreSQL database built by the Alembic migrations, with each test in a rolled-back transaction. They cover auth (registration rules, expired/tampered tokens, deactivated users), RBAC for every role, every filter and combination, search escaping, sorting, pagination, partial updates, summary maths and sprint rules.

[GitHub Actions](.github/workflows/ci.yml) runs on every push: backend lint + tests (Postgres service container), frontend lint + type-check + build, then a **Docker Compose smoke test** that boots the full stack, checks readiness, logs in with a seeded account and loads the web app.

## Deployment

The stack runs on free tiers: **Neon** (PostgreSQL), **Render** (API, Docker) and **Vercel** (web).

1. **Neon:** create a project and copy the connection string (`postgresql://…?sslmode=require`).
2. **Render:** New → **Blueprint** → select this repo. [`render.yaml`](render.yaml) defines the service; paste the Neon string as `DATABASE_URL` (`JWT_SECRET_KEY` is generated). Migrations and demo data run on start; Render health-checks `/health/ready`.
3. **Vercel:** import the repo, set **Root Directory** to `frontend`, add `API_URL=https://<your-render-service>.onrender.com`, deploy.

> Render's free instances sleep when idle; the first request after a pause can take ~30–60 s.

## Architecture & Scaling Note

The API is stateless — JWTs carry identity and every request re-reads the user — so it scales horizontally behind a load balancer: run several Uvicorn/Gunicorn workers per container and autoscale containers on CPU and latency. The Next.js tier is likewise stateless and served from Vercel's edge/CDN.

PostgreSQL becomes the bottleneck first. I would put PgBouncer (transaction pooling) in front of it, route list and summary reads to read replicas, and keep the composite and partial indexes aligned with real query plans. Offset pagination should move to keyset (cursor) pagination on `(created_at, id)` so deep pages stay O(log n). Dashboard metrics are read far more often than tasks change, so I would cache summaries in Redis per scope and invalidate on writes.

For multi-tenancy at 100k+ daily users, every table gets an `org_id` leading its indexes (with row-level security), and large tenants can later be partitioned or sharded. Slow side effects — notifications, exports, webhooks — go to a queue with background workers. Finally: rate limiting at the gateway, OpenTelemetry tracing, Sentry, and SLO-based alerts.

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

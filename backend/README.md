# MathQuest — FastAPI backend

The MathQuest API. Handles auth, gameplay, parent controls, and all
business logic that the TDD requires to run server-side.

Per [MathQuest_TDD_v1.1.docx](../MathQuest_TDD_v1.1.docx) §5.1, this
service holds **all secrets** (Supabase service_role key, Anthropic API
key, story system prompt) and is the only path by which those secrets
touch the wire. The Next.js frontend never talks to Supabase Auth
directly — it goes through this API.

## Stack

- **Python 3.11+**
- **FastAPI** + `uvicorn` (ASGI)
- **pydantic v2** for request/response validation
- **supabase-py** for the Supabase REST + Auth admin API
- **python-jose** for verifying Supabase JWTs (HS256 with the project's JWT secret)
- **pytest** for tests

## Layout

```
backend/
├── pyproject.toml          # deps, tool config
├── README.md               # You are here.
├── .env.example            # env template (safe to commit)
├── .env                    # real secrets (git-ignored)
├── .env.test               # test project secrets (git-ignored)
├── app/
│   ├── __init__.py
│   ├── main.py             # create_app() — FastAPI entry point
│   ├── settings.py         # pydantic-settings loader
│   ├── errors.py           # APIError + handlers (TDD §10 shape)
│   ├── security.py         # JWT verification → get_current_user
│   ├── supabase_clients.py # admin & anon client factories
│   ├── routes/
│   │   ├── auth.py         # /auth/signup, /auth/login, /auth/logout, /auth/me
│   │   ├── child.py        # /child/me, /child/streak
│   │   ├── parent.py       # /parent/children, /parent/settings
│   │   └── problems.py     # /problems, /problems/attempt, /problems/hint
│   ├── schemas/
│   │   ├── auth.py         # Pydantic request/response models for /auth/*
│   │   ├── parent.py       # Pydantic request/response models for /parent/* and /child/*
│   │   └── problems.py     # Pydantic request/response models for /problems/*
│   └── models/
│       └── user.py         # SQLAlchemy User — documentation-only mirror of public.users
└── tests/
    ├── conftest.py
    └── test_auth.py
```

## Quick start

From `backend/`:

```bash
# 1. Create and activate a venv (Windows bash)
python3 -m venv .venv
source .venv/Scripts/activate

# 2. Install deps
pip install -e ".[dev]"

# 3. Configure
cp .env.example .env
# edit .env and fill in the four SUPABASE_* vars

# 4. Apply the DB migrations in order (from the Supabase SQL editor):
#    - supabase/migrations/0001_create_users.sql
#    - supabase/migrations/0002_users_display_name_and_hardened_trigger.sql
#    - supabase/migrations/0003_grant_users_table.sql
#    - supabase/migrations/0004_create_parent_settings.sql
#    - supabase/migrations/0005_create_children.sql
#    - supabase/migrations/0006_parent_deletion_cascade.sql
#    - supabase/migrations/0007_backfill_parent_settings.sql
#    - supabase/migrations/0008_add_grade_to_children.sql
#    - supabase/migrations/0009_create_tricks.sql
#    - supabase/migrations/0010_create_problems.sql
#    - supabase/migrations/0011_create_sessions.sql
#    - supabase/migrations/0012_create_trick_discoveries.sql

# 5. Run
uvicorn app.main:app --reload --port 8000
```

Swagger UI at <http://localhost:8000/docs> (dev only).

## Environment variables

See `.env.example` for the full list.

| Var                         | Who reads it        | Sensitivity        |
| --------------------------- | ------------------- | ------------------ |
| `SUPABASE_URL`              | admin + anon client | public             |
| `SUPABASE_ANON_KEY`         | anon client         | public             |
| `SUPABASE_SERVICE_ROLE_KEY` | admin client        | **SECRET**         |
| `SUPABASE_JWT_SECRET`       | security.py         | **SECRET**         |
| `CORS_ORIGINS`              | main.py             | —                  |
| `APP_ENV`                   | main.py             | —                  |

## /auth endpoints

| Method + path        | Auth     | Purpose                                                     |
| -------------------- | -------- | ----------------------------------------------------------- |
| `POST /auth/signup`  | none     | Create a parent account (children cannot self-register).    |
| `POST /auth/login`   | none     | Exchange email + password for an access + refresh token. Works for both parent and child accounts. |
| `POST /auth/refresh` | refresh  | Rotate the access/refresh token pair.                       |
| `POST /auth/logout`  | bearer   | Revoke the caller's refresh token (kill all their sessions). |
| `GET  /auth/me`      | bearer   | Return `public.users` row for the caller.                   |

## /parent endpoints

All `/parent/*` endpoints require a parent bearer token. Role is read
from `public.users` on every call (TDD §9.1) — a child's token gets a
`403 forbidden_role` regardless of what its claims say.

| Method + path             | Auth         | Purpose                                                              |
| ------------------------- | ------------ | -------------------------------------------------------------------- |
| `POST  /parent/children`  | parent       | Create a child account. Calls `admin.create_user` with `app_metadata.role='child'` and inserts the matching `public.children` row. Rolls back the auth user on downstream failure. |
| `GET   /parent/children`  | parent       | List all children belonging to the caller. Returns `{ children: [ChildProfile, ...] }`. Empty list if no children yet. |
| `GET   /parent/settings`  | parent       | Read the parent's `public.parent_settings` row (auto-created at signup). |
| `PATCH /parent/settings`  | parent       | Partial-update settings. Server-managed counters (`stars_earned`, `stars_redeemed`, `last_notified_at`) are **not** writable here. |

Error shape follows TDD §10.1 exactly: `{ "error", "code", "status" }`.
Known codes are in [app/errors.py](app/errors.py).

Full flow diagrams: [../docs/auth-flow.md](../docs/auth-flow.md).

## /child endpoints

All `/child/*` endpoints require a **child** bearer token. A parent token gets `403 forbidden_role`.

| Method + path         | Auth  | Purpose |
| --------------------- | ----- | ------- |
| `GET /child/me`       | child | Return the caller's combined `ChildProfile` (merges `public.users` + `public.children`). |
| `GET /child/streak`   | child | Return `{ streak_current, streak_best }` — lightweight read without fetching the full profile. |
| `PATCH /child/streak` | child | Body `{ correct: bool }`. Increments `streak_current` (and promotes `streak_best`) when `correct=true`; resets `streak_current` to 0 when `correct=false`. Returns `{ streak_current, streak_best }`. Uses SELECT-after-UPDATE. |

## /problems endpoints

All `/problems/*` endpoints require a **child** bearer token. Role is read
from `public.users` on every call — a parent token gets `403 forbidden_role`.

| Method + path             | Auth  | Purpose |
| ------------------------- | ----- | ------- |
| `GET   /problems`         | child | Fetch up to 5 random problems for a zone. Query params: `zone` (required), `difficulty` (optional override, capped at parent ceiling), `exclude_ids` (optional UUID list). Answer and shortcut columns are never selected. |
| `POST  /problems/attempt` | child | Submit an answer. Verifies server-side. Awards coins with insight multipliers (3×/1×/0.7×/0.5×/0.3× of base 10). Enforces 300-coin daily cap. Updates streak. Fires trick unlock at 3 insight detections. |
| `POST  /problems/hint`    | child | Request hint tier 1/2/3. Deducts cost (0/5/15 coins) before returning hint text. |

Key design notes:
- `answer`, `shortcut_path`, `shortcut_time_threshold_ms` are never returned. Column projection is explicit in every query against `public.problems`.
- Sessions are created implicitly on first attempt (`POST /problems/session` endpoint is TODO).
- `insight_detected`: correct + `hint_level_used == 0` + `duration_ms < shortcut_time_threshold_ms`.
- Coins and hint costs are separate DB writes; the daily cap is only enforced on the attempt path.

Full flow diagrams: [../docs/problems-flow.md](../docs/problems-flow.md).

## Security rules of the road

1. **The service_role key never leaves this process.** Never log it,
   never return it, never bundle it.
2. **Role is read from the DB on every request that depends on it** (see
   `_fetch_profile` in `routes/auth.py`). Never trust a role in the
   client-supplied JWT claims (TDD §9.1).
3. **SC-06 is enforced by the DB trigger**, not by this code alone.
   `raw_app_meta_data` (service-role-only writable) drives role
   assignment; public signups always become parents. See
   `supabase/migrations/0002_*.sql`.
4. **Error messages for `/auth/login` are intentionally identical** for
   unknown-email and wrong-password — do not special-case one of them,
   or you leak account existence.

## Running tests

The tests are **integration tests**. They hit a real Supabase project.

1. Create a `.env.test` next to `.env` with the dev project credentials.
2. In that Supabase dashboard, **disable email confirmation** under
   *Authentication → Providers → Email → Confirm email*. Signup tests
   need an active session immediately.
3. `pytest` (from `backend/`).

The suite auto-skips if env vars are missing, so it's safe to run in CI
before secrets are configured.

## Deployment (later)

The plan per the TDD is Vercel. Vercel supports Python as serverless
functions: we'll wrap the ASGI app in `api/index.py` at the repo root
and configure `vercel.json` accordingly. That lands when the Vercel
account is provisioned.

# Supabase — MathQuest

This directory is the **source of truth** for the MathQuest database schema.
The schema is expressed as raw SQL migrations in [`migrations/`](migrations/)
and applied to the Supabase-hosted Postgres instance.

> ⚠️ Do not edit the schema from the Supabase dashboard. Changes made in the
> dashboard are not tracked in git. Always add a new migration file.

---

## Contents

- [Layout](#layout)
- [Environment](#environment)
- [The `users` table](#the-users-table)
  - [Why `public.users` references `auth.users`](#why-publicusers-references-authusers)
  - [Signup flow and the `handle_new_user` trigger](#signup-flow-and-the-handle_new_user-trigger)
  - [Constraints and invariants](#constraints-and-invariants)
- [The `parent_settings` table](#the-parent_settings-table)
- [The `children` table](#the-children-table)
- [The `tricks` table](#the-tricks-table)
- [The `problems` table](#the-problems-table)
- [The `sessions` table](#the-sessions-table)
- [The `trick_discoveries` table](#the-trick_discoveries-table)
- [Parent deletion cascade](#parent-deletion-cascade)
- [Row-Level Security (RLS)](#row-level-security-rls)
  - [Threat model](#threat-model)
  - [Policies on `public.users`](#policies-on-publicusers)
  - [Policies on `public.parent_settings`](#policies-on-publicparent_settings)
  - [Policies on `public.children`](#policies-on-publicchildren)
  - [Policies on gameplay tables](#policies-on-gameplay-tables)
  - [How to test RLS](#how-to-test-rls)
- [Applying migrations](#applying-migrations)
- [Conventions for new migrations](#conventions-for-new-migrations)

---

## Layout

```
supabase/
├── .env              # DO NOT COMMIT. DATABASE_URL and DB_PASSWORD live here.
├── README.md         # You are here.
└── migrations/
    ├── 0001_create_users.sql
    ├── 0002_users_display_name_and_hardened_trigger.sql
    ├── 0003_grant_users_table.sql
    ├── 0004_create_parent_settings.sql
    ├── 0005_create_children.sql
    ├── 0006_parent_deletion_cascade.sql
    ├── 0007_backfill_parent_settings.sql
    ├── 0008_add_grade_to_children.sql
    ├── 0009_create_tricks.sql
    ├── 0010_create_problems.sql
    ├── 0011_create_sessions.sql
    └── 0012_create_trick_discoveries.sql
```

---

## Environment

`.env` is git-ignored (see the root [`.gitignore`](../.gitignore)). It holds:

| Variable       | Purpose                                                       |
| -------------- | ------------------------------------------------------------- |
| `DATABASE_URL` | Direct Postgres connection string (used by `psql`, Alembic…). |
| `DB_PASSWORD`  | The DB password component of `DATABASE_URL`.                  |

The Next.js app never uses `DATABASE_URL` directly; it goes through the
Supabase JS client using the public `SUPABASE_URL` + `SUPABASE_ANON_KEY`.

---

## The `users` table

Source: [`migrations/0001_create_users.sql`](migrations/0001_create_users.sql).

| Column           | Type          | Notes                                                             |
| ---------------- | ------------- | ----------------------------------------------------------------- |
| `id`             | `uuid` PK     | Matches `auth.users.id`. Cascaded delete from `auth.users`.       |
| `email`          | `text` UNIQUE | Synced from `auth.users.email` at signup.                         |
| `role`           | `text`        | `'parent'` or `'child'` (CHECK constraint).                       |
| `parent_id`      | `uuid` FK     | Self-reference → `public.users.id`. `NULL` for parents.           |
| `display_name`   | `text`        | Length 1..80. Parent: from signup form. Child: from admin create. |
| `created_at`     | `timestamptz` | Default `now()`.                                                  |
| `last_active_at` | `timestamptz` | Default `now()`. Updated from the app on tracked user actions.    |

Indexes: `role`, `parent_id`, `created_at`, `last_active_at`. `email` is
already indexed by its UNIQUE constraint.

### Why `public.users` references `auth.users`

Supabase ships a built-in `auth` schema with `auth.users`, which handles
passwords, sessions, OAuth, magic links, and password resets. We do **not**
reimplement any of that. Instead, we keep application-facing data
(`role`, `parent_id`, etc.) in our own `public.users` table, joined 1:1 by a
shared `id`.

Benefits:

- `auth.users` is managed by Supabase; we never touch it directly.
- RLS policies on `public.users` can reference `auth.uid()` (the id from the
  JWT) and compare it to `public.users.id` for free.
- Deleting an auth account (`auth.users` row) cascades to `public.users`,
  so there is no orphaned state.

### Signup flow and the `handle_new_user` trigger

```
    Client                 Supabase Auth                  Postgres
      │                         │                            │
      │  signUp(email, pw,      │                            │
      │    options.data = {     │                            │
      │      role, parent_id    │                            │
      │    })                   │                            │
      ├────────────────────────►│                            │
      │                         │  INSERT INTO auth.users    │
      │                         │  (…, raw_user_meta_data)   │
      │                         ├───────────────────────────►│
      │                         │                            │
      │                         │                 TRIGGER    │
      │                         │                 on_auth_   │
      │                         │                 user_      │
      │                         │                 created    │
      │                         │                    │       │
      │                         │                    ▼       │
      │                         │            handle_new_user │
      │                         │            (SECURITY       │
      │                         │             DEFINER)       │
      │                         │                    │       │
      │                         │            INSERT INTO     │
      │                         │            public.users    │
      │                         │            (id, email,     │
      │                         │             role,          │
      │                         │             parent_id)     │
      │                         │                            │
      │  session / error        │                            │
      │◄────────────────────────┤                            │
```

**Two sources of metadata, and only one of them is trusted.**

| Metadata field          | Writable by                | Read by trigger for          |
| ----------------------- | -------------------------- | ---------------------------- |
| `raw_user_meta_data`    | Any caller of `auth.signUp()` (including end users) | `display_name`       |
| `raw_app_meta_data`     | Service role only (admin API) | `role`, `parent_id`       |

This split is how we enforce **SC-06** ("Child self-registration is blocked
at system level"). A user calling `auth.signUp()` from the browser can
only influence `raw_user_meta_data`; they cannot set `role='child'` from
there. Role is always derived from `raw_app_meta_data`, which only the
FastAPI backend (holding `SUPABASE_SERVICE_ROLE_KEY`) can write.

```python
# Parent signup — public. display_name from the form.
#   role defaults to 'parent' because no app_metadata is set.
supabase.auth.sign_up({
    "email": email,
    "password": password,
    "options": {"data": {"display_name": name}},
})

# Child creation — admin only. Called by the FastAPI backend once the
# parent is authenticated.
admin_supabase.auth.admin.create_user({
    "email": email,
    "password": password,
    "email_confirm": True,
    "app_metadata": {
        "role": "child",
        "parent_id": str(parent_id),
        "display_name": child_name,   # duplicated here; trigger reads either.
    },
})
```

If metadata is invalid (e.g. a `role='child'` payload somehow reaches the
trigger without a `parent_id`), the `public.users` insert fails via the
CHECK constraint and the whole `auth.users` insert rolls back. Intentional —
we never want an auth account without a profile row.

The trigger runs as `SECURITY DEFINER` so it can write to `public.users`
even while RLS is enabled; `search_path` is pinned inside the function to
avoid the well-known search-path hijack on `SECURITY DEFINER` functions.

### Constraints and invariants

Enforced at the database so no application bug can violate them:

- `role IN ('parent', 'child')`.
- `role='child'` ↔ `parent_id IS NOT NULL`.
- `role='parent'` ↔ `parent_id IS NULL`.
- `email` unique across the table.
- `display_name` between 1 and 80 characters.
- Deleting the `auth.users` row deletes the `public.users` row
  (`ON DELETE CASCADE`).
- Deleting a parent's `public.users` row cascade-deletes their children's
  `public.users` rows (`ON DELETE CASCADE` on `parent_id`, set in
  migration 0006). See [Parent deletion cascade](#parent-deletion-cascade)
  for the residual `auth.users` gap.

---

## The `parent_settings` table

Source: [`migrations/0004_create_parent_settings.sql`](migrations/0004_create_parent_settings.sql).

A 1:1 extension of `public.users` for parents. Holds every parent-
configurable knob from TDD §7.4 / §10.3 — time limits, difficulty caps,
the star-economy threshold, audio volume, notification email.

| Column                 | Type          | Default | Notes                                                         |
| ---------------------- | ------------- | ------- | ------------------------------------------------------------- |
| `id`                   | `uuid` PK     | `gen_random_uuid()` | —                                                 |
| `parent_id`            | `uuid` FK UNIQUE | —    | → `public.users.id`. Cascade-deletes with the user.           |
| `daily_limit_mins`     | `integer`     | 45      | TDD §10.3.1 default. CHECK 0..1440.                           |
| `session_limit_mins`   | `integer`     | 30      | TDD §10.3.1 default. CHECK 0..1440.                           |
| `auto_scaling`         | `boolean`     | `true`  | When false, difficulty is fixed at `children.current_difficulty`. |
| `difficulty_ceiling`   | `integer`     | 10      | CHECK 1..10. 10 = no practical cap.                           |
| `star_threshold_coins` | `integer`     | 500     | Coins required per star.                                      |
| `stars_earned`         | `integer`     | 0      | Server-managed; monotonic.                                    |
| `stars_redeemed`       | `integer`     | 0      | CHECK `stars_redeemed <= stars_earned`.                       |
| `audio_volume`         | `integer`     | 80     | CHECK 0..100. Children cannot override.                       |
| `notification_email`   | `text`        | parent's login email | Set by the trigger from `users.email`; parent can change.    |
| `last_notified_at`     | `timestamptz` | `null`  | Bookkeeping for the notification scheduler.                   |
| `created_at`           | `timestamptz` | `now()` | —                                                             |
| `updated_at`           | `timestamptz` | `now()` | Auto-bumped on every UPDATE by `parent_settings_set_updated_at`. |

**Auto-creation at signup.** Migration 0004 extends `handle_new_user()` so
that every new parent (any signup path — `/auth/signup`, direct
`anon.auth.sign_up`, etc.) gets a default `parent_settings` row in the
same transaction as their `public.users` row. The PATCH endpoint
(`/parent/settings`) therefore never has to handle a missing row.

---

## The `children` table

Source: [`migrations/0005_create_children.sql`](migrations/0005_create_children.sql).

A 1:1 extension of `public.users` for child profiles. Holds gameplay
state — zone progress, coin/XP balance, streaks, daily caps — distinct
from the auth identity in `users`.

| Column                | Type          | Default | Notes                                                         |
| --------------------- | ------------- | ------- | ------------------------------------------------------------- |
| `id`                  | `uuid` PK     | `gen_random_uuid()` | —                                                 |
| `user_id`             | `uuid` FK UNIQUE | —    | → `public.users.id`. Cascade-deletes with the user.           |
| `avatar_id`           | `integer`     | `null`  | Integer key into the client-side avatar registry.             |
| `current_zone`        | `integer`     | 1       | CHECK 1..5.                                                   |
| `coins`               | `integer`     | 0       | CHECK ≥ 0. Server-mutated only.                               |
| `total_xp`            | `integer`     | 0       | CHECK ≥ 0. Monotonic.                                         |
| `difficulty_ceiling`  | `integer`     | 10      | CHECK 1..10. App enforces ≤ `parent_settings.difficulty_ceiling`. |
| `date_of_birth`       | `date`        | `null`  | Optional, parent-supplied at creation.                        |
| `streak_current`      | `integer`     | 0       | CHECK ≥ 0.                                                    |
| `streak_best`         | `integer`     | 0       | CHECK `streak_best >= streak_current`.                        |
| `daily_coins_earned`  | `integer`     | 0       | CHECK ≥ 0. **TDD §6.4 daily cap of 300 is enforced in the API**, not the schema (this column resets daily). |
| `daily_coins_reset_at`| `timestamptz` | `now()` | Reset-clock for the daily cap.                                |
| `grade`               | `integer`     | 2       | School grade level CHECK 1..12. Parent-supplied at creation; default 2 (age-7 lower bound). |
| `current_difficulty`  | `integer`     | 1       | CHECK 1..10. Adaptive engine writes here.                     |
| `created_at`          | `timestamptz` | `now()` | —                                                             |

**Lifecycle.** `INSERT` is backend-only, from `POST /parent/children`,
after the parent's bearer token is verified and `admin.create_user()`
has produced the matching `auth.users` + `public.users` rows. We do
**not** auto-insert from the trigger because (a) the children row needs
business data not in auth metadata (date_of_birth, avatar_id), and
(b) there is no public-signup path for children (SC-06).

---

## The `tricks` table

Source: [`migrations/0009_create_tricks.sql`](migrations/0009_create_tricks.sql).

Static catalog of math shortcut tricks. Seeded with 17 codes at migration time; new tricks are added manually. Read-only from the client.

| Column        | Type   | Notes |
| ------------- | ------ | ----- |
| `id`          | `text` PK | Short code, e.g. `'A1'`, `'B2'`. Referenced by `problems.trick_ids[]` and `trick_discoveries.trick_id`. |
| `name`        | `text` | Human-readable name shown in the journal. |
| `category`    | `text` | `multiplication \| mental_math \| number_theory \| pattern \| algebra \| sequences` |
| `description` | `text` | One-sentence explanation of the shortcut. |

Seeded codes: A1 (×11), A2 (×9), A3 (perfect squares), A5 (consecutive odds), A6 (diff of squares), A7 (×25), B1 (parity), B4 (modular arithmetic), B5 (div by 9), C1 (chunking), C2 (complement pairs), C3 (near-benchmark), C4 (near-doubles), C5 (×5 halving), C7 (grouping), D4 (geometric series), D5 (triangular numbers).

---

## The `problems` table

Source: [`migrations/0010_create_problems.sql`](migrations/0010_create_problems.sql).

Problem catalog. Seeded with 40 canonical problems from TDD §08 (Zones 1–4, difficulties 1–9). When the AI model is integrated, new rows will be inserted here by the `GET /problems` handler before being returned to the client.

> ⚠️ **Security:** `answer`, `shortcut_path`, and `shortcut_time_threshold_ms` are stored here for server-side verification only. They must **never** be selected in client-facing queries. The API always names columns explicitly — never `SELECT *` on this table from a route handler.

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | `uuid` PK | `gen_random_uuid()`. Stable after insert; sent to the client for attempt/hint requests. |
| `zone` | `integer` | CHECK 1..5. |
| `category` | `text` | `arithmetic \| pattern \| invariant \| mental \| structural \| algebraic` |
| `difficulty` | `integer` | CHECK 1..10. |
| `trick_ids` | `text[]` | Trick codes this problem exercises (references `tricks.id` by convention; no FK since array FKs aren't native in Postgres). |
| `stem` | `text` | Problem statement shown to the child. |
| `answer` | `text` | **Server-only.** Stored as text; cast per `answer_type` for comparison. |
| `answer_type` | `text` | `exact \| range \| set`. `exact` = float comparison; `set` = case-insensitive string match. |
| `shortcut_path` | `text` | **Server-only.** Explanation of the trick route. |
| `shortcut_time_threshold_ms` | `integer` | **Server-only.** Duration below which a correct, hint-free response triggers `insight_detected`. |
| `brute_force_path` | `text` | Explanation of the long route (internal). |
| `hints` | `jsonb` | `[{level, text, cost}]` — three tiers always present. Costs: 0 / 5 / 15 coins. |
| `aha_moment` | `text` | One-line insight description for the trick-card journal. |
| `flavor_text` | `text` | Narrative story context. |
| `tags` | `text[]` | Topic tags (e.g. `['multiplication', 'x9', 'zone-2']`). |
| `base_coins` | `integer` | Default 10. Multiplied by the attempt-scoring table. |
| `created_at` | `timestamptz` | `now()`. |

Index: `(zone, difficulty)` for the `GET /problems` filter query.

---

## The `sessions` table

Source: [`migrations/0011_create_sessions.sql`](migrations/0011_create_sessions.sql).

One row per gameplay session. The `id` is a client-generated UUID that the frontend includes with every `POST /problems/attempt` and `POST /problems/hint` request.

> `POST /problems/session` (explicit session creation) is **TODO**. Until it is built, the attempt handler creates the row implicitly on first use.

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | `uuid` PK | Client-generated; no server default. |
| `child_id` | `uuid` FK | → `public.children.id` (not `users.id`). Cascade-deletes with the child. |
| `started_at` | `timestamptz` | `now()`. |
| `ended_at` | `timestamptz` | Nullable; set when the session ends. |
| `is_active` | `boolean` | Default `true`. Attempt/hint endpoints reject inactive sessions. |

Index: `child_id`.

---

## The `trick_discoveries` table

Source: [`migrations/0012_create_trick_discoveries.sql`](migrations/0012_create_trick_discoveries.sql).

Per-child insight analytics per trick. Tracks how many times a child has demonstrated fast, correct, hint-free answers (insight detection) for a given trick. When `insight_count` reaches 3, the trick is unlocked and a journal card appears in the UI.

Also serves as the `unlocked_tricks` list sent to the AI model when integrated.

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | `uuid` PK | `gen_random_uuid()`. |
| `child_id` | `uuid` FK | → `public.children.id`. Cascade-deletes with the child. |
| `trick_id` | `text` FK | → `public.tricks.id`. |
| `insight_count` | `integer` | Default 0. Incremented each time insight is detected for this trick. CHECK ≥ 0. |
| `unlocked` | `boolean` | Default `false`. Set to `true` when `insight_count` reaches 3. |
| `unlocked_at` | `timestamptz` | Nullable. Timestamp of the unlock event. |
| `first_seen_at` | `timestamptz` | `now()` at row creation. |
| `last_insight_at` | `timestamptz` | Nullable. Timestamp of the most recent insight detection. |

Unique constraint: `(child_id, trick_id)` — one row per child per trick.

---

## Parent deletion cascade

Source: [`migrations/0006_parent_deletion_cascade.sql`](migrations/0006_parent_deletion_cascade.sql).

Product intent (confirmed 2026-04-27): deleting a parent deletes their
children. Migration 0006 expresses this by changing the `parent_id` FK
from `ON DELETE SET NULL` to `ON DELETE CASCADE`. The chain on a parent
deletion is:

```
auth.users (parent)
   └── (CASCADE) public.users (parent)
                    └── (CASCADE on parent_id) public.users (each child)
                                                  └── (CASCADE) public.children (each child)
                    └── (CASCADE on parent_id)  public.parent_settings (parent)
```

**Known gap.** This chain does **not** climb back to `auth.users` for
the children — their auth rows survive the cascade. Until the
account-deletion endpoint exists, there is no public way to delete a
parent in production, so the gap is latent. When that endpoint is built,
it must call `admin.delete_user()` for each child first, then the
parent.

---

## Row-Level Security (RLS)

### Threat model

The Supabase `anon` and `authenticated` API keys are **public** — they ship
in the browser bundle. Anyone can hit the REST/GraphQL/Realtime endpoints
with those keys. The only thing standing between an attacker and the data
is Postgres Row-Level Security.

Assume the anon key is known to the public. RLS must be:

1. **Enabled** on every table in `public`.
2. **Deny-by-default**: any table without a policy rejects all reads and
   writes from anon/authenticated roles.
3. Written as `USING` (which rows are visible/targetable) **plus**
   `WITH CHECK` on INSERT/UPDATE (what the row may look like after the
   write), since `USING` alone does not stop a user from mutating a row
   into a state they shouldn't own.

The `service_role` key bypasses RLS entirely and must **never** ship to the
browser. It is only used in server-side code (Next.js route handlers /
server actions / future Python backend).

### Policies on `public.users`

RLS is enabled. Four policies are defined — an end user acting via the
`authenticated` role sees the following:

| Action   | Policy                          | Effect                                                  |
| -------- | ------------------------------- | ------------------------------------------------------- |
| `SELECT` | `users_select_self`             | Read own row (`id = auth.uid()`).                       |
| `SELECT` | `users_select_own_children`     | A parent reads their children (`parent_id = auth.uid()`). |
| `UPDATE` | `users_update_self`             | Update own row. `WITH CHECK` pins the id to the caller. |
| `INSERT` | *(none)*                        | **Denied.** Rows are created only by the auth trigger.  |
| `DELETE` | *(none)*                        | **Denied.** Rows are removed only via cascade from `auth.users`. |

A child has **no read access to their parent's row**, which matches the
product intent (children see their own progress; parents see their
children's). If that changes, add a policy like:

```sql
create policy "users_select_own_parent"
  on public.users for select
  using (id = (select parent_id from public.users where id = auth.uid()));
```

### Policies on `public.parent_settings`

| Action | Policy                          | Effect                                                  |
| ------ | ------------------------------- | ------------------------------------------------------- |
| SELECT | `parent_settings_select_self`   | Parent reads own row (`parent_id = auth.uid()`).        |
| UPDATE | `parent_settings_update_self`   | Parent updates own row. `WITH CHECK` pins parent_id.    |
| INSERT | *(none)*                        | **Denied.** Rows created only by `handle_new_user()` trigger. |
| DELETE | *(none)*                        | **Denied.** Rows removed only via cascade.              |

### Policies on `public.children`

| Action | Policy                                | Effect                                                          |
| ------ | ------------------------------------- | --------------------------------------------------------------- |
| SELECT | `children_select_self`                | Child reads own row (`user_id = auth.uid()`).                   |
| SELECT | `children_select_owned_by_parent`     | Parent reads any of their children (joined via `users.parent_id`). |
| INSERT | *(none)*                              | **Denied.** Rows created only by `POST /parent/children` (service_role). |
| UPDATE | *(none)*                              | **Denied for end users.** Gameplay endpoints write via service_role. |
| DELETE | *(none)*                              | **Denied.** Rows removed only via cascade.                      |

Children have no UPDATE policy because direct writes to `coins`,
`total_xp`, `streak_*`, etc. would let a player tamper with their own
balance. Every gameplay mutation goes through the API, which validates
and writes via `service_role`.

### Policies on gameplay tables

`public.tricks` and `public.problems` are read-only for authenticated users; all writes go through `service_role`.

| Table | Action | Policy | Effect |
| ----- | ------ | ------ | ------ |
| `tricks` | SELECT | `tricks_select_authenticated` | Any authenticated user can read tricks (needed for the journal UI). |
| `problems` | SELECT | `problems_select_authenticated` | Any authenticated user can read problems (the API layer enforces column projection — answer never selected). |
| `sessions` | SELECT | `sessions_select_own` | A child reads sessions where `child_id` matches their own `children.id`. |
| `trick_discoveries` | SELECT | `trick_discoveries_select_own` | A child reads their own trick rows (same join pattern). |

INSERT / UPDATE / DELETE on all four tables: `service_role` only — no policy for authenticated means deny.

### How to test RLS

From the Supabase SQL editor, use `set local role` to impersonate an
end-user session:

```sql
-- Impersonate an authenticated user. Replace the UUID.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

-- Should return exactly one row (the caller's own).
select * from public.users;

-- Should return 0 rows even though the table has other data.
select * from public.users where id <> auth.uid() and parent_id is distinct from auth.uid();
```

Reset afterwards with `reset role;`.

---

## Applying migrations

There are three supported ways to apply a migration, depending on your
setup. Pick one and be consistent.

### Option A — Supabase SQL Editor (simplest, good for solo work)

1. Open the Supabase dashboard → your project → **SQL Editor**.
2. Paste the contents of the migration file.
3. Run.
4. Track in git which files have been applied; the dashboard keeps no
   history of this.

### Option B — `psql` against `DATABASE_URL` (good for scripting)

```bash
# From the project root
psql "$DATABASE_URL" -f supabase/migrations/0001_create_users.sql
```

Requires `psql` locally and the real password substituted into
`DATABASE_URL` (in `supabase/.env`, `[YOUR-PASSWORD]` is a placeholder).

### Option C — Supabase CLI (preferred once the project is shared)

```bash
supabase link --project-ref tsbmhewqshtcazkavwho
supabase db push
```

The CLI understands the `migrations/` folder layout natively and records
which migrations have been applied in the `supabase_migrations` schema.
Switch to this before a second contributor joins the project.

---

## Conventions for new migrations

- **Filename**: `NNNN_snake_case_description.sql`, zero-padded to 4 digits
  (`0002_add_children_table.sql`). Numbers must be monotonic — no gaps,
  no re-numbering after merge.
- **One concern per file**: one table, or one related change. Don't
  bundle unrelated work.
- **Reversibility**: for now we do not keep down-migrations; the database
  is young and rolling forward is cheap. Revisit once we have real data.
- **Always comment the table and columns** (`comment on table…`,
  `comment on column…`). These show up in the Supabase dashboard and are
  the cheapest form of documentation.
- **Always enable RLS** on new `public` tables, and add explicit policies.
  A table without policies denies everything from anon/authenticated,
  which is often what you want — but be explicit about it with a comment
  in the migration so the intent is recorded.
- **Never reference the service_role key from a migration.** Migrations
  run with superuser privileges during apply; authorization belongs in
  policies, not in the migration body.

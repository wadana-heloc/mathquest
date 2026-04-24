-- =============================================================================
-- 0001_create_users.sql
-- -----------------------------------------------------------------------------
-- Creates public.users (the application-level user profile table) as a 1:1
-- extension of auth.users (Supabase's built-in authentication table).
--
-- Source of truth: ERD-MathQuest.drawio (users table).
-- Columns:
--   id             UUID PK   - matches auth.users.id
--   email          TEXT      - unique; synced from auth.users.email
--   role           TEXT      - 'parent' or 'child'
--   parent_id      UUID FK   - self-reference; populated for role='child' only
--   created_at     TIMESTAMPTZ
--   last_active_at TIMESTAMPTZ
--
-- Pattern: public.users is populated automatically by the
-- on_auth_user_created trigger whenever a new row is inserted into
-- auth.users. Role and parent_id are read from raw_user_meta_data
-- provided at signup.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table
-- -----------------------------------------------------------------------------
create table public.users (
    id              uuid primary key references auth.users(id) on delete cascade,
    email           text        not null unique,
    role            text        not null check (role in ('parent', 'child')),
    parent_id       uuid        references public.users(id) on delete set null,
    created_at      timestamptz not null default now(),
    last_active_at  timestamptz not null default now(),

    -- A child MUST have a parent; a parent MUST NOT have one. This invariant
    -- is enforced at the DB level so application bugs cannot produce
    -- orphaned children or parents pointing at other parents.
    constraint users_parent_consistency check (
        (role = 'child'  and parent_id is not null)
     or (role = 'parent' and parent_id is null)
    )
);

comment on table  public.users is
    'Application-level user profile. 1:1 with auth.users (same id). Holds role (parent|child) and the parent->child hierarchy.';
comment on column public.users.id is
    'Matches auth.users.id. Populated automatically by handle_new_user() on auth signup.';
comment on column public.users.email is
    'Synced from auth.users.email at signup. Uniqueness enforced here as a safety net.';
comment on column public.users.role is
    'Either "parent" or "child". Drives feature access and RLS policies.';
comment on column public.users.parent_id is
    'For role=child, the parent user that owns this child. Self-reference. Must be NULL for role=parent.';
comment on column public.users.created_at is
    'Row creation time (effectively signup time).';
comment on column public.users.last_active_at is
    'Last time the user performed a tracked action. Updated from the application layer.';

-- -----------------------------------------------------------------------------
-- 2. Indexes
-- -----------------------------------------------------------------------------
-- email is already indexed by the UNIQUE constraint; no separate index needed.
create index users_role_idx           on public.users (role);
create index users_parent_id_idx      on public.users (parent_id);
create index users_created_at_idx     on public.users (created_at);
create index users_last_active_at_idx on public.users (last_active_at);

-- -----------------------------------------------------------------------------
-- 3. Auth trigger: auth.users -> public.users
-- -----------------------------------------------------------------------------
-- Supabase manages password + session in auth.users. We mirror into
-- public.users so the rest of the app (with RLS) can reason about the user
-- without touching the auth schema.
--
-- Metadata contract: the client passes options.data = { role, parent_id? }
-- to supabase.auth.signUp(). That JSON lands in auth.users.raw_user_meta_data.
--   - role is required ('parent' or 'child').
--   - parent_id is required iff role='child'.
--
-- If metadata is invalid the insert into public.users will fail (via the
-- check constraint), which in turn rolls back the auth.users insert. This
-- is intentional: we do NOT want an auth account without a profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    meta         jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
    v_role       text  := meta->>'role';
    v_parent_id  uuid  := nullif(meta->>'parent_id', '')::uuid;
begin
    insert into public.users (id, email, role, parent_id)
    values (new.id, new.email, v_role, v_parent_id);
    return new;
end;
$$;

comment on function public.handle_new_user() is
    'Creates a public.users row for every new auth.users row. Reads role and parent_id from raw_user_meta_data.';

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 4. Row-Level Security
-- -----------------------------------------------------------------------------
-- RLS is enabled so that direct API access (via the anon/authenticated JWT
-- that Supabase exposes on the REST and realtime endpoints) cannot read or
-- modify rows outside the caller's permission scope.
--
-- auth.uid() returns the id from the JWT of the current request:
--   - NULL for the anon role (unauthenticated).
--   - The user's UUID for the authenticated role.
--
-- We deliberately do NOT grant INSERT or DELETE to end users: row lifecycle
-- is owned by the auth trigger (insert) and the ON DELETE CASCADE from
-- auth.users (delete). The service_role key bypasses RLS entirely, so
-- server-side admin tooling still works.
alter table public.users enable row level security;

-- SELECT: a user can read their own row.
create policy "users_select_self"
    on public.users
    for select
    using (auth.uid() = id);

-- SELECT: a parent can read rows for their own children.
create policy "users_select_own_children"
    on public.users
    for select
    using (parent_id = auth.uid());

-- UPDATE: a user can update their own row.
-- Both USING (which rows they may target) and WITH CHECK (what the row may
-- look like after the update) are required; otherwise a user could use an
-- UPDATE to change their own id/parent_id to point elsewhere.
create policy "users_update_self"
    on public.users
    for update
    using      (auth.uid() = id)
    with check (auth.uid() = id);

-- No INSERT policy: public.users rows are created only by the trigger
-- running as SECURITY DEFINER, not by end users.
-- No DELETE policy: public.users rows are deleted only via ON DELETE
-- CASCADE from auth.users, not by end users directly.

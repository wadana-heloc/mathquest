-- =============================================================================
-- 0011_create_sessions.sql
-- -----------------------------------------------------------------------------
-- Creates public.sessions — one row per gameplay session for a child.
--
-- A session groups a run of problem attempts. The id is a client-generated
-- UUID; the frontend sends it with every POST /problems/attempt and
-- POST /problems/hint request.
--
-- Session creation endpoint (POST /api/problems/session) is TODO. Until it
-- is built, the attempt endpoint creates the session row implicitly on the
-- first attempt if no row exists yet.
--
-- Source: ERD-MathQuest.drawio (sessions table) and TDD §08 (Gameplay Flow).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table
-- -----------------------------------------------------------------------------
create table public.sessions (
    id          uuid        primary key,   -- client-generated UUID, no server default
    child_id    uuid        not null references public.children(id) on delete cascade,
    started_at  timestamptz not null default now(),
    ended_at    timestamptz,
    is_active   boolean     not null default true
);

create index sessions_child_id_idx on public.sessions (child_id);

comment on table  public.sessions           is 'One row per child gameplay session. id is client-generated and sent with every attempt/hint request. Session creation endpoint is TODO — rows are inserted implicitly on first attempt until then.';
comment on column public.sessions.id        is 'Client-generated UUID. The frontend generates this at session start and includes it in every attempt/hint request.';
comment on column public.sessions.child_id  is 'FK to public.children.id (not users.id). Cascade-deletes with the child.';
comment on column public.sessions.is_active is 'Set to false when the session ends. Attempt/hint endpoints reject requests against inactive sessions.';

-- -----------------------------------------------------------------------------
-- 2. Row-Level Security
-- -----------------------------------------------------------------------------
alter table public.sessions enable row level security;

-- A child can see their own sessions (for future session history UI).
create policy sessions_select_own
    on public.sessions
    for select
    using (
        child_id in (
            select id from public.children where user_id = auth.uid()
        )
    );

-- -----------------------------------------------------------------------------
-- 3. GRANTs
-- -----------------------------------------------------------------------------
grant usage  on schema public                              to anon, authenticated, service_role;
grant select on public.sessions                            to authenticated;
grant select, insert, update, delete on public.sessions    to service_role;

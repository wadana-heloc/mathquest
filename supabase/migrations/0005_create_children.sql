-- =============================================================================
-- 0005_create_children.sql
-- -----------------------------------------------------------------------------
-- Creates public.children — a 1:1 extension of public.users for child profiles.
-- Holds gameplay state (zone progress, coin/XP balance, streaks, daily caps)
-- distinct from the auth identity in users.
--
-- Lifecycle:
--   * INSERT — backend only, from POST /parent/children, after the parent's
--     bearer token is verified and admin.create_user() has produced the
--     auth.users + public.users rows for the new child. We do NOT auto-
--     insert from a trigger because (a) the children row needs business
--     data (date_of_birth, avatar_id) that isn't in auth metadata, and
--     (b) there is no public-signup path for children (SC-06).
--   * UPDATE — by the gameplay endpoints (server-side via service_role)
--     and to a limited extent by the parent (e.g. setting per-child
--     difficulty_ceiling). Children themselves do not write to this table.
--   * DELETE — only via ON DELETE CASCADE from public.users.
--
-- Daily coin cap (TDD §6.4): "Daily coin cap of 300 coins per day regardless
-- of activity, enforced on every credit transaction." That cap is enforced
-- in the API layer (POST /problems/attempt and friends), NOT as a CHECK on
-- daily_coins_earned, because daily_coins_earned legitimately resets to 0
-- at daily_coins_reset_at every 24h. See the column comment for a TODO
-- pointer when that endpoint lands.
--
-- Source: ERD-MathQuest.drawio (children table) and TDD §8.2.2 / §6.4.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table
-- -----------------------------------------------------------------------------
create table public.children (
    id                    uuid        primary key default gen_random_uuid(),

    -- 1:1 with public.users. UNIQUE enforces the relationship; cascade
    -- ensures the row dies with the user.
    user_id               uuid        not null unique
                                      references public.users(id) on delete cascade,

    -- Avatar pick is nullable — the child / parent picks one after creation
    -- (not on the create-child form). Integer key into a static avatar
    -- registry maintained client-side.
    avatar_id             integer,

    -- Zone 1..5 (TDD §6.1). New children always start in zone 1.
    current_zone          integer     not null default 1
                                      check (current_zone between 1 and 5),

    -- Coin balance. Mutated only by server-side coin ledger operations.
    coins                 integer     not null default 0
                                      check (coins >= 0),

    -- Lifetime experience points. Monotonic.
    total_xp              integer     not null default 0
                                      check (total_xp >= 0),

    -- Per-child difficulty cap. May be tightened below the parent's global
    -- ceiling (parent_settings.difficulty_ceiling) but the API layer must
    -- enforce that it never exceeds it (cross-table CHECKs aren't worth
    -- the complexity).
    difficulty_ceiling    integer     not null default 10
                                      check (difficulty_ceiling between 1 and 10),

    date_of_birth         date,

    -- Streaks: streak_current resets on a wrong answer; streak_best is
    -- monotonic. The CHECK keeps best >= current at all times.
    streak_current        integer     not null default 0
                                      check (streak_current >= 0),
    streak_best           integer     not null default 0
                                      check (streak_best >= 0),
    constraint children_streak_best_ge_current
        check (streak_best >= streak_current),

    -- TDD §6.4: 300 coins/day cap is enforced in the API layer at every
    -- credit transaction. This column tracks the day-to-date total; reset
    -- happens when now() crosses daily_coins_reset_at.
    daily_coins_earned    integer     not null default 0
                                      check (daily_coins_earned >= 0),
    daily_coins_reset_at  timestamptz not null default now(),

    -- Adaptive difficulty target (1..10) within the parent's ceiling.
    -- Updated by the difficulty engine after each attempt.
    current_difficulty    integer     not null default 1
                                      check (current_difficulty between 1 and 10),

    created_at            timestamptz not null default now()
);

create index children_user_id_idx      on public.children (user_id);
create index children_current_zone_idx on public.children (current_zone);

comment on table public.children is
    '1:1 extension of public.users for child profiles. Holds gameplay state — zone, coins, XP, streaks, daily caps. One row per public.users row with role=child. Created by POST /parent/children; never inserted from the client.';
comment on column public.children.user_id is
    'FK to public.users.id (which itself FKs auth.users). Must reference a row with role=child (enforced at the API layer when inserting). Cascade-deletes with the user.';
comment on column public.children.avatar_id is
    'Integer key into the client-side avatar registry. Nullable until the child or parent picks one.';
comment on column public.children.current_zone is
    'Active zone (1–5) the child is currently playing in. New children start in zone 1.';
comment on column public.children.coins is
    'Current coin balance. Mutated only by server-side coin ledger code (TDD §6.4). Direct client UPDATE is blocked by RLS (no UPDATE policy for authenticated).';
comment on column public.children.total_xp is
    'Lifetime XP earned. Monotonic — never decremented even on profile reset.';
comment on column public.children.difficulty_ceiling is
    'Per-child difficulty cap (1–10). API layer must enforce difficulty_ceiling <= parent_settings.difficulty_ceiling for the owning parent.';
comment on column public.children.streak_current is
    'Current consecutive correct-answer streak. Resets to 0 on a wrong answer.';
comment on column public.children.streak_best is
    'All-time best streak. CHECK: streak_best >= streak_current.';
comment on column public.children.daily_coins_earned is
    'Coins earned since daily_coins_reset_at. The TDD §6.4 daily cap of 300 is enforced at the API layer on every credit transaction (POST /problems/attempt, etc.) — TODO when that endpoint is built.';
comment on column public.children.daily_coins_reset_at is
    'When daily_coins_earned was last reset. Server resets at the local-midnight rollover for the child''s timezone (TBD — for MVP we use UTC midnight).';
comment on column public.children.current_difficulty is
    'Current adaptive difficulty target (1–10). Bounded above by min(this.difficulty_ceiling, parent_settings.difficulty_ceiling).';

-- -----------------------------------------------------------------------------
-- 2. Row-Level Security
-- -----------------------------------------------------------------------------
-- Two SELECT routes:
--   * The child reads their own row (user_id = auth.uid()).
--   * The parent reads any of their children's rows (joining users.parent_id).
-- INSERT/UPDATE/DELETE are reserved for service_role — no policy = deny.
alter table public.children enable row level security;

create policy children_select_self
    on public.children
    for select
    using (user_id = auth.uid());

create policy children_select_owned_by_parent
    on public.children
    for select
    using (
        exists (
            select 1
              from public.users u
             where u.id        = public.children.user_id
               and u.parent_id = auth.uid()
        )
    );

-- -----------------------------------------------------------------------------
-- 3. GRANTs
-- -----------------------------------------------------------------------------
-- service_role bypasses RLS but NOT GRANTs (see 0003). authenticated needs
-- SELECT only — all writes go through service_role from the backend.
grant usage on schema public                          to anon, authenticated, service_role;
grant select, insert, update, delete on public.children to service_role;
grant select                          on public.children to authenticated;
-- anon: no grants.

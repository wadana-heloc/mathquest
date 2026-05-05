-- =============================================================================
-- 0016_create_problem_attempts.sql
-- -----------------------------------------------------------------------------
-- Creates public.problem_attempts — one row per child per problem (upserted
-- on each re-attempt).
--
-- This table was planned in AGENTS.md as a TODO pending the AI engineer
-- completing her model. It serves three purposes:
--
--   1. AI recommender input — the candidate SQL query excludes problems the
--      child has already solved (solved_correctly = true) and marks unsolved
--      ones as previously_failed for the scorer's retry bonus.
--
--   2. Difficulty adjuster input — recent_performance is built from the last
--      10 rows ordered by answered_at for the child's current difficulty.
--
--   3. Hint-sequence enforcement (future) — once problem_attempts tracks
--      which hint tiers have been used per attempt, POST /problems/hint can
--      enforce that tier 1 must be requested before tier 2, etc.
--
-- UPSERT pattern: ON CONFLICT (child_id, problem_id) DO UPDATE. This means
-- one row per child–problem pair; re-attempts update the existing row.
-- `attempts` is an integer counter that increments on each upsert so the
-- full attempt count is preserved without multiple rows.
--
-- solved_correctly and previously_failed can both be true if the child got
-- it wrong on an earlier attempt (previously_failed) and then solved it
-- correctly later (solved_correctly). The recommender needs this because
-- previously_failed problems get a retry bonus even after they are solved.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table
-- -----------------------------------------------------------------------------
create table public.problem_attempts (
    id                uuid        primary key default gen_random_uuid(),
    child_id          uuid        not null references public.children(id) on delete cascade,
    problem_id        uuid        not null references public.problems(id) on delete cascade,
    solved_correctly  boolean     not null,
    previously_failed boolean     not null default false,
    hints_used        integer     not null default 0 check (hints_used >= 0),
    duration_ms       integer     check (duration_ms >= 0),
    attempts          integer     not null default 1 check (attempts >= 1),
    answered_at       timestamptz not null default now(),

    unique (child_id, problem_id)
);

-- Supports recent-performance queries:
-- WHERE child_id = :id ORDER BY answered_at DESC LIMIT 10
-- The UNIQUE (child_id, problem_id) constraint creates its own implicit index;
-- this additional index covers the time-ordered access pattern.
create index problem_attempts_child_answered_idx
    on public.problem_attempts (child_id, answered_at desc);

-- -----------------------------------------------------------------------------
-- 2. Column documentation
-- -----------------------------------------------------------------------------
comment on table  public.problem_attempts                        is 'Per-child attempt record for each problem. One row per (child, problem) pair; re-attempts upsert and increment the attempts counter. Source of truth for recommender candidate filtering and difficulty adjuster recent_performance input.';
comment on column public.problem_attempts.solved_correctly       is 'True if the child ever answered this problem correctly. Set on each upsert; once true stays true.';
comment on column public.problem_attempts.previously_failed      is 'True if the child answered this problem incorrectly at least once before. Set to true on a wrong answer, never reset. Recommender adds retry bonus to previously_failed candidates.';
comment on column public.problem_attempts.hints_used             is 'Number of hint tiers used on the most recent attempt (0–3).';
comment on column public.problem_attempts.duration_ms            is 'Time taken on the most recent attempt in milliseconds.';
comment on column public.problem_attempts.attempts               is 'Total number of answer submissions for this (child, problem) pair across all sessions.';
comment on column public.problem_attempts.answered_at            is 'Timestamp of the most recent attempt. Used to order recent_performance for the adjuster.';

-- -----------------------------------------------------------------------------
-- 3. Row-Level Security
-- -----------------------------------------------------------------------------
alter table public.problem_attempts enable row level security;

-- A child can read their own attempt history (needed for the journal/progress UI).
create policy problem_attempts_select_own
    on public.problem_attempts
    for select
    using (
        child_id in (
            select id from public.children where user_id = auth.uid()
        )
    );

-- -----------------------------------------------------------------------------
-- 4. GRANTs
-- -----------------------------------------------------------------------------
grant usage  on schema public                                      to anon, authenticated, service_role;
grant select on public.problem_attempts                            to authenticated;
grant select, insert, update, delete on public.problem_attempts    to service_role;

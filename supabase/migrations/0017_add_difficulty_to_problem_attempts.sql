-- =============================================================================
-- 0017_add_difficulty_to_problem_attempts.sql
-- -----------------------------------------------------------------------------
-- Adds `difficulty` to public.problem_attempts.
--
-- The difficulty adjuster needs recent_performance filtered by difficulty:
--   SELECT ... FROM problem_attempts WHERE child_id = :id AND difficulty = :d
--
-- Storing difficulty here (denormalised from problems.difficulty) avoids a
-- JOIN on every attempt. problems.difficulty is immutable once set, so the
-- denormalisation is safe.
--
-- Nullable because rows inserted before this migration do not have difficulty.
-- The backend always populates it going forward.
-- =============================================================================

alter table public.problem_attempts
    add column difficulty integer check (difficulty between 1 and 10);

-- Replace the existing time-only index with one that covers the
-- difficulty-filtered recent-performance query pattern.
drop index if exists problem_attempts_child_answered_idx;

create index problem_attempts_child_diff_answered_idx
    on public.problem_attempts (child_id, difficulty, answered_at desc);

comment on column public.problem_attempts.difficulty is 'Denormalised from problems.difficulty. Used to filter recent_performance by difficulty without a JOIN. Always set by the backend on insert.';

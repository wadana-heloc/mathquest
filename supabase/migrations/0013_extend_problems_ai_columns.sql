-- =============================================================================
-- 0013_extend_problems_ai_columns.sql
-- -----------------------------------------------------------------------------
-- Adds three columns to public.problems to support AI-generated problem
-- ingestion and the recommender's candidate-filtering query.
--
-- All three columns are NULLABLE so the 40 existing seeded problems are
-- unaffected. AI-generated problems must populate all three on INSERT.
--
-- grade     — grade level the problem was authored for (1–12). Used in the
--             candidate SQL query: WHERE grade = :child_grade. Distinct from
--             children.grade (which says which grade the child is in); this
--             column says which grade the problem was designed for.
--
-- phase_tag — "discovery" or "practice". Discovery problems introduce a trick
--             concept; practice problems drill it. The recommender applies a
--             +25 score bonus (WEIGHT_PHASE_FIT) to problems matching the
--             child's current phase. Without this column the recommender
--             cannot differentiate problem types.
--
-- trick_id  — The single primary trick this problem targets (A1–D5). The
--             existing trick_ids text[] column supports multi-trick problems
--             from the seeded set; AI-generated problems always have exactly
--             one primary trick and set this column for indexed lookups.
--
-- A composite index on (trick_id, difficulty, grade) is added to support the
-- efficient candidate-filtering query executed on every GET /problems call.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. New columns
-- -----------------------------------------------------------------------------
alter table public.problems
    add column grade      integer  check (grade between 1 and 12),
    add column phase_tag  text     check (phase_tag in ('discovery', 'practice')),
    add column trick_id   text     references public.tricks(id);

-- -----------------------------------------------------------------------------
-- 2. Index for AI candidate queries
-- -----------------------------------------------------------------------------
-- Supports: WHERE trick_id = :t AND difficulty = :d AND grade = :g
create index problems_trick_difficulty_grade_idx
    on public.problems (trick_id, difficulty, grade)
    where trick_id is not null;

-- -----------------------------------------------------------------------------
-- 3. Column documentation
-- -----------------------------------------------------------------------------
comment on column public.problems.grade     is 'Grade level this problem was written for (1–12). Set on AI-generated rows; NULL on the 40 seeded problems. Matched against children.grade at query time.';
comment on column public.problems.phase_tag is '"discovery" or "practice". Discovery problems introduce a trick concept; practice problems drill it. Used by the recommender for phase-fit scoring (+25 bonus on match).';
comment on column public.problems.trick_id  is 'Primary trick targeted by this problem (A1–D5). Singular companion to trick_ids[]. Set on AI-generated rows for indexed candidate queries.';

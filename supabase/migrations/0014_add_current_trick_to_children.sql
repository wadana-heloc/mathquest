-- =============================================================================
-- 0014_add_current_trick_to_children.sql
-- -----------------------------------------------------------------------------
-- Adds current_trick to public.children.
--
-- The AI difficulty adjuster and problem recommender need to know which trick
-- the child is currently working on in order to filter candidates and update
-- phase state after each answer. The children table already tracks
-- current_zone and current_difficulty; this column completes the picture.
--
-- NULL means the child has not yet been assigned a trick (new account or
-- first session). GET /problems assigns the first eligible trick (via
-- difficulty_engine.get_eligible_tricks()) and writes it here before
-- querying candidates.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. New column
-- -----------------------------------------------------------------------------
alter table public.children
    add column current_trick text references public.tricks(id);

-- -----------------------------------------------------------------------------
-- 2. Column documentation
-- -----------------------------------------------------------------------------
comment on column public.children.current_trick is 'The trick the child is currently working on (A1–D5). NULL until first problem is served. Updated by POST /problems/attempt when process_answer() returns trick_update.';

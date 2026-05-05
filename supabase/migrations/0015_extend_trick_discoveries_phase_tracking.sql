-- =============================================================================
-- 0015_extend_trick_discoveries_phase_tracking.sql
-- -----------------------------------------------------------------------------
-- Adds pedagogical phase tracking columns to public.trick_discoveries.
--
-- The existing trick_discoveries table tracks insight detection for the TDD
-- §06 unlock mechanic (insight_count, unlocked). This migration adds a
-- separate set of columns for the AI recommender's phase model without
-- touching the existing columns.
--
-- Phase model (from AI engineer's BACKEND_CONTRACT.md):
--   discovery — child encounters problems designed to reveal the trick concept.
--               Ends after DISCOVERY_PROBLEMS_REQUIRED (2) problems are served.
--               Triggers a "reveal" animation after which the child moves to
--               practice phase.
--   practice  — child drills the trick with standard problems. Mastery is
--               checked after MIN_PRACTICE_PROBLEMS correct answers at ≥ 80%
--               correct rate, at which point the child advances to the next
--               trick's discovery phase.
--
-- Counter lifecycle:
--   discovery_problems_seen     — incremented when a discovery problem is SERVED
--                                 (not after the answer — "seen" means shown).
--   practice_problems_solved    — incremented only on a CORRECT answer in
--                                 practice phase.
--   practice_problems_attempted — incremented on EVERY answer in practice
--                                 phase (correct and wrong).
--   All three reset to 0 when the child advances to a new trick (new row).
--
-- These columns are NOT NULL with safe defaults so existing rows (created
-- by the insight-detection mechanic before this migration) are initialised
-- with discovery phase at zero counters, which is correct for any trick that
-- has not yet been formally worked through the phase model.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. New columns
-- -----------------------------------------------------------------------------
alter table public.trick_discoveries
    add column current_phase               text     not null default 'discovery'
                                                    check (current_phase in ('discovery', 'practice')),
    add column discovery_problems_seen     integer  not null default 0
                                                    check (discovery_problems_seen >= 0),
    add column practice_problems_solved    integer  not null default 0
                                                    check (practice_problems_solved >= 0),
    add column practice_problems_attempted integer  not null default 0
                                                    check (practice_problems_attempted >= 0);

-- -----------------------------------------------------------------------------
-- 2. Column documentation
-- -----------------------------------------------------------------------------
comment on column public.trick_discoveries.current_phase               is '"discovery" or "practice". Discovery ends after 2 problems served; practice ends on mastery or MAX_PROBLEMS_PER_TRICK attempts.';
comment on column public.trick_discoveries.discovery_problems_seen     is 'Count of discovery-phase problems served for this trick (incremented at serve time, not after answer). Resets to 0 on trick advance.';
comment on column public.trick_discoveries.practice_problems_solved    is 'Correct answers in practice phase for this trick. Resets to 0 on trick advance.';
comment on column public.trick_discoveries.practice_problems_attempted is 'All answers (correct + wrong) in practice phase. Cap check: advance forced at MAX_PROBLEMS_PER_TRICK (7). Resets to 0 on trick advance.';

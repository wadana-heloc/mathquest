-- =============================================================================
-- 0008_add_grade_to_children.sql
-- -----------------------------------------------------------------------------
-- Adds a grade column to public.children.
--
-- grade: school grade level (1–12). Default 2 covers the typical starting
-- grade for the 7-year-old lower bound of MathQuest's target audience
-- (TDD §1). Parents supply the child's actual grade at account creation
-- (POST /parent/children); the default fires only if the field is omitted.
-- =============================================================================

alter table public.children
    add column grade integer not null default 2
        check (grade between 1 and 12);

comment on column public.children.grade is
    'School grade level (1–12). Supplied by the parent at child account creation. Default 2 matches the youngest target audience (age 7, TDD §1).';

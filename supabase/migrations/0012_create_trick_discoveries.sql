-- =============================================================================
-- 0012_create_trick_discoveries.sql
-- -----------------------------------------------------------------------------
-- Creates public.trick_discoveries — per-child insight analytics per trick.
--
-- Each row tracks how many times a child has triggered insight detection
-- (fast, correct, no hints) for a given trick. When insight_count reaches 3
-- the trick is marked unlocked and the child's journal entry for that trick
-- becomes available.
--
-- This table is also the source of truth for the "unlocked_tricks" list
-- sent to the AI model when it is integrated (filtered where unlocked = true).
--
-- Source: ERD-MathQuest.drawio (trick_discoveries table) and TDD §06.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table
-- -----------------------------------------------------------------------------
create table public.trick_discoveries (
    id              uuid        primary key default gen_random_uuid(),
    child_id        uuid        not null references public.children(id) on delete cascade,
    trick_id        text        not null references public.tricks(id),
    insight_count   integer     not null default 0 check (insight_count >= 0),
    unlocked        boolean     not null default false,
    unlocked_at     timestamptz,
    first_seen_at   timestamptz not null default now(),
    last_insight_at timestamptz,

    unique (child_id, trick_id)
);

create index trick_discoveries_child_id_idx on public.trick_discoveries (child_id);

comment on table  public.trick_discoveries                  is 'Per-child analytics for each trick: insight count, unlock status. A trick unlocks after 3 insight detections (correct + fast + no hints). Used by AI model as unlocked_tricks context.';
comment on column public.trick_discoveries.child_id         is 'FK to public.children.id. Cascade-deletes with the child.';
comment on column public.trick_discoveries.trick_id         is 'FK to public.tricks.id (short code e.g. A1).';
comment on column public.trick_discoveries.insight_count    is 'How many times insight was detected for this trick. Unlock fires at 3.';
comment on column public.trick_discoveries.unlocked         is 'True when insight_count reached 3. Triggers trick-card animation on the frontend.';
comment on column public.trick_discoveries.last_insight_at  is 'Timestamp of the most recent insight detection. Used for analytics.';

-- -----------------------------------------------------------------------------
-- 2. Row-Level Security
-- -----------------------------------------------------------------------------
alter table public.trick_discoveries enable row level security;

-- A child can see their own trick discoveries (for the journal UI).
create policy trick_discoveries_select_own
    on public.trick_discoveries
    for select
    using (
        child_id in (
            select id from public.children where user_id = auth.uid()
        )
    );

-- -----------------------------------------------------------------------------
-- 3. GRANTs
-- -----------------------------------------------------------------------------
grant usage  on schema public                                         to anon, authenticated, service_role;
grant select on public.trick_discoveries                              to authenticated;
grant select, insert, update, delete on public.trick_discoveries      to service_role;

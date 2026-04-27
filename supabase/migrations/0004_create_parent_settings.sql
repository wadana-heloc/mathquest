-- =============================================================================
-- 0004_create_parent_settings.sql
-- -----------------------------------------------------------------------------
-- Creates public.parent_settings — a 1:1 extension of public.users for parents.
-- Holds every parent-configurable knob from TDD §7.4 / §10.3:
--   - time limits   (daily_limit_mins, session_limit_mins)
--   - difficulty    (auto_scaling, difficulty_ceiling)
--   - rewards       (star_threshold_coins, stars_earned, stars_redeemed)
--   - audio         (audio_volume)
--   - notifications (notification_email, last_notified_at)
--
-- Lifecycle:
--   * INSERT — driven by the handle_new_user() trigger (extended below) so
--     that EVERY parent — including those created via direct anon.signUp() —
--     gets a settings row with sensible defaults. The PATCH /parent/settings
--     endpoint never has to handle a missing row.
--   * UPDATE — by the parent themselves through the API (RLS-allowed) or by
--     the backend via service_role.
--   * DELETE — only via ON DELETE CASCADE from public.users (which itself
--     cascades from auth.users).
--
-- Source of truth: ERD-MathQuest.drawio (parent_settings table) and
-- MathQuest_TDD_v1.1.docx §7.4 / §10.3 / §6.4.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table
-- -----------------------------------------------------------------------------
create table public.parent_settings (
    id                    uuid        primary key default gen_random_uuid(),

    -- One settings row per parent. UNIQUE makes the 1:1 relationship
    -- enforceable at the DB; ON DELETE CASCADE keeps the row's lifetime
    -- tied to the parent it belongs to.
    parent_id             uuid        not null unique
                                      references public.users(id) on delete cascade,

    -- Time limits. TDD §10.3.1 default 45 min/day, 30 min/session.
    daily_limit_mins      integer     not null default 45
                                      check (daily_limit_mins   between 0 and 1440),
    session_limit_mins    integer     not null default 30
                                      check (session_limit_mins between 0 and 1440),

    -- Difficulty. auto_scaling=true means the engine adapts to performance;
    -- difficulty_ceiling caps that, with 10 = "no cap" (the system tops out
    -- at 10 anyway).
    auto_scaling          boolean     not null default true,
    difficulty_ceiling    integer     not null default 10
                                      check (difficulty_ceiling between 1 and 10),

    -- Star economy (TDD §6.4): coins convert to stars at a parent-set rate.
    star_threshold_coins  integer     not null default 500
                                      check (star_threshold_coins > 0),
    stars_earned          integer     not null default 0
                                      check (stars_earned   >= 0),
    stars_redeemed        integer     not null default 0
                                      check (stars_redeemed >= 0),
    constraint parent_settings_redeemed_le_earned
        check (stars_redeemed <= stars_earned),

    audio_volume          integer     not null default 80
                                      check (audio_volume between 0 and 100),

    -- Notification address. Defaults to the parent's login email at insert
    -- time (set by the trigger). Parent can change this later.
    notification_email    text,
    last_notified_at      timestamptz,

    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now()
);

create index parent_settings_parent_id_idx on public.parent_settings (parent_id);

comment on table public.parent_settings is
    '1:1 extension of public.users for parents. One row per parent, auto-created at signup by handle_new_user(). Holds time limits, difficulty caps, reward thresholds, audio, and notification settings.';
comment on column public.parent_settings.parent_id is
    'FK to public.users.id. Must reference a row with role=parent (enforced by the trigger). Cascade-deletes with the user.';
comment on column public.parent_settings.daily_limit_mins is
    'Maximum minutes per day a child of this parent can play. TDD §10.3.1 default: 45. 0 = no play allowed; 1440 = 24h cap (effectively unlimited).';
comment on column public.parent_settings.session_limit_mins is
    'Maximum minutes per single session. TDD §10.3.1 default: 30.';
comment on column public.parent_settings.auto_scaling is
    'When true, problem difficulty auto-scales with child performance. When false, difficulty is fixed at children.current_difficulty.';
comment on column public.parent_settings.difficulty_ceiling is
    'Hard cap on problem difficulty (1–10) regardless of auto_scaling. Default 10 = no practical cap. Per-child children.difficulty_ceiling may be tighter but never higher.';
comment on column public.parent_settings.star_threshold_coins is
    'Coins required to convert into 1 star. Default 500. Stars are a parent-issued physical reward currency (TDD §6.4).';
comment on column public.parent_settings.stars_earned is
    'Lifetime stars earned across this parent''s children. Server-managed; never decremented.';
comment on column public.parent_settings.stars_redeemed is
    'Lifetime stars marked redeemed by the parent. CHECK: stars_redeemed <= stars_earned.';
comment on column public.parent_settings.audio_volume is
    'Default game audio volume 0–100. TDD §10.3 specifies children cannot override.';
comment on column public.parent_settings.notification_email is
    'Email used for parent notifications (boss-clears, weekly summaries). Defaults to users.email at insert; parent can change without affecting login email.';
comment on column public.parent_settings.last_notified_at is
    'Bookkeeping for the notification scheduler. NULL until the first notification is sent.';

-- -----------------------------------------------------------------------------
-- 2. updated_at touch trigger
-- -----------------------------------------------------------------------------
-- Generic helper, but namespaced to this table so we don't pollute the public
-- schema with a global-purpose trigger function before we have a second
-- consumer.
create or replace function public.parent_settings_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

create trigger parent_settings_set_updated_at
    before update on public.parent_settings
    for each row
    execute function public.parent_settings_touch_updated_at();

comment on function public.parent_settings_touch_updated_at() is
    'Bumps parent_settings.updated_at on every UPDATE.';

-- -----------------------------------------------------------------------------
-- 3. Extend handle_new_user() to also create the parent_settings row
-- -----------------------------------------------------------------------------
-- We keep this in handle_new_user (rather than a second trigger or in the
-- API) so that EVERY parent gets a settings row, even those born through
-- a direct anon.auth.sign_up() (e.g. the SC-06 test). It also keeps the
-- PATCH endpoint's contract simple — the row is guaranteed to exist.
--
-- The function still resolves role/parent_id from raw_app_meta_data per
-- SC-06 (see 0002). The only addition is the conditional INSERT into
-- parent_settings when v_role='parent'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    app_meta  jsonb := coalesce(new.raw_app_meta_data,  '{}'::jsonb);
    user_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);

    v_role      text := coalesce(app_meta->>'role', 'parent');
    v_parent_id uuid := nullif(app_meta->>'parent_id', '')::uuid;

    v_display_name text := coalesce(
        user_meta->>'display_name',
        app_meta->>'display_name',
        split_part(new.email, '@', 1)
    );
begin
    insert into public.users (id, email, role, parent_id, display_name)
    values (new.id, new.email, v_role, v_parent_id, v_display_name);

    -- Auto-provision parent_settings for new parents. Defaults defined on
    -- the table; we override notification_email so it ships pre-filled to
    -- the parent's login email. The parent can change it later.
    if v_role = 'parent' then
        insert into public.parent_settings (parent_id, notification_email)
        values (new.id, new.email);
    end if;

    return new;
end;
$$;

comment on function public.handle_new_user() is
    'Creates a public.users row for every new auth.users row. For parents, also seeds a default public.parent_settings row. Reads role/parent_id from raw_app_meta_data (service_role only, per SC-06); reads display_name from raw_user_meta_data.';

-- -----------------------------------------------------------------------------
-- 4. Row-Level Security
-- -----------------------------------------------------------------------------
-- The parent reads/updates their own row. INSERT and DELETE are reserved
-- for the trigger and the cascade respectively — no policy means deny for
-- anon/authenticated, which is what we want.
alter table public.parent_settings enable row level security;

create policy parent_settings_select_self
    on public.parent_settings
    for select
    using (parent_id = auth.uid());

create policy parent_settings_update_self
    on public.parent_settings
    for update
    using      (parent_id = auth.uid())
    with check (parent_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 5. GRANTs
-- -----------------------------------------------------------------------------
-- service_role bypasses RLS but NOT GRANTs (see 0003). Without these the
-- backend admin client gets `permission denied for table parent_settings`.
grant usage on schema public                                to anon, authenticated, service_role;
grant select, insert, update, delete on public.parent_settings to service_role;
grant select, update                  on public.parent_settings to authenticated;
-- anon: no grants. Logged-out users have no business reading settings.

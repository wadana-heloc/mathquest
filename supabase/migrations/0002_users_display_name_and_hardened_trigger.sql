-- =============================================================================
-- 0002_users_display_name_and_hardened_trigger.sql
-- -----------------------------------------------------------------------------
-- 1. Add users.display_name (collected from the signup form).
-- 2. Harden handle_new_user() to read role + parent_id from raw_app_meta_data
--    (only settable by the service_role key) instead of raw_user_meta_data
--    (settable by anyone calling auth.signUp()). This closes SC-06: a public
--    signup can no longer create role='child' by crafting metadata.
-- 3. Default role for public signups is 'parent'. Child accounts are created
--    exclusively via the admin API (service_role) from the backend.
--
-- Source of truth for requirements: MathQuest_TDD_v1.1.docx §9.1 and
-- MathQuest_Permissions_Matrix_v2.xlsx, Server Constraints SC-06 and SC-13.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. display_name
-- -----------------------------------------------------------------------------
-- Collected on the parent signup form ("YOUR NAME" field). For child accounts
-- created later by a parent, this holds the child's in-game display name
-- (used in the parent analytics dashboard).
alter table public.users
    add column display_name text;

-- Backfill any rows that pre-date this migration with the local part of the
-- email so the NOT NULL constraint below does not fail. In practice the
-- database is empty at this point (no signups have happened), but the
-- migration must be idempotent-safe for any dev environment that did poke
-- rows in by hand.
update public.users
   set display_name = split_part(email, '@', 1)
 where display_name is null;

alter table public.users
    alter column display_name set not null;

-- Length guard: keep names in a sane range for UI layout and to prevent
-- abusive signup payloads. 1..80 mirrors common product defaults.
alter table public.users
    add constraint users_display_name_length
    check (char_length(display_name) between 1 and 80);

comment on column public.users.display_name is
    'Human-readable name shown in the UI. For parents: the name entered on the signup form. For children: the in-game name the parent chose when creating the child account.';

-- -----------------------------------------------------------------------------
-- 2. Hardened trigger: read role + parent_id from raw_app_meta_data
-- -----------------------------------------------------------------------------
-- Why raw_app_meta_data (not raw_user_meta_data)?
--
--   - raw_user_meta_data is writable by the end user via auth.signUp()
--     options.data. Anyone could craft { role: 'child', parent_id: <uuid> }
--     and self-register as a child linked to any parent. That violates
--     SC-06 (child self-registration is blocked at system level).
--
--   - raw_app_meta_data is writable ONLY by the service_role (admin API).
--     A public signUp() call cannot set it. Our FastAPI backend, using the
--     SUPABASE_SERVICE_ROLE_KEY, calls auth.admin.create_user(app_metadata={...})
--     when a parent creates a child. That's the only path by which a
--     role='child' row can be born.
--
-- display_name stays in raw_user_meta_data: the user is trusted to provide
-- their own display name on their own signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    app_meta  jsonb := coalesce(new.raw_app_meta_data,  '{}'::jsonb);
    user_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);

    -- Role defaults to 'parent' so a public signup with no app_metadata
    -- always produces a parent. Children require service_role-set app_meta.
    v_role      text := coalesce(app_meta->>'role', 'parent');
    v_parent_id uuid := nullif(app_meta->>'parent_id', '')::uuid;

    -- display_name is taken from user_metadata first (what the signup form
    -- passes), falling back to app_metadata (what the admin API passes when
    -- a parent creates a child), falling back to the email local part so
    -- the NOT NULL constraint is satisfied even for programmatic inserts
    -- during testing.
    v_display_name text := coalesce(
        user_meta->>'display_name',
        app_meta->>'display_name',
        split_part(new.email, '@', 1)
    );
begin
    insert into public.users (id, email, role, parent_id, display_name)
    values (new.id, new.email, v_role, v_parent_id, v_display_name);
    return new;
end;
$$;

comment on function public.handle_new_user() is
    'Creates a public.users row for every new auth.users row. Reads role and parent_id from raw_app_meta_data (service_role only, per SC-06). Reads display_name from raw_user_meta_data (signup form).';

-- The trigger itself was created in 0001 and does not need re-creation;
-- CREATE OR REPLACE FUNCTION above is enough. Nothing else to do here.

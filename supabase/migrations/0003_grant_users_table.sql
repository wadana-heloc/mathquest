-- =============================================================================
-- 0003_grant_users_table.sql
-- -----------------------------------------------------------------------------
-- Adds the Postgres-level GRANTs that let Supabase's three built-in roles
-- reach public.users.
--
-- Why this is needed separately from RLS: Postgres checks privileges in two
-- stages. First the caller's role must have the SQL privilege on the table
-- (GRANT SELECT / INSERT / ...). Only if that passes does it evaluate RLS
-- policies. The service_role key bypasses RLS — but it does NOT bypass
-- GRANTs. Without these, every query from the backend returns
--
--     postgrest.exceptions.APIError:
--         { "message": "permission denied for table users", "code": "42501" }
--
-- Supabase's default privileges usually grant these automatically for new
-- tables, but not every project is configured that way. Being explicit
-- here means the migration works on any project, regardless of default
-- privilege state.
-- =============================================================================

-- Schema usage: all three roles need to see the 'public' schema itself.
grant usage on schema public to anon, authenticated, service_role;

-- service_role: full access. Bypasses RLS. Used by the backend admin client.
grant select, insert, update, delete on public.users to service_role;

-- authenticated: an end user logged in via Supabase Auth. Still subject to
-- RLS policies defined in 0001. They can see/update their own row and a
-- parent can see their children's rows; anything else is blocked by RLS
-- regardless of this GRANT.
grant select, update on public.users to authenticated;

-- anon: no grants. Signups go through the backend admin client, not
-- through anon/REST. Logged-out users have nothing to read here.
-- (Explicit non-grant: do nothing.)

-- Sanity check you can run after applying:
--   select has_table_privilege('service_role',  'public.users', 'SELECT');  -- expect true
--   select has_table_privilege('authenticated', 'public.users', 'SELECT');  -- expect true
--   select has_table_privilege('anon',          'public.users', 'SELECT');  -- expect false

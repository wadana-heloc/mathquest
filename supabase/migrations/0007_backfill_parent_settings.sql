-- =============================================================================
-- 0007_backfill_parent_settings.sql
-- -----------------------------------------------------------------------------
-- Migration 0004 added parent_settings + extended handle_new_user() to
-- auto-seed a settings row at signup. That trigger only fires on NEW
-- auth.users INSERTs — any parent that existed in the database BEFORE 0004
-- was applied has a public.users row but no public.parent_settings row.
--
-- This migration backfills those rows. Idempotent: ON CONFLICT DO NOTHING
-- so re-running on a project where every parent already has a settings
-- row is a no-op.
--
-- All non-key columns get their table-level defaults (45 / 30 / true / 10 /
-- 500 / 0 / 0 / 80). notification_email is seeded from users.email so the
-- legacy parent matches what a fresh signup would produce.
-- =============================================================================

insert into public.parent_settings (parent_id, notification_email)
select u.id, u.email
  from public.users u
 where u.role = 'parent'
on conflict (parent_id) do nothing;

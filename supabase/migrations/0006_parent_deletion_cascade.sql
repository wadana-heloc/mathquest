-- =============================================================================
-- 0006_parent_deletion_cascade.sql
-- -----------------------------------------------------------------------------
-- Resolves the open TODO documented in supabase/README.md ("Constraints and
-- invariants"): the existing public.users.parent_id FK had ON DELETE SET NULL,
-- which on a parent deletion would null-out the children's parent_id and
-- immediately violate users_parent_consistency (which requires
-- role='child' iff parent_id IS NOT NULL).
--
-- Product intent (confirmed 2026-04-27): when a parent is deleted, their
-- children are deleted too. We express this at the FK with ON DELETE CASCADE,
-- so deleting the parent's public.users row cascades to the children's
-- public.users rows (which in turn cascades to public.children and
-- public.parent_settings via their own FKs).
--
-- KNOWN GAP: the children's auth.users rows are NOT deleted by this cascade —
-- the cascade chain runs auth.users -> public.users -> public.users (via
-- parent_id), but it does not climb back to auth.users for the children.
-- That gap will be closed when the account-deletion endpoint is built; it
-- will delete each child's auth.users row first (via admin.delete_user),
-- then the parent's. Until that endpoint exists, there is no public way to
-- delete a parent in production, so the gap is latent.
-- =============================================================================

-- Re-create the FK with the new behavior. There is no syntax to alter just
-- the ON DELETE clause — drop + add is the supported path.
alter table public.users
    drop constraint users_parent_id_fkey;

alter table public.users
    add constraint users_parent_id_fkey
    foreign key (parent_id)
    references public.users(id)
    on delete cascade;

comment on column public.users.parent_id is
    'For role=child, the parent user that owns this child. Self-reference. Must be NULL for role=parent. ON DELETE CASCADE: deleting a parent deletes their children''s public.users rows. Note: auth.users rows for the children must be cleaned up by the account-deletion endpoint (TODO).';

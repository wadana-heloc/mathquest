-- 0021 was applied without a service_role GRANT, so the admin client
-- hit "permission denied for table stories" on INSERT. Same pattern as
-- 0003 for public.users.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO service_role;

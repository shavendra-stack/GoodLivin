-- GoodLivin Stage 1 corrective migration
--
-- RLS policies define which rows an authenticated user may access, but
-- PostgreSQL table privileges still must allow the authenticated role to
-- reach those policies. The identity and role tables were missing those
-- privileges, causing getCurrentUser() to receive permission errors and
-- fall back to an unassigned session.
--
-- No anonymous privileges are added. Existing RLS policies remain the row
-- and operation boundary, and existing audit triggers are unchanged.

begin;

grant select on public.roles, public.permissions, public.role_permissions,
  public.profiles, public.user_roles to authenticated;

grant insert, update on public.profiles to authenticated;
grant insert, delete on public.user_roles to authenticated;

commit;

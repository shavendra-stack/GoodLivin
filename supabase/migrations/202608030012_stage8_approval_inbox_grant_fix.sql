-- GoodLivin Stage 8 corrective migration
--
-- The Stage 8 approval inbox view reads public.approval_records under the
-- current authenticated user so existing RLS policies remain active. Stage 1
-- created RLS policies for approval_records but did not grant the table-level
-- SELECT privilege required by PostgreSQL before RLS can be evaluated.
--
-- Safe to rerun. Does not weaken RLS, alter approval decisions, or change data.

begin;

grant select on public.approval_records to authenticated;
grant select on public.operational_approval_inbox to authenticated;

comment on view public.operational_approval_inbox is
  'Stage 8 central approval inbox. Reads existing workflow records under current-user RLS and does not approve, reject, post, receive, dispatch or reverse records.';

do $$
begin
  if not has_table_privilege('authenticated', 'public.approval_records', 'SELECT') then
    raise exception 'Stage 8 approval inbox fix did not grant SELECT on public.approval_records to authenticated';
  end if;

  if not has_table_privilege('authenticated', 'public.operational_approval_inbox', 'SELECT') then
    raise exception 'Stage 8 approval inbox fix did not grant SELECT on public.operational_approval_inbox to authenticated';
  end if;
end $$;

notify pgrst, 'reload schema';

commit;

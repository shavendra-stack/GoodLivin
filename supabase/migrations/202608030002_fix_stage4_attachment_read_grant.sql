-- Stage 4 corrective migration: the attachments RLS policy existed, but the
-- authenticated role had no table-level SELECT privilege. That caused the
-- optional attachment lookup and the movement-history lookup to fail parts
-- of the Stage 4 workspace.
--
-- Keep RLS enabled and unchanged. The existing attachments_read policy still
-- decides which rows an authenticated user may see.
begin;

grant select on public.attachments to authenticated;
grant select on public.stock_movements to authenticated;

-- Ensure newly created Stage 4 relations/functions are visible to the
-- PostgREST schema cache after a manual SQL Editor deployment.
notify pgrst, 'reload schema';

commit;

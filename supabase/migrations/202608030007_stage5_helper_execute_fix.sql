-- Stage 5 helper execution correction.
-- The aggregate views remain security-invoker views so their existing RLS
-- policies continue to scope results. Their restricted security-definer
-- helpers therefore need an explicit, permission-gated execute grant.

begin;

create or replace function public.stage5_available_quantity(p_product_id uuid, p_batch_id uuid, p_location_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (
    public.has_permission('inventory.view')
    or public.has_permission('sales.view')
    or public.has_permission('sell_through.view')
    or public.has_permission('replenishment.view')
  ) then
    raise exception 'You do not have permission to view stock quantities';
  end if;

  return (
    select coalesce(sum(case when destination_location_id = p_location_id then quantity else 0 end), 0)::integer
         - coalesce(sum(case when source_location_id = p_location_id then quantity else 0 end), 0)::integer
    from public.stock_movements
    where product_id = p_product_id
      and batch_id = p_batch_id
      and status = 'posted'
  );
end;
$$;

create or replace function public.stage5_deliveries_for_location(p_product_id uuid, p_sku_id uuid, p_location_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (
    public.has_permission('inventory.view')
    or public.has_permission('sales.view')
    or public.has_permission('sell_through.view')
    or public.has_permission('replenishment.view')
  ) then
    raise exception 'You do not have permission to view stock quantities';
  end if;

  return (
    select coalesce(sum(sm.quantity), 0)::integer
    from public.stock_movements sm
    where sm.product_id = p_product_id
      and sm.sku_id = p_sku_id
      and sm.destination_location_id = p_location_id
      and sm.status = 'posted'
      and sm.movement_type in ('receipt', 'transfer')
  );
end;
$$;

revoke all on function public.stage5_available_quantity(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.stage5_deliveries_for_location(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.stage5_available_quantity(uuid, uuid, uuid) to authenticated;
grant execute on function public.stage5_deliveries_for_location(uuid, uuid, uuid) to authenticated;

-- These helpers remain internal to the protected Stage 5 workflow RPCs.
revoke all on function public.stage5_pick_fefo(uuid, uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.stage5_validate_reference(uuid, uuid, uuid, uuid, date, boolean) from public, anon, authenticated;

commit;

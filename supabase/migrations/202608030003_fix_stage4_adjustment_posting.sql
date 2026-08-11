-- GoodLivin Stage 4 corrective migration: post adjustments atomically.
--
-- The original function attempted to insert a Director/Admin adjustment with
-- status = 'posted' before its movement_id existed. The table constraint
-- intentionally requires a posted adjustment to reference its immutable
-- movement, so the insert failed. This version creates the workflow row as
-- pending, creates the movement, and only then marks it posted.
--
-- The existing constraint, immutable movement trigger, RLS policies and audit
-- triggers remain unchanged. Re-running this migration is safe.

begin;

create or replace function public.create_stock_adjustment(
  p_adjustment_number text,
  p_adjustment_type text,
  p_direction text,
  p_location_id uuid,
  p_product_id uuid,
  p_sku_id uuid,
  p_batch_id uuid,
  p_quantity integer,
  p_unit_cost numeric,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  adjustment_id uuid;
  v_movement_id uuid;
  adjustment_status text;
begin
  if not public.has_permission('inventory.create') then
    raise exception 'You do not have permission to prepare adjustments';
  end if;
  if nullif(trim(p_adjustment_number), '') is null then
    raise exception 'Adjustment/reference number is required';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Adjustment quantity must be greater than zero';
  end if;
  if p_unit_cost is null or p_unit_cost < 0 then
    raise exception 'Unit cost cannot be negative';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'An adjustment reason is required';
  end if;
  if p_direction not in ('in', 'out') then
    raise exception 'Adjustment direction is invalid';
  end if;
  if public.has_role('warehouse_staff') and p_unit_cost <> 0 then
    raise exception 'Warehouse Staff cannot enter adjustment costs';
  end if;

  perform public.stage4_validate_reference(p_product_id, p_sku_id, p_batch_id, p_location_id);

  adjustment_status := case
    when public.has_permission('inventory.post') then 'posted'
    else 'pending'
  end;

  -- The row must be pending until the movement_id is available. The final
  -- update below satisfies the posted-row constraint without weakening it.
  perform set_config('goodlivin.stage4_internal', 'on', true);
  insert into public.stock_adjustments (
    adjustment_number,
    adjustment_type,
    direction,
    location_id,
    product_id,
    sku_id,
    batch_id,
    quantity,
    unit_cost,
    reason,
    status,
    created_by
  )
  values (
    trim(p_adjustment_number),
    p_adjustment_type,
    p_direction,
    p_location_id,
    p_product_id,
    p_sku_id,
    p_batch_id,
    p_quantity,
    p_unit_cost,
    trim(p_reason),
    'pending',
    auth.uid()
  )
  returning id into adjustment_id;

  if adjustment_status = 'posted' then
    insert into public.stock_movements (
      movement_type,
      status,
      product_id,
      sku_id,
      batch_id,
      source_location_id,
      destination_location_id,
      quantity,
      unit_cost,
      reference_type,
      reference_id,
      reason,
      created_by,
      posted_by,
      posted_at
    )
    values (
      case when p_direction = 'in' then 'adjustment_in' else 'adjustment_out' end,
      'posted',
      p_product_id,
      p_sku_id,
      p_batch_id,
      case when p_direction = 'out' then p_location_id else null end,
      case when p_direction = 'in' then p_location_id else null end,
      p_quantity,
      p_unit_cost,
      'stock_adjustment',
      adjustment_id,
      trim(p_reason),
      auth.uid(),
      auth.uid(),
      now()
    )
    returning id into v_movement_id;

    update public.stock_adjustments
    set status = 'posted',
        movement_id = v_movement_id,
        approved_by = auth.uid(),
        approved_at = now()
    where id = adjustment_id;
  end if;

  return adjustment_id;
end;
$$;

grant execute on function public.create_stock_adjustment(text, text, text, uuid, uuid, uuid, uuid, integer, numeric, text) to authenticated;

commit;

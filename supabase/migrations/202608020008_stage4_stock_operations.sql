-- GoodLivin Stage 4: stock receiving, transfers, adjustments and live balances
--
-- The Stage 1 stock_movements table remains the immutable source of truth.
-- Stage 4 document tables are workflow records; their posted movements are
-- created by security-definer transactions below. No balance is editable.

begin;

create table if not exists public.stock_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  supplier_id uuid references public.suppliers(id),
  manufacturer_id uuid references public.manufacturers(id),
  receiving_location_id uuid not null references public.inventory_locations(id),
  received_on date not null,
  product_id uuid not null references public.products(id),
  sku_id uuid not null references public.product_skus(id),
  batch_id uuid not null references public.product_batches(id),
  quantity integer not null check (quantity > 0),
  unit_cost numeric(14, 2) not null default 0 check (unit_cost >= 0),
  total_cost numeric(16, 2) generated always as (quantity * unit_cost) stored,
  attachment_id uuid references public.attachments(id),
  inspection_status text not null default 'passed' check (inspection_status in ('passed', 'pending', 'failed')),
  notes text,
  status text not null default 'posted' check (status in ('posted', 'cancelled')),
  movement_id uuid references public.stock_movements(id),
  created_by uuid not null references auth.users(id),
  posted_by uuid references auth.users(id),
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'posted' or posted_at is not null)
);

create table if not exists public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_number text not null unique,
  source_location_id uuid not null references public.inventory_locations(id),
  destination_location_id uuid not null references public.inventory_locations(id),
  transfer_date date not null,
  product_id uuid not null references public.products(id),
  sku_id uuid not null references public.product_skus(id),
  batch_id uuid not null references public.product_batches(id),
  quantity integer not null check (quantity > 0),
  status text not null default 'draft' check (status in ('draft', 'dispatched', 'received', 'cancelled')),
  dispatched_at timestamptz,
  dispatched_by uuid references auth.users(id),
  received_at timestamptz,
  received_by uuid references auth.users(id),
  dispatched_movement_id uuid references public.stock_movements(id),
  received_movement_id uuid references public.stock_movements(id),
  attachment_id uuid references public.attachments(id),
  override_reason text,
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_location_id <> destination_location_id),
  check (status = 'draft' or dispatched_at is not null),
  check (status <> 'received' or received_at is not null)
);

create table if not exists public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  adjustment_number text not null unique,
  adjustment_type text not null check (adjustment_type in ('physical_count', 'damaged_stock', 'expired_stock', 'sample_influencer_stock', 'promotional_event', 'return', 'other')),
  direction text not null check (direction in ('in', 'out')),
  location_id uuid not null references public.inventory_locations(id),
  product_id uuid not null references public.products(id),
  sku_id uuid not null references public.product_skus(id),
  batch_id uuid not null references public.product_batches(id),
  quantity integer not null check (quantity > 0),
  unit_cost numeric(14, 2) not null default 0 check (unit_cost >= 0),
  total_cost numeric(16, 2) generated always as (quantity * unit_cost) stored,
  reason text not null check (nullif(trim(reason), '') is not null),
  status text not null default 'pending' check (status in ('pending', 'posted', 'cancelled')),
  movement_id uuid references public.stock_movements(id),
  created_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'posted' or (approved_by is not null and approved_at is not null and movement_id is not null))
);

create index if not exists stock_receipts_received_on_idx on public.stock_receipts (received_on desc, created_at desc);
create index if not exists stock_receipts_batch_idx on public.stock_receipts (batch_id, receiving_location_id);
create index if not exists stock_transfers_status_date_idx on public.stock_transfers (status, transfer_date desc, created_at desc);
create index if not exists stock_transfers_location_idx on public.stock_transfers (source_location_id, destination_location_id, batch_id);
create index if not exists stock_adjustments_status_date_idx on public.stock_adjustments (status, created_at desc);
create index if not exists stock_adjustments_location_batch_idx on public.stock_adjustments (location_id, batch_id);

-- Stage 4 allows a transfer to post its source and destination ledger entries
-- at different workflow moments. The transfer_group_id ties both immutable
-- entries back to one transfer document.
create or replace function public.validate_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matching_batch_product uuid;
  available_quantity integer;
  outbound boolean;
begin
  select product_id into matching_batch_product
  from public.product_batches
  where id = new.batch_id;

  if matching_batch_product is null or matching_batch_product <> new.product_id then
    raise exception 'Stock movement product must match its batch';
  end if;

  if new.status = 'posted' then
    if new.posted_at is null then new.posted_at = now(); end if;
    if new.posted_by is null and auth.uid() is not null then new.posted_by = auth.uid(); end if;

    outbound := new.source_location_id is not null
      and new.movement_type in ('issue', 'transfer', 'damage', 'wastage', 'adjustment_out', 'production_issue');

    if outbound then
      select coalesce(sum(case when destination_location_id = new.source_location_id then quantity else 0 end), 0)
        - coalesce(sum(case when source_location_id = new.source_location_id then quantity else 0 end), 0)
      into available_quantity
      from public.stock_movements
      where product_id = new.product_id
        and batch_id = new.batch_id
        and status = 'posted'
        and id <> new.id;

      if available_quantity < new.quantity and (not public.is_admin() or nullif(trim(new.override_reason), '') is null) then
        raise exception 'Insufficient stock. Director/Admin override requires a written reason';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.stage4_validate_posted_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  batch_product uuid;
  batch_sku uuid;
  batch_status public.record_status;
  batch_quality text;
  batch_expiry date;
  location_status public.record_status;
  available_quantity integer;
  outbound boolean;
begin
  if new.status <> 'posted' then return new; end if;

  select product_id, sku_id, status, quality_status, expires_on
  into batch_product, batch_sku, batch_status, batch_quality, batch_expiry
  from public.product_batches
  where id = new.batch_id;

  if batch_product is null or batch_product <> new.product_id or (new.sku_id is not null and batch_sku <> new.sku_id) then
    raise exception 'Movement product, SKU and batch relationships must match';
  end if;
  if batch_status <> 'active'::public.record_status then
    raise exception 'Archived batches cannot be used for new stock movements';
  end if;

  if new.source_location_id is not null then
    select status into location_status from public.inventory_locations where id = new.source_location_id;
    if location_status <> 'active'::public.record_status then
      raise exception 'Archived source locations cannot be used for stock movements';
    end if;
  end if;
  if new.destination_location_id is not null then
    select status into location_status from public.inventory_locations where id = new.destination_location_id;
    if location_status <> 'active'::public.record_status then
      raise exception 'Archived destination locations cannot be used for stock movements';
    end if;
  end if;

  if new.movement_type in ('receipt', 'transfer', 'issue', 'return')
    and (batch_quality <> 'approved' or batch_expiry < coalesce(new.posted_at::date, current_date)) then
    raise exception 'Only approved, non-expired batches may be received or allocated as sellable stock';
  end if;

  outbound := new.source_location_id is not null
    and new.movement_type in ('issue', 'transfer', 'damage', 'wastage', 'adjustment_out', 'production_issue');
  if outbound then
    select coalesce(sum(case when destination_location_id = new.source_location_id then quantity else 0 end), 0)
      - coalesce(sum(case when source_location_id = new.source_location_id then quantity else 0 end), 0)
    into available_quantity
    from public.stock_movements
    where product_id = new.product_id
      and batch_id = new.batch_id
      and status = 'posted'
      and id <> new.id;
    if available_quantity < new.quantity then
      raise exception 'Insufficient stock; negative inventory is not permitted';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists z_stage4_stock_movement_guard on public.stock_movements;
create trigger z_stage4_stock_movement_guard
before insert on public.stock_movements
for each row execute function public.stage4_validate_posted_movement();

create or replace function public.stage4_validate_reference(
  p_product_id uuid,
  p_sku_id uuid,
  p_batch_id uuid,
  p_location_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  product_status public.record_status;
  sku_product uuid;
  sku_status public.record_status;
  batch_product uuid;
  batch_sku uuid;
  batch_status public.record_status;
  location_status public.record_status;
begin
  select status into product_status from public.products where id = p_product_id;
  select product_id, status into sku_product, sku_status from public.product_skus where id = p_sku_id;
  select product_id, sku_id, status into batch_product, batch_sku, batch_status from public.product_batches where id = p_batch_id;
  select status into location_status from public.inventory_locations where id = p_location_id;

  if product_status <> 'active'::public.record_status then raise exception 'Archived products cannot be used for new stock movements'; end if;
  if sku_product is null or sku_product <> p_product_id or sku_status <> 'active'::public.record_status then raise exception 'The selected SKU is not an active SKU for this product'; end if;
  if batch_product is null or batch_product <> p_product_id or batch_sku <> p_sku_id or batch_status <> 'active'::public.record_status then raise exception 'The selected batch is not an active batch for this SKU'; end if;
  if location_status <> 'active'::public.record_status then raise exception 'Archived locations cannot be used for new stock movements'; end if;
end;
$$;

create or replace function public.stage4_protect_workflow_records()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('goodlivin.stage4_internal', true) = 'on' then return coalesce(new, old); end if;
  if tg_table_name = 'stock_receipts' and (tg_op = 'DELETE' or old.status = 'posted') then
    raise exception 'Posted stock receipts are immutable; create a correcting adjustment';
  end if;
  if tg_table_name = 'stock_transfers' and (tg_op = 'DELETE' or old.status in ('dispatched', 'received', 'cancelled')) then
    raise exception 'Completed or cancelled transfers are immutable';
  end if;
  if tg_table_name = 'stock_adjustments' and (tg_op = 'DELETE' or old.status = 'posted') then
    raise exception 'Posted stock adjustments are immutable; create a correcting adjustment';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists stock_receipts_workflow_guard on public.stock_receipts;
create trigger stock_receipts_workflow_guard
before update or delete on public.stock_receipts
for each row execute function public.stage4_protect_workflow_records();
drop trigger if exists stock_transfers_workflow_guard on public.stock_transfers;
create trigger stock_transfers_workflow_guard
before update or delete on public.stock_transfers
for each row execute function public.stage4_protect_workflow_records();
drop trigger if exists stock_adjustments_workflow_guard on public.stock_adjustments;
create trigger stock_adjustments_workflow_guard
before update or delete on public.stock_adjustments
for each row execute function public.stage4_protect_workflow_records();

do $$
declare table_name text;
begin
  foreach table_name in array array['stock_receipts', 'stock_transfers', 'stock_adjustments'] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
    execute format('drop trigger if exists %I_audit on public.%I', table_name, table_name);
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row_change()', table_name, table_name);
  end loop;
end $$;

create or replace function public.receive_stock_receipt(
  p_receipt_number text,
  p_supplier_id uuid,
  p_manufacturer_id uuid,
  p_receiving_location_id uuid,
  p_received_on date,
  p_product_id uuid,
  p_sku_id uuid,
  p_batch_id uuid,
  p_quantity integer,
  p_unit_cost numeric,
  p_attachment_id uuid default null,
  p_inspection_status text default 'passed',
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  receipt_id uuid;
  v_movement_id uuid;
  batch_quality text;
  batch_expiry date;
  location_status public.record_status;
  reference_status public.record_status;
begin
  if not (public.has_permission('inventory.create') or public.has_permission('inventory.post')) then
    raise exception 'You do not have permission to receive stock';
  end if;
  if nullif(trim(p_receipt_number), '') is null then raise exception 'Receipt/reference number is required'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Received quantity must be greater than zero'; end if;
  if p_unit_cost is null or p_unit_cost < 0 then raise exception 'Unit cost cannot be negative'; end if;
  if p_inspection_status <> 'passed' then raise exception 'Only passed inspections may be posted into sellable stock'; end if;
  if public.has_role('warehouse_staff') and p_unit_cost <> 0 then raise exception 'Warehouse Staff cannot enter receiving costs'; end if;

  perform public.stage4_validate_reference(p_product_id, p_sku_id, p_batch_id, p_receiving_location_id);
  select status into location_status from public.inventory_locations where id = p_receiving_location_id;
  select status into reference_status from public.suppliers where id = p_supplier_id;
  if p_supplier_id is not null and reference_status is distinct from 'active'::public.record_status then raise exception 'Archived suppliers cannot be used for receiving'; end if;
  select status into reference_status from public.manufacturers where id = p_manufacturer_id;
  if p_manufacturer_id is not null and reference_status is distinct from 'active'::public.record_status then raise exception 'Archived manufacturers cannot be used for receiving'; end if;

  select quality_status, expires_on into batch_quality, batch_expiry from public.product_batches where id = p_batch_id;
  if batch_quality <> 'approved' or batch_expiry < p_received_on then raise exception 'Only approved, non-expired batches may be received'; end if;

  perform set_config('goodlivin.stage4_internal', 'on', true);
  insert into public.stock_receipts (receipt_number, supplier_id, manufacturer_id, receiving_location_id, received_on, product_id, sku_id, batch_id, quantity, unit_cost, attachment_id, inspection_status, notes, status, created_by, posted_by, posted_at)
  values (trim(p_receipt_number), p_supplier_id, p_manufacturer_id, p_receiving_location_id, p_received_on, p_product_id, p_sku_id, p_batch_id, p_quantity, p_unit_cost, p_attachment_id, p_inspection_status, nullif(trim(p_notes), ''), 'posted', auth.uid(), auth.uid(), now())
  returning id into receipt_id;

  insert into public.stock_movements (movement_type, status, product_id, sku_id, batch_id, destination_location_id, quantity, unit_cost, reference_type, reference_id, reason, created_by, posted_by, posted_at)
  values ('receipt', 'posted', p_product_id, p_sku_id, p_batch_id, p_receiving_location_id, p_quantity, p_unit_cost, 'stock_receipt', receipt_id, nullif(trim(p_notes), ''), auth.uid(), auth.uid(), now())
  returning id into v_movement_id;

  update public.stock_receipts r set movement_id = v_movement_id where r.id = receipt_id;
  return receipt_id;
end;
$$;

create or replace function public.create_stock_transfer(
  p_transfer_number text,
  p_source_location_id uuid,
  p_destination_location_id uuid,
  p_transfer_date date,
  p_product_id uuid,
  p_sku_id uuid,
  p_batch_id uuid,
  p_quantity integer,
  p_attachment_id uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare transfer_id uuid;
begin
  if not public.has_permission('inventory.create') then raise exception 'You do not have permission to prepare transfers'; end if;
  if nullif(trim(p_transfer_number), '') is null then raise exception 'Transfer/reference number is required'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Transfer quantity must be greater than zero'; end if;
  if p_source_location_id = p_destination_location_id then raise exception 'Source and destination locations must be different'; end if;
  perform public.stage4_validate_reference(p_product_id, p_sku_id, p_batch_id, p_source_location_id);
  perform public.stage4_validate_reference(p_product_id, p_sku_id, p_batch_id, p_destination_location_id);
  insert into public.stock_transfers (transfer_number, source_location_id, destination_location_id, transfer_date, product_id, sku_id, batch_id, quantity, attachment_id, notes, created_by)
  values (trim(p_transfer_number), p_source_location_id, p_destination_location_id, p_transfer_date, p_product_id, p_sku_id, p_batch_id, p_quantity, p_attachment_id, nullif(trim(p_notes), ''), auth.uid())
  returning id into transfer_id;
  return transfer_id;
end;
$$;

create or replace function public.dispatch_stock_transfer(p_transfer_id uuid, p_override_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  transfer_record public.stock_transfers;
  v_movement_id uuid;
  recommended_expiry date;
  selected_expiry date;
  destination_type text;
  destination_retailer_id uuid;
  required_shelf_life integer;
begin
  if not public.has_permission('inventory.post') then raise exception 'Only Inventory Manager or Director/Admin can dispatch transfers'; end if;
  select * into transfer_record from public.stock_transfers where id = p_transfer_id for update;
  if transfer_record.id is null then raise exception 'Transfer not found'; end if;
  if transfer_record.status <> 'draft' then raise exception 'Only draft transfers can be dispatched'; end if;
  perform public.stage4_validate_reference(transfer_record.product_id, transfer_record.sku_id, transfer_record.batch_id, transfer_record.source_location_id);
  perform public.stage4_validate_reference(transfer_record.product_id, transfer_record.sku_id, transfer_record.batch_id, transfer_record.destination_location_id);

  select expires_on into selected_expiry from public.product_batches where id = transfer_record.batch_id;
  select min(b.expires_on) into recommended_expiry
  from public.product_batches b
  where b.sku_id = transfer_record.sku_id
    and b.status = 'active'
    and b.quality_status = 'approved'
    and b.expires_on >= transfer_record.transfer_date
    and (select coalesce(sum(case when sm.destination_location_id = transfer_record.source_location_id then sm.quantity else 0 end), 0) - coalesce(sum(case when sm.source_location_id = transfer_record.source_location_id then sm.quantity else 0 end), 0) from public.stock_movements sm where sm.product_id = b.product_id and sm.batch_id = b.id and sm.status = 'posted') > 0;
  if recommended_expiry is not null and selected_expiry > recommended_expiry and nullif(trim(p_override_reason), '') is null then
    raise exception 'FEFO override reason is required when a later-expiring batch is selected';
  end if;

  select l.location_type, l.retailer_id into destination_type, destination_retailer_id
  from public.inventory_locations l where l.id = transfer_record.destination_location_id;
  if destination_type = 'retailer_branch' then
    select max(a.minimum_shelf_life_days) into required_shelf_life
    from public.retailer_commercial_agreements a
    where a.retailer_id = destination_retailer_id
      and a.status = 'active'
      and a.effective_from <= transfer_record.transfer_date
      and (a.effective_to is null or a.effective_to >= transfer_record.transfer_date);
    if required_shelf_life is null then raise exception 'No active retailer agreement is available for this branch'; end if;
    if selected_expiry < transfer_record.transfer_date + required_shelf_life then raise exception 'Batch does not meet the retailer agreement minimum shelf-life requirement'; end if;
  end if;

  perform set_config('goodlivin.stage4_internal', 'on', true);
  insert into public.stock_movements (movement_type, status, product_id, sku_id, batch_id, source_location_id, quantity, unit_cost, transfer_group_id, reference_type, reference_id, reason, override_reason, created_by, posted_by, posted_at)
  select 'transfer', 'posted', transfer_record.product_id, transfer_record.sku_id, transfer_record.batch_id, transfer_record.source_location_id, transfer_record.quantity, b.unit_cost, transfer_record.id, 'stock_transfer', transfer_record.id, transfer_record.notes, nullif(trim(p_override_reason), ''), auth.uid(), auth.uid(), now()
  from public.product_batches b where b.id = transfer_record.batch_id;
  select id into v_movement_id from public.stock_movements where reference_type = 'stock_transfer' and reference_id = transfer_record.id and source_location_id = transfer_record.source_location_id order by created_at desc limit 1;
  update public.stock_transfers t set status = 'dispatched', dispatched_at = now(), dispatched_by = auth.uid(), dispatched_movement_id = v_movement_id, override_reason = nullif(trim(p_override_reason), '') where t.id = transfer_record.id;
  if nullif(trim(p_override_reason), '') is not null then perform public.write_audit_log('stock_transfers', transfer_record.id, 'fefo_override', null, jsonb_build_object('reason', trim(p_override_reason)), trim(p_override_reason)); end if;
  return transfer_record.id;
end;
$$;

create or replace function public.receive_stock_transfer(p_transfer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare transfer_record public.stock_transfers; v_movement_id uuid;
begin
  if not public.has_permission('inventory.post') then raise exception 'Only Inventory Manager or Director/Admin can receive transfers'; end if;
  select * into transfer_record from public.stock_transfers where id = p_transfer_id for update;
  if transfer_record.id is null then raise exception 'Transfer not found'; end if;
  if transfer_record.status <> 'dispatched' then raise exception 'Only dispatched transfers can be received'; end if;
  perform public.stage4_validate_reference(transfer_record.product_id, transfer_record.sku_id, transfer_record.batch_id, transfer_record.destination_location_id);
  perform set_config('goodlivin.stage4_internal', 'on', true);
  insert into public.stock_movements (movement_type, status, product_id, sku_id, batch_id, destination_location_id, quantity, unit_cost, transfer_group_id, reference_type, reference_id, reason, created_by, posted_by, posted_at)
  select 'transfer', 'posted', transfer_record.product_id, transfer_record.sku_id, transfer_record.batch_id, transfer_record.destination_location_id, transfer_record.quantity, b.unit_cost, transfer_record.id, 'stock_transfer', transfer_record.id, transfer_record.notes, auth.uid(), auth.uid(), now()
  from public.product_batches b where b.id = transfer_record.batch_id;
  select id into v_movement_id from public.stock_movements where reference_type = 'stock_transfer' and reference_id = transfer_record.id and destination_location_id = transfer_record.destination_location_id order by created_at desc limit 1;
  update public.stock_transfers t set status = 'received', received_at = now(), received_by = auth.uid(), received_movement_id = v_movement_id where t.id = transfer_record.id;
  return transfer_record.id;
end;
$$;

create or replace function public.cancel_stock_transfer(p_transfer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare transfer_status text;
begin
  if not public.has_permission('inventory.create') then raise exception 'You do not have permission to cancel transfers'; end if;
  select status into transfer_status from public.stock_transfers where id = p_transfer_id for update;
  if transfer_status is null then raise exception 'Transfer not found'; end if;
  if transfer_status <> 'draft' then raise exception 'Only draft transfers can be cancelled'; end if;
  perform set_config('goodlivin.stage4_internal', 'on', true);
  update public.stock_transfers set status = 'cancelled' where id = p_transfer_id;
  return p_transfer_id;
end;
$$;

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
declare adjustment_id uuid; v_movement_id uuid; adjustment_status text;
begin
  if not public.has_permission('inventory.create') then raise exception 'You do not have permission to prepare adjustments'; end if;
  if nullif(trim(p_adjustment_number), '') is null then raise exception 'Adjustment/reference number is required'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Adjustment quantity must be greater than zero'; end if;
  if p_unit_cost is null or p_unit_cost < 0 then raise exception 'Unit cost cannot be negative'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'An adjustment reason is required'; end if;
  if p_direction not in ('in', 'out') then raise exception 'Adjustment direction is invalid'; end if;
  if public.has_role('warehouse_staff') and p_unit_cost <> 0 then raise exception 'Warehouse Staff cannot enter adjustment costs'; end if;
  perform public.stage4_validate_reference(p_product_id, p_sku_id, p_batch_id, p_location_id);

  adjustment_status := case when public.has_permission('inventory.post') then 'posted' else 'pending' end;
  perform set_config('goodlivin.stage4_internal', 'on', true);
  insert into public.stock_adjustments (adjustment_number, adjustment_type, direction, location_id, product_id, sku_id, batch_id, quantity, unit_cost, reason, status, created_by, approved_by, approved_at)
  values (trim(p_adjustment_number), p_adjustment_type, p_direction, p_location_id, p_product_id, p_sku_id, p_batch_id, p_quantity, p_unit_cost, trim(p_reason), adjustment_status, auth.uid(), case when adjustment_status = 'posted' then auth.uid() else null end, case when adjustment_status = 'posted' then now() else null end)
  returning id into adjustment_id;

  if adjustment_status = 'posted' then
    insert into public.stock_movements (movement_type, status, product_id, sku_id, batch_id, source_location_id, destination_location_id, quantity, unit_cost, reference_type, reference_id, reason, created_by, posted_by, posted_at)
    values (case when p_direction = 'in' then 'adjustment_in' else 'adjustment_out' end, 'posted', p_product_id, p_sku_id, p_batch_id, case when p_direction = 'out' then p_location_id else null end, case when p_direction = 'in' then p_location_id else null end, p_quantity, p_unit_cost, 'stock_adjustment', adjustment_id, trim(p_reason), auth.uid(), auth.uid(), now())
    returning id into v_movement_id;
    update public.stock_adjustments a set movement_id = v_movement_id where a.id = adjustment_id;
  end if;
  return adjustment_id;
end;
$$;

create or replace function public.post_stock_adjustment(p_adjustment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare adjustment_record public.stock_adjustments; v_movement_id uuid;
begin
  if not public.has_permission('inventory.post') then raise exception 'Only Inventory Manager or Director/Admin can approve adjustments'; end if;
  select * into adjustment_record from public.stock_adjustments where id = p_adjustment_id for update;
  if adjustment_record.id is null then raise exception 'Adjustment not found'; end if;
  if adjustment_record.status <> 'pending' then raise exception 'Only pending adjustments can be approved'; end if;
  perform set_config('goodlivin.stage4_internal', 'on', true);
  insert into public.stock_movements (movement_type, status, product_id, sku_id, batch_id, source_location_id, destination_location_id, quantity, unit_cost, reference_type, reference_id, reason, created_by, posted_by, posted_at)
  values (case when adjustment_record.direction = 'in' then 'adjustment_in' else 'adjustment_out' end, 'posted', adjustment_record.product_id, adjustment_record.sku_id, adjustment_record.batch_id, case when adjustment_record.direction = 'out' then adjustment_record.location_id else null end, case when adjustment_record.direction = 'in' then adjustment_record.location_id else null end, adjustment_record.quantity, adjustment_record.unit_cost, 'stock_adjustment', adjustment_record.id, adjustment_record.reason, adjustment_record.created_by, auth.uid(), now())
  returning id into v_movement_id;
  update public.stock_adjustments a set status = 'posted', movement_id = v_movement_id, approved_by = auth.uid(), approved_at = now() where a.id = adjustment_record.id;
  return adjustment_record.id;
end;
$$;

create or replace function public.cancel_stock_adjustment(p_adjustment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare adjustment_status text; adjustment_creator uuid;
begin
  select status, created_by into adjustment_status, adjustment_creator from public.stock_adjustments where id = p_adjustment_id for update;
  if adjustment_status is null then raise exception 'Adjustment not found'; end if;
  if adjustment_status <> 'pending' then raise exception 'Only pending adjustments can be cancelled'; end if;
  if adjustment_creator <> auth.uid() and not public.has_permission('inventory.post') then raise exception 'You do not have permission to cancel this adjustment'; end if;
  perform set_config('goodlivin.stage4_internal', 'on', true);
  update public.stock_adjustments set status = 'cancelled' where id = p_adjustment_id;
  return p_adjustment_id;
end;
$$;

insert into public.permissions (code, label, description) values
  ('inventory.receiving', 'Receive stock', 'Receive approved batches into active locations.'),
  ('inventory.transfers', 'Manage transfers', 'Prepare, dispatch and receive stock transfers.'),
  ('inventory.adjustments', 'Manage adjustments', 'Prepare and approve controlled stock adjustments.')
on conflict (code) do update set label = excluded.label, description = excluded.description;

insert into public.role_permissions (role_code, permission_code) values
  ('director_admin', 'inventory.receiving'), ('director_admin', 'inventory.transfers'), ('director_admin', 'inventory.adjustments'),
  ('inventory_manager', 'inventory.receiving'), ('inventory_manager', 'inventory.transfers'), ('inventory_manager', 'inventory.adjustments'),
  ('warehouse_staff', 'inventory.receiving'), ('warehouse_staff', 'inventory.transfers'), ('warehouse_staff', 'inventory.adjustments')
on conflict do nothing;

alter table public.stock_receipts enable row level security;
alter table public.stock_transfers enable row level security;
alter table public.stock_adjustments enable row level security;

revoke all on public.stock_receipts from anon, authenticated;
revoke all on public.stock_transfers from anon, authenticated;
revoke all on public.stock_adjustments from anon, authenticated;
grant select on public.stock_receipts, public.stock_transfers, public.stock_adjustments to authenticated;

drop policy if exists stock_receipts_read on public.stock_receipts;
create policy stock_receipts_read on public.stock_receipts
for select to authenticated using (public.has_permission('inventory.view') or public.has_permission('financial.view') or public.has_permission('audit.view'));

drop policy if exists stock_transfers_read on public.stock_transfers;
create policy stock_transfers_read on public.stock_transfers
for select to authenticated using (
  public.has_permission('inventory.view') or public.has_permission('audit.view')
  or source_location_id in (select id from public.inventory_locations where retailer_id = public.current_user_retailer_id())
  or destination_location_id in (select id from public.inventory_locations where retailer_id = public.current_user_retailer_id())
);

drop policy if exists stock_adjustments_read on public.stock_adjustments;
create policy stock_adjustments_read on public.stock_adjustments
for select to authenticated using (public.has_permission('inventory.view') or public.has_permission('audit.view') or public.has_permission('financial.view'));

grant execute on function public.receive_stock_receipt(text, uuid, uuid, uuid, date, uuid, uuid, uuid, integer, numeric, uuid, text, text) to authenticated;
grant execute on function public.create_stock_transfer(text, uuid, uuid, date, uuid, uuid, uuid, integer, uuid, text) to authenticated;
grant execute on function public.dispatch_stock_transfer(uuid, text) to authenticated;
grant execute on function public.receive_stock_transfer(uuid) to authenticated;
grant execute on function public.cancel_stock_transfer(uuid) to authenticated;
grant execute on function public.create_stock_adjustment(text, text, text, uuid, uuid, uuid, uuid, integer, numeric, text) to authenticated;
grant execute on function public.post_stock_adjustment(uuid) to authenticated;
grant execute on function public.cancel_stock_adjustment(uuid) to authenticated;

comment on table public.stock_receipts is 'Stage 4 receiving documents. Posted receipts create immutable stock ledger entries.';
comment on table public.stock_transfers is 'Stage 4 transfer workflow. Dispatch and receipt create immutable ledger entries.';
comment on table public.stock_adjustments is 'Stage 4 controlled stock adjustments. Corrections are ledger entries, never editable balances.';

commit;

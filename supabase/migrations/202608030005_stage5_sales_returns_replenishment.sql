-- GoodLivin Stage 5
-- Sales, stock deductions, returns, retailer sell-through and replenishment.
--
-- Stage 4 stock_movements remains immutable and is still the source of truth.
-- These tables are workflow documents. They have no direct authenticated
-- writes; security-definer RPCs validate the workflow and create the ledger
-- entries transactionally.

begin;

create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  sale_date date not null,
  sales_channel text not null check (sales_channel in ('online_store', 'retailer_branch', 'direct_sale', 'event_pop_up')),
  fulfilment_location_id uuid not null references public.inventory_locations(id),
  retailer_id uuid references public.retailers(id),
  branch_id uuid references public.retailer_branches(id),
  product_id uuid not null references public.products(id),
  sku_id uuid not null references public.product_skus(id),
  batch_id uuid references public.product_batches(id),
  quantity integer not null check (quantity > 0),
  selling_price numeric(14, 2) not null check (selling_price >= 0),
  discount numeric(14, 2) not null default 0 check (discount >= 0),
  total_value numeric(16, 2) generated always as (greatest((quantity * selling_price) - discount, 0)) stored,
  currency_code char(3) not null default 'LKR' check (currency_code = 'LKR'),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'fulfilled', 'cancelled', 'refunded')),
  customer_name text,
  customer_contact text,
  notes text,
  override_reason text,
  return_condition text check (return_condition is null or return_condition in ('sellable', 'damaged', 'quarantined', 'expired')),
  movement_id uuid references public.stock_movements(id),
  refund_movement_id uuid references public.stock_movements(id),
  created_by uuid not null references auth.users(id),
  confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz,
  fulfilled_by uuid references auth.users(id),
  fulfilled_at timestamptz,
  cancelled_by uuid references auth.users(id),
  cancelled_at timestamptz,
  refunded_by uuid references auth.users(id),
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((sales_channel = 'retailer_branch') = (branch_id is not null)),
  check (branch_id is null or retailer_id is not null),
  check (discount <= quantity * selling_price)
);

create table if not exists public.retailer_sales_reports (
  id uuid primary key default gen_random_uuid(),
  report_number text not null unique,
  report_date date not null,
  period_start date not null,
  period_end date not null,
  retailer_id uuid not null references public.retailers(id),
  branch_id uuid not null references public.retailer_branches(id),
  product_id uuid not null references public.products(id),
  sku_id uuid not null references public.product_skus(id),
  batch_id uuid references public.product_batches(id),
  quantity_sold integer not null default 0 check (quantity_sold >= 0),
  returns_quantity integer not null default 0 check (returns_quantity >= 0),
  damaged_quantity integer not null default 0 check (damaged_quantity >= 0),
  expired_quantity integer not null default 0 check (expired_quantity >= 0),
  return_location_id uuid references public.inventory_locations(id),
  damaged_location_id uuid references public.inventory_locations(id),
  expired_location_id uuid references public.inventory_locations(id),
  attachment_id uuid references public.attachments(id),
  notes text,
  status text not null default 'pending' check (status in ('pending', 'posted', 'cancelled')),
  sales_movement_id uuid references public.stock_movements(id),
  returns_movement_id uuid references public.stock_movements(id),
  damaged_movement_id uuid references public.stock_movements(id),
  expired_movement_id uuid references public.stock_movements(id),
  created_by uuid not null references auth.users(id),
  posted_by uuid references auth.users(id),
  posted_at timestamptz,
  cancelled_by uuid references auth.users(id),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  check (quantity_sold + returns_quantity + damaged_quantity + expired_quantity > 0),
  check (status <> 'posted' or posted_at is not null)
);

create table if not exists public.inventory_returns (
  id uuid primary key default gen_random_uuid(),
  return_number text not null unique,
  return_type text not null check (return_type in ('customer', 'retailer')),
  return_date date not null,
  retailer_id uuid references public.retailers(id),
  branch_id uuid references public.retailer_branches(id),
  source_location_id uuid references public.inventory_locations(id),
  destination_location_id uuid not null references public.inventory_locations(id),
  product_id uuid not null references public.products(id),
  sku_id uuid not null references public.product_skus(id),
  batch_id uuid not null references public.product_batches(id),
  quantity integer not null check (quantity > 0),
  condition text not null check (condition in ('sellable', 'damaged', 'quarantined', 'expired')),
  reason text not null check (nullif(trim(reason), '') is not null),
  status text not null default 'pending' check (status in ('pending', 'posted', 'cancelled')),
  movement_id uuid references public.stock_movements(id),
  created_by uuid not null references auth.users(id),
  posted_by uuid references auth.users(id),
  posted_at timestamptz,
  cancelled_by uuid references auth.users(id),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((return_type = 'retailer') = (source_location_id is not null and branch_id is not null and retailer_id is not null)),
  check (status <> 'posted' or posted_at is not null)
);

create table if not exists public.retailer_stock_reconciliations (
  id uuid primary key default gen_random_uuid(),
  reconciliation_number text not null unique,
  count_date date not null,
  retailer_id uuid not null references public.retailers(id),
  branch_id uuid not null references public.retailer_branches(id),
  product_id uuid not null references public.products(id),
  sku_id uuid not null references public.product_skus(id),
  batch_id uuid not null references public.product_batches(id),
  counted_quantity integer not null check (counted_quantity >= 0),
  calculated_quantity integer not null check (calculated_quantity >= 0),
  adjustment_quantity integer generated always as (counted_quantity - calculated_quantity) stored,
  reason text not null check (nullif(trim(reason), '') is not null),
  status text not null default 'pending' check (status in ('pending', 'posted', 'cancelled')),
  movement_id uuid references public.stock_movements(id),
  created_by uuid not null references auth.users(id),
  posted_by uuid references auth.users(id),
  posted_at timestamptz,
  cancelled_by uuid references auth.users(id),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'posted' or posted_at is not null)
);

create table if not exists public.replenishment_targets (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id),
  branch_id uuid not null references public.retailer_branches(id),
  product_id uuid not null references public.products(id),
  sku_id uuid not null references public.product_skus(id),
  minimum_stock integer not null default 0 check (minimum_stock >= 0),
  target_stock integer not null default 0 check (target_stock >= minimum_stock),
  lead_time_days integer not null default 0 check (lead_time_days >= 0),
  status public.record_status not null default 'active',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (branch_id, sku_id)
);

create index if not exists sales_orders_date_idx on public.sales_orders (sale_date desc, created_at desc);
create index if not exists sales_orders_status_idx on public.sales_orders (status, sale_date desc);
create index if not exists retailer_sales_reports_date_idx on public.retailer_sales_reports (report_date desc, created_at desc);
create index if not exists retailer_sales_reports_branch_sku_idx on public.retailer_sales_reports (branch_id, sku_id, status);
create index if not exists inventory_returns_date_idx on public.inventory_returns (return_date desc, created_at desc);
create index if not exists reconciliations_branch_sku_idx on public.retailer_stock_reconciliations (branch_id, sku_id, status);
create index if not exists replenishment_targets_branch_idx on public.replenishment_targets (branch_id, status);

insert into public.permissions (code, label, description) values
  ('sales.view', 'View sales', 'View online sales and retailer sales reports.'),
  ('sales.manage', 'Manage sales', 'Create and correct sales records and retailer reports.'),
  ('sales.post', 'Post sales deductions', 'Post approved sales and retailer deductions to stock.'),
  ('sales.fulfill', 'Fulfil approved sales', 'Fulfil approved orders from an active fulfilment location.'),
  ('returns.view', 'View returns', 'View customer and retailer return records.'),
  ('returns.manage', 'Manage returns', 'Create and prepare customer and retailer returns.'),
  ('returns.post', 'Post returns', 'Post permitted returns and refunds to the immutable ledger.'),
  ('sell_through.view', 'View sell-through', 'View calculated retailer sell-through and demand signals.'),
  ('inventory.reconcile', 'Reconcile retailer stock', 'Post controlled retailer branch physical-count reconciliations.')
on conflict (code) do update set label = excluded.label, description = excluded.description;

insert into public.role_permissions (role_code, permission_code) values
  ('director_admin', 'sales.view'), ('director_admin', 'sales.manage'), ('director_admin', 'sales.post'), ('director_admin', 'sales.fulfill'), ('director_admin', 'returns.view'), ('director_admin', 'returns.manage'), ('director_admin', 'returns.post'), ('director_admin', 'sell_through.view'), ('director_admin', 'inventory.reconcile'),
  ('inventory_manager', 'sales.view'), ('inventory_manager', 'sales.manage'), ('inventory_manager', 'sales.post'), ('inventory_manager', 'sales.fulfill'), ('inventory_manager', 'returns.view'), ('inventory_manager', 'returns.manage'), ('inventory_manager', 'returns.post'), ('inventory_manager', 'sell_through.view'), ('inventory_manager', 'inventory.reconcile'),
  ('warehouse_staff', 'sales.view'), ('warehouse_staff', 'sales.fulfill'), ('warehouse_staff', 'returns.view'), ('warehouse_staff', 'returns.manage'), ('warehouse_staff', 'returns.post'),
  ('finance_team', 'sales.view'), ('finance_team', 'sell_through.view'),
  ('sales_manager', 'sales.view'), ('sales_manager', 'sales.manage'), ('sales_manager', 'sell_through.view'),
  ('auditor_read_only', 'sales.view'), ('auditor_read_only', 'returns.view'), ('auditor_read_only', 'sell_through.view')
on conflict do nothing;

create or replace function public.stage5_protect_workflow_records()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('goodlivin.stage5_internal', true) = 'on' then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then raise exception 'Stage 5 workflow records cannot be hard-deleted'; end if;
  if tg_table_name = 'sales_orders' and old.status in ('fulfilled', 'refunded', 'cancelled') then raise exception 'Completed sales are immutable; use a reversal or refund'; end if;
  if tg_table_name in ('retailer_sales_reports', 'inventory_returns', 'retailer_stock_reconciliations') and old.status in ('posted', 'cancelled') then raise exception 'Completed Stage 5 records are immutable; use a correcting record'; end if;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['sales_orders','retailer_sales_reports','inventory_returns','retailer_stock_reconciliations','replenishment_targets'] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
  foreach table_name in array array['sales_orders','retailer_sales_reports','inventory_returns','retailer_stock_reconciliations','replenishment_targets'] loop
    execute format('drop trigger if exists %I_workflow_guard on public.%I', table_name, table_name);
    execute format('create trigger %I_workflow_guard before update or delete on public.%I for each row execute function public.stage5_protect_workflow_records()', table_name, table_name);
    execute format('drop trigger if exists %I_audit on public.%I', table_name, table_name);
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row_change()', table_name, table_name);
  end loop;
end $$;

create or replace function public.stage5_available_quantity(p_product_id uuid, p_batch_id uuid, p_location_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when destination_location_id = p_location_id then quantity else 0 end), 0)::integer
       - coalesce(sum(case when source_location_id = p_location_id then quantity else 0 end), 0)::integer
  from public.stock_movements
  where product_id = p_product_id and batch_id = p_batch_id and status = 'posted';
$$;

create or replace function public.stage5_pick_fefo(p_product_id uuid, p_sku_id uuid, p_location_id uuid, p_as_of date)
returns uuid language sql stable security definer set search_path = public as $$
  select b.id
  from public.product_batches b
  where b.product_id = p_product_id
    and b.sku_id = p_sku_id
    and b.status = 'active'
    and b.quality_status = 'approved'
    and b.expires_on >= p_as_of
    and public.stage5_available_quantity(b.product_id, b.id, p_location_id) > 0
  order by b.expires_on, b.created_at, b.id
  limit 1;
$$;

create or replace function public.stage5_validate_reference(p_product_id uuid, p_sku_id uuid, p_batch_id uuid, p_location_id uuid, p_sale_date date, p_require_sellable boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare product_status public.record_status; sku_product uuid; sku_status public.record_status; batch_product uuid; batch_sku uuid; batch_status public.record_status; batch_quality text; batch_expiry date; location_status public.record_status;
begin
  select status into product_status from public.products where id = p_product_id;
  select product_id, status into sku_product, sku_status from public.product_skus where id = p_sku_id;
  select product_id, sku_id, status, quality_status, expires_on into batch_product, batch_sku, batch_status, batch_quality, batch_expiry from public.product_batches where id = p_batch_id;
  select status into location_status from public.inventory_locations where id = p_location_id;
  if product_status is distinct from 'active'::public.record_status then raise exception 'Archived products cannot be used for Stage 5 operations'; end if;
  if sku_product is null or sku_product <> p_product_id or sku_status is distinct from 'active'::public.record_status then raise exception 'The selected SKU is not active for this product'; end if;
  if batch_product is null or batch_product <> p_product_id or batch_sku is distinct from p_sku_id or batch_status is distinct from 'active'::public.record_status then raise exception 'The selected batch is not active for this SKU'; end if;
  if location_status is distinct from 'active'::public.record_status then raise exception 'Archived locations cannot be used for Stage 5 operations'; end if;
  if p_require_sellable and (batch_quality <> 'approved' or batch_expiry < p_sale_date) then raise exception 'Only approved, non-expired batches may be allocated as sellable stock'; end if;
end;
$$;

create or replace function public.create_sales_order(
  p_order_number text, p_sale_date date, p_sales_channel text, p_fulfilment_location_id uuid,
  p_product_id uuid, p_sku_id uuid, p_batch_id uuid, p_quantity integer, p_selling_price numeric,
  p_discount numeric default 0, p_retailer_id uuid default null, p_branch_id uuid default null,
  p_customer_name text default null, p_customer_contact text default null, p_notes text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare sale_id uuid; branch_retailer uuid; location_status public.record_status;
begin
  if not public.has_permission('sales.manage') then raise exception 'You do not have permission to create sales'; end if;
  if nullif(trim(p_order_number), '') is null then raise exception 'Order/reference number is required'; end if;
  if p_sale_date is null or p_quantity is null or p_quantity <= 0 then raise exception 'Sale date and a positive quantity are required'; end if;
  if p_selling_price is null or p_selling_price < 0 or coalesce(p_discount, 0) < 0 or coalesce(p_discount, 0) > p_quantity * p_selling_price then raise exception 'Selling price and discount values are invalid'; end if;
  if p_sales_channel not in ('online_store', 'retailer_branch', 'direct_sale', 'event_pop_up') then raise exception 'Sales channel is invalid'; end if;
  select status into location_status from public.inventory_locations where id = p_fulfilment_location_id;
  if location_status is distinct from 'active'::public.record_status then raise exception 'Archived fulfilment locations cannot be used'; end if;
  if p_sales_channel = 'retailer_branch' then
    if p_branch_id is null then raise exception 'Retailer branch sales require a branch'; end if;
    select retailer_id into branch_retailer from public.retailer_branches where id = p_branch_id and status = 'active';
    if branch_retailer is null or p_retailer_id is distinct from branch_retailer then raise exception 'Retailer and branch relationships must match'; end if;
  elsif p_branch_id is not null or p_retailer_id is not null then
    raise exception 'Retailer and branch are only valid for retailer branch sales';
  end if;
  if p_batch_id is not null then perform public.stage5_validate_reference(p_product_id, p_sku_id, p_batch_id, p_fulfilment_location_id, p_sale_date, false); end if;
  insert into public.sales_orders (order_number, sale_date, sales_channel, fulfilment_location_id, retailer_id, branch_id, product_id, sku_id, batch_id, quantity, selling_price, discount, customer_name, customer_contact, notes, created_by)
  values (trim(p_order_number), p_sale_date, p_sales_channel, p_fulfilment_location_id, p_retailer_id, p_branch_id, p_product_id, p_sku_id, p_batch_id, p_quantity, p_selling_price, coalesce(p_discount, 0), nullif(trim(p_customer_name), ''), nullif(trim(p_customer_contact), ''), nullif(trim(p_notes), ''), auth.uid())
  returning id into sale_id;
  return sale_id;
end;
$$;

create or replace function public.confirm_sales_order(p_sales_order_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare status_value text;
begin
  if not public.has_permission('sales.manage') then raise exception 'You do not have permission to confirm sales'; end if;
  select status into status_value from public.sales_orders where id = p_sales_order_id for update;
  if status_value is null then raise exception 'Sales order not found'; end if;
  if status_value = 'confirmed' then return p_sales_order_id; end if;
  if status_value <> 'pending' then raise exception 'Only pending sales can be confirmed'; end if;
  perform set_config('goodlivin.stage5_internal', 'on', true);
  update public.sales_orders set status = 'confirmed', confirmed_by = auth.uid(), confirmed_at = now() where id = p_sales_order_id;
  return p_sales_order_id;
end;
$$;

create or replace function public.fulfil_sales_order(p_sales_order_id uuid, p_override_reason text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare sale_record public.sales_orders; selected_batch uuid; recommended_batch uuid; v_movement_id uuid; selected_expiry date; recommended_expiry date; available integer;
begin
  if not (public.has_permission('sales.post') or public.has_permission('sales.fulfill')) then raise exception 'You do not have permission to fulfil sales'; end if;
  select * into sale_record from public.sales_orders where id = p_sales_order_id for update;
  if sale_record.id is null then raise exception 'Sales order not found'; end if;
  if sale_record.status = 'fulfilled' then return p_sales_order_id; end if;
  if sale_record.status <> 'confirmed' then raise exception 'Only confirmed sales can be fulfilled'; end if;
  perform pg_advisory_xact_lock(hashtextextended(format('%s:%s:%s', sale_record.product_id, sale_record.sku_id, sale_record.fulfilment_location_id), 0));
  selected_batch := sale_record.batch_id;
  if selected_batch is null then selected_batch := public.stage5_pick_fefo(sale_record.product_id, sale_record.sku_id, sale_record.fulfilment_location_id, sale_record.sale_date); end if;
  if selected_batch is null then raise exception 'No approved, non-expired stock is available for FEFO fulfilment'; end if;
  perform public.stage5_validate_reference(sale_record.product_id, sale_record.sku_id, selected_batch, sale_record.fulfilment_location_id, sale_record.sale_date, true);
  available := public.stage5_available_quantity(sale_record.product_id, selected_batch, sale_record.fulfilment_location_id);
  if available < sale_record.quantity then raise exception 'Insufficient stock; negative inventory is not permitted'; end if;
  select expires_on into selected_expiry from public.product_batches where id = selected_batch;
  selected_expiry := coalesce(selected_expiry, sale_record.sale_date);
  select min(b.expires_on) into recommended_expiry from public.product_batches b where b.product_id = sale_record.product_id and b.sku_id = sale_record.sku_id and b.status = 'active' and b.quality_status = 'approved' and b.expires_on >= sale_record.sale_date and public.stage5_available_quantity(b.product_id, b.id, sale_record.fulfilment_location_id) > 0;
  if recommended_expiry is not null and selected_expiry > recommended_expiry and nullif(trim(p_override_reason), '') is null then raise exception 'FEFO override reason is required when a later-expiring batch is selected'; end if;
  perform set_config('goodlivin.stage5_internal', 'on', true);
  insert into public.stock_movements (movement_type, status, product_id, sku_id, batch_id, source_location_id, quantity, unit_cost, reference_type, reference_id, reason, override_reason, created_by, posted_by, posted_at)
  select 'issue', 'posted', sale_record.product_id, sale_record.sku_id, selected_batch, sale_record.fulfilment_location_id, sale_record.quantity, b.unit_cost, 'sales_order', sale_record.id, sale_record.notes, nullif(trim(p_override_reason), ''), auth.uid(), auth.uid(), now()
  from public.product_batches b where b.id = selected_batch returning id into v_movement_id;
  update public.sales_orders set status = 'fulfilled', batch_id = selected_batch, movement_id = v_movement_id, override_reason = nullif(trim(p_override_reason), ''), fulfilled_by = auth.uid(), fulfilled_at = now() where id = p_sales_order_id;
  if nullif(trim(p_override_reason), '') is not null then perform public.write_audit_log('sales_orders', sale_record.id, 'fefo_override', null, jsonb_build_object('reason', trim(p_override_reason), 'batch_id', selected_batch), trim(p_override_reason)); end if;
  return p_sales_order_id;
end;
$$;

create or replace function public.cancel_sales_order(p_sales_order_id uuid, p_reason text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare status_value text;
begin
  if not public.has_permission('sales.manage') then raise exception 'You do not have permission to cancel sales'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'A cancellation reason is required'; end if;
  select status into status_value from public.sales_orders where id = p_sales_order_id for update;
  if status_value is null then raise exception 'Sales order not found'; end if;
  if status_value = 'cancelled' then return p_sales_order_id; end if;
  if status_value not in ('pending', 'confirmed') then raise exception 'Only unfulfilled sales can be cancelled'; end if;
  perform set_config('goodlivin.stage5_internal', 'on', true);
  update public.sales_orders set status = 'cancelled', notes = concat_ws(E'\n', notes, 'Cancellation: ' || trim(p_reason)), cancelled_by = auth.uid(), cancelled_at = now() where id = p_sales_order_id;
  perform public.write_audit_log('sales_orders', p_sales_order_id, 'cancelled', null, jsonb_build_object('reason', trim(p_reason)), trim(p_reason));
  return p_sales_order_id;
end;
$$;

create or replace function public.refund_sales_order(p_sales_order_id uuid, p_condition text, p_destination_location_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare sale_record public.sales_orders; destination_status public.record_status; destination_type text; v_movement_id uuid; movement_kind text;
begin
  if not (public.has_permission('returns.post') or public.has_permission('sales.post')) then raise exception 'You do not have permission to refund sales'; end if;
  if p_condition not in ('sellable', 'damaged', 'quarantined', 'expired') or nullif(trim(p_reason), '') is null then raise exception 'Refund condition and reason are required'; end if;
  select * into sale_record from public.sales_orders where id = p_sales_order_id for update;
  if sale_record.id is null then raise exception 'Sales order not found'; end if;
  if sale_record.status = 'refunded' then return p_sales_order_id; end if;
  if sale_record.status <> 'fulfilled' or sale_record.batch_id is null or sale_record.movement_id is null then raise exception 'Only fulfilled sales can be refunded'; end if;
  select status, location_type into destination_status, destination_type from public.inventory_locations where id = p_destination_location_id;
  if destination_status is distinct from 'active'::public.record_status then raise exception 'Archived return locations cannot be used'; end if;
  if p_condition = 'sellable' and destination_type in ('damaged_stock', 'quarantine', 'quarantine_stock', 'expired_stock') then raise exception 'Sellable returns require a normal active stock location'; end if;
  if p_condition = 'damaged' and destination_type <> 'damaged_stock' then raise exception 'Damaged returns must be routed to damaged stock'; end if;
  if p_condition = 'quarantined' and destination_type not in ('quarantine', 'quarantine_stock') then raise exception 'Quarantined returns must be routed to quarantine stock'; end if;
  if p_condition = 'expired' and destination_type <> 'expired_stock' then raise exception 'Expired returns must be routed to expired stock'; end if;
  movement_kind := case when p_condition = 'sellable' then 'return' when p_condition = 'damaged' then 'damage' when p_condition = 'expired' then 'wastage' else 'adjustment_in' end;
  if p_condition = 'sellable' then perform public.stage5_validate_reference(sale_record.product_id, sale_record.sku_id, sale_record.batch_id, p_destination_location_id, current_date, true); end if;
  perform set_config('goodlivin.stage5_internal', 'on', true);
  insert into public.stock_movements (movement_type, status, product_id, sku_id, batch_id, destination_location_id, quantity, unit_cost, reference_type, reference_id, reason, created_by, posted_by, posted_at)
  select movement_kind, 'posted', sale_record.product_id, sale_record.sku_id, sale_record.batch_id, p_destination_location_id, sale_record.quantity, b.unit_cost, 'sales_refund', sale_record.id, trim(p_reason), auth.uid(), auth.uid(), now() from public.product_batches b where b.id = sale_record.batch_id returning id into v_movement_id;
  update public.sales_orders set status = 'refunded', refund_movement_id = v_movement_id, return_condition = p_condition, refunded_by = auth.uid(), refunded_at = now(), notes = concat_ws(E'\n', notes, 'Refund: ' || trim(p_reason)) where id = p_sales_order_id;
  return p_sales_order_id;
end;
$$;

create or replace function public.create_retailer_sales_report(
  p_report_number text, p_report_date date, p_period_start date, p_period_end date, p_retailer_id uuid, p_branch_id uuid,
  p_product_id uuid, p_sku_id uuid, p_batch_id uuid, p_quantity_sold integer, p_returns_quantity integer,
  p_damaged_quantity integer, p_expired_quantity integer, p_return_location_id uuid default null,
  p_damaged_location_id uuid default null, p_expired_location_id uuid default null, p_attachment_id uuid default null, p_notes text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare report_id uuid; branch_retailer uuid;
begin
  if not public.has_permission('sales.manage') then raise exception 'You do not have permission to create retailer sales reports'; end if;
  if nullif(trim(p_report_number), '') is null or p_report_date is null or p_period_start is null or p_period_end is null or p_period_end < p_period_start then raise exception 'Report reference and reporting dates are required'; end if;
  if coalesce(p_quantity_sold, 0) < 0 or coalesce(p_returns_quantity, 0) < 0 or coalesce(p_damaged_quantity, 0) < 0 or coalesce(p_expired_quantity, 0) < 0 or coalesce(p_quantity_sold, 0) + coalesce(p_returns_quantity, 0) + coalesce(p_damaged_quantity, 0) + coalesce(p_expired_quantity, 0) = 0 then raise exception 'At least one reported quantity is required'; end if;
  select retailer_id into branch_retailer from public.retailer_branches where id = p_branch_id and status = 'active';
  if branch_retailer is null or branch_retailer <> p_retailer_id then raise exception 'Retailer and branch relationships must match'; end if;
  perform public.stage5_validate_reference(p_product_id, p_sku_id, coalesce(p_batch_id, (select public.stage5_pick_fefo(p_product_id, p_sku_id, (select id from public.inventory_locations where branch_id = p_branch_id and location_type = 'retailer_branch' and status = 'active' limit 1), p_report_date))), (select id from public.inventory_locations where branch_id = p_branch_id and location_type = 'retailer_branch' and status = 'active' limit 1), p_report_date, false);
  insert into public.retailer_sales_reports (report_number, report_date, period_start, period_end, retailer_id, branch_id, product_id, sku_id, batch_id, quantity_sold, returns_quantity, damaged_quantity, expired_quantity, return_location_id, damaged_location_id, expired_location_id, attachment_id, notes, created_by)
  values (trim(p_report_number), p_report_date, p_period_start, p_period_end, p_retailer_id, p_branch_id, p_product_id, p_sku_id, p_batch_id, coalesce(p_quantity_sold, 0), coalesce(p_returns_quantity, 0), coalesce(p_damaged_quantity, 0), coalesce(p_expired_quantity, 0), p_return_location_id, p_damaged_location_id, p_expired_location_id, p_attachment_id, nullif(trim(p_notes), ''), auth.uid())
  returning id into report_id;
  return report_id;
end;
$$;

create or replace function public.post_retailer_sales_report(p_report_id uuid, p_override_reason text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare report_record public.retailer_sales_reports; branch_location uuid; selected_batch uuid; recommended_expiry date; selected_expiry date; movement_id uuid; return_location uuid; damaged_location uuid; expired_location uuid;
begin
  if not public.has_permission('sales.post') then raise exception 'Only Inventory Manager or Director/Admin can post retailer stock deductions'; end if;
  select * into report_record from public.retailer_sales_reports where id = p_report_id for update;
  if report_record.id is null then raise exception 'Retailer sales report not found'; end if;
  if report_record.status = 'posted' then return p_report_id; end if;
  if report_record.status <> 'pending' then raise exception 'Only pending retailer sales reports can be posted'; end if;
  select id into branch_location from public.inventory_locations where branch_id = report_record.branch_id and location_type = 'retailer_branch' and status = 'active' order by id limit 1;
  if branch_location is null then raise exception 'No active inventory location is linked to this retailer branch'; end if;
  perform pg_advisory_xact_lock(hashtextextended(format('%s:%s:%s', report_record.product_id, report_record.sku_id, branch_location), 0));
  selected_batch := report_record.batch_id;
  if selected_batch is null then selected_batch := public.stage5_pick_fefo(report_record.product_id, report_record.sku_id, branch_location, report_record.report_date); end if;
  if selected_batch is null then raise exception 'No approved, non-expired batch is available at this branch'; end if;
  perform public.stage5_validate_reference(report_record.product_id, report_record.sku_id, selected_batch, branch_location, report_record.report_date, true);
  select expires_on into selected_expiry from public.product_batches where id = selected_batch;
  select min(b.expires_on) into recommended_expiry from public.product_batches b where b.product_id = report_record.product_id and b.sku_id = report_record.sku_id and b.status = 'active' and b.quality_status = 'approved' and b.expires_on >= report_record.report_date and public.stage5_available_quantity(b.product_id, b.id, branch_location) > 0;
  if recommended_expiry is not null and selected_expiry > recommended_expiry and nullif(trim(p_override_reason), '') is null then raise exception 'FEFO override reason is required when a later-expiring batch is selected'; end if;
  return_location := coalesce(report_record.return_location_id, (select id from public.inventory_locations where location_type in ('warehouse', 'main_warehouse', 'office_stock') and status = 'active' order by id limit 1));
  damaged_location := coalesce(report_record.damaged_location_id, (select id from public.inventory_locations where location_type = 'damaged_stock' and status = 'active' order by id limit 1));
  expired_location := coalesce(report_record.expired_location_id, (select id from public.inventory_locations where location_type = 'expired_stock' and status = 'active' order by id limit 1));
  if report_record.returns_quantity > 0 and return_location is null then raise exception 'A return destination location is required'; end if;
  if report_record.damaged_quantity > 0 and damaged_location is null then raise exception 'A damaged-stock destination location is required'; end if;
  if report_record.expired_quantity > 0 and expired_location is null then raise exception 'An expired-stock destination location is required'; end if;
  perform set_config('goodlivin.stage5_internal', 'on', true);
  if report_record.quantity_sold > 0 then
    insert into public.stock_movements (movement_type, status, product_id, sku_id, batch_id, source_location_id, quantity, unit_cost, reference_type, reference_id, reason, override_reason, created_by, posted_by, posted_at)
    select 'issue', 'posted', report_record.product_id, report_record.sku_id, selected_batch, branch_location, report_record.quantity_sold, b.unit_cost, 'retailer_sales_report', report_record.id, report_record.notes, nullif(trim(p_override_reason), ''), auth.uid(), auth.uid(), now() from public.product_batches b where b.id = selected_batch returning id into movement_id;
    update public.retailer_sales_reports set sales_movement_id = movement_id where id = p_report_id;
  end if;
  if report_record.returns_quantity > 0 then
    insert into public.stock_movements (movement_type, status, product_id, sku_id, batch_id, source_location_id, destination_location_id, quantity, unit_cost, reference_type, reference_id, reason, created_by, posted_by, posted_at)
    select 'return', 'posted', report_record.product_id, report_record.sku_id, selected_batch, branch_location, return_location, report_record.returns_quantity, b.unit_cost, 'retailer_sales_report', report_record.id, 'Retailer return', auth.uid(), auth.uid(), now() from public.product_batches b where b.id = selected_batch returning id into movement_id;
    update public.retailer_sales_reports set returns_movement_id = movement_id where id = p_report_id;
  end if;
  if report_record.damaged_quantity > 0 then
    insert into public.stock_movements (movement_type, status, product_id, sku_id, batch_id, source_location_id, destination_location_id, quantity, unit_cost, reference_type, reference_id, reason, created_by, posted_by, posted_at)
    select 'damage', 'posted', report_record.product_id, report_record.sku_id, selected_batch, branch_location, damaged_location, report_record.damaged_quantity, b.unit_cost, 'retailer_sales_report', report_record.id, 'Retailer damaged stock', auth.uid(), auth.uid(), now() from public.product_batches b where b.id = selected_batch returning id into movement_id;
    update public.retailer_sales_reports set damaged_movement_id = movement_id where id = p_report_id;
  end if;
  if report_record.expired_quantity > 0 then
    insert into public.stock_movements (movement_type, status, product_id, sku_id, batch_id, source_location_id, destination_location_id, quantity, unit_cost, reference_type, reference_id, reason, created_by, posted_by, posted_at)
    select 'wastage', 'posted', report_record.product_id, report_record.sku_id, selected_batch, branch_location, expired_location, report_record.expired_quantity, b.unit_cost, 'retailer_sales_report', report_record.id, 'Retailer expired stock', auth.uid(), auth.uid(), now() from public.product_batches b where b.id = selected_batch returning id into movement_id;
    update public.retailer_sales_reports set expired_movement_id = movement_id where id = p_report_id;
  end if;
  update public.retailer_sales_reports set status = 'posted', batch_id = selected_batch, posted_by = auth.uid(), posted_at = now() where id = p_report_id;
  if nullif(trim(p_override_reason), '') is not null then perform public.write_audit_log('retailer_sales_reports', p_report_id, 'fefo_override', null, jsonb_build_object('reason', trim(p_override_reason), 'batch_id', selected_batch), trim(p_override_reason)); end if;
  return p_report_id;
end;
$$;

create or replace function public.cancel_retailer_sales_report(p_report_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare report_status text;
begin
  if not public.has_permission('sales.manage') or nullif(trim(p_reason), '') is null then raise exception 'Permission and a cancellation reason are required'; end if;
  select status into report_status from public.retailer_sales_reports where id = p_report_id for update;
  if report_status is null then raise exception 'Retailer sales report not found'; end if;
  if report_status = 'cancelled' then return p_report_id; end if;
  if report_status <> 'pending' then raise exception 'Only pending reports can be cancelled'; end if;
  perform set_config('goodlivin.stage5_internal', 'on', true);
  update public.retailer_sales_reports set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(), notes = concat_ws(E'\n', notes, 'Cancellation: ' || trim(p_reason)) where id = p_report_id;
  perform public.write_audit_log('retailer_sales_reports', p_report_id, 'cancelled', null, jsonb_build_object('reason', trim(p_reason)), trim(p_reason));
  return p_report_id;
end;
$$;

create or replace function public.create_inventory_return(
  p_return_number text, p_return_type text, p_return_date date, p_retailer_id uuid, p_branch_id uuid,
  p_source_location_id uuid, p_destination_location_id uuid, p_product_id uuid, p_sku_id uuid,
  p_batch_id uuid, p_quantity integer, p_condition text, p_reason text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare return_id uuid; branch_retailer uuid; source_status public.record_status; destination_status public.record_status;
begin
  if not public.has_permission('returns.manage') then raise exception 'You do not have permission to create returns'; end if;
  if nullif(trim(p_return_number), '') is null or p_return_date is null or p_quantity is null or p_quantity <= 0 or nullif(trim(p_reason), '') is null then raise exception 'Return reference, date, positive quantity and reason are required'; end if;
  if p_return_type not in ('customer', 'retailer') or p_condition not in ('sellable', 'damaged', 'quarantined', 'expired') then raise exception 'Return type or condition is invalid'; end if;
  select status into destination_status from public.inventory_locations where id = p_destination_location_id;
  if destination_status is distinct from 'active'::public.record_status then raise exception 'Archived return destination cannot be used'; end if;
  if p_return_type = 'retailer' then
    select retailer_id into branch_retailer from public.retailer_branches where id = p_branch_id and status = 'active';
    select status into source_status from public.inventory_locations where id = p_source_location_id;
    if branch_retailer is null or branch_retailer <> p_retailer_id or source_status is distinct from 'active'::public.record_status then raise exception 'Retailer return branch relationships are invalid'; end if;
  end if;
  perform public.stage5_validate_reference(p_product_id, p_sku_id, p_batch_id, p_destination_location_id, p_return_date, p_condition = 'sellable');
  insert into public.inventory_returns (return_number, return_type, return_date, retailer_id, branch_id, source_location_id, destination_location_id, product_id, sku_id, batch_id, quantity, condition, reason, created_by)
  values (trim(p_return_number), p_return_type, p_return_date, p_retailer_id, p_branch_id, p_source_location_id, p_destination_location_id, p_product_id, p_sku_id, p_batch_id, p_quantity, p_condition, trim(p_reason), auth.uid()) returning id into return_id;
  return return_id;
end;
$$;

create or replace function public.post_inventory_return(p_return_id uuid, p_override_reason text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare return_record public.inventory_returns; movement_kind text; v_movement_id uuid;
begin
  if not public.has_permission('returns.post') then raise exception 'You do not have permission to post returns'; end if;
  select * into return_record from public.inventory_returns where id = p_return_id for update;
  if return_record.id is null then raise exception 'Return not found'; end if;
  if return_record.status = 'posted' then return p_return_id; end if;
  if return_record.status <> 'pending' then raise exception 'Only pending returns can be posted'; end if;
  if return_record.condition = 'sellable' then movement_kind := 'return'; elsif return_record.condition = 'damaged' then movement_kind := 'damage'; elsif return_record.condition = 'expired' then movement_kind := 'wastage'; else movement_kind := 'adjustment_in'; end if;
  if return_record.condition = 'sellable' then perform public.stage5_validate_reference(return_record.product_id, return_record.sku_id, return_record.batch_id, return_record.destination_location_id, return_record.return_date, true); end if;
  perform set_config('goodlivin.stage5_internal', 'on', true);
  insert into public.stock_movements (movement_type, status, product_id, sku_id, batch_id, source_location_id, destination_location_id, quantity, unit_cost, reference_type, reference_id, reason, override_reason, created_by, posted_by, posted_at)
  select movement_kind, 'posted', return_record.product_id, return_record.sku_id, return_record.batch_id, return_record.source_location_id, return_record.destination_location_id, return_record.quantity, b.unit_cost, 'inventory_return', return_record.id, return_record.reason, nullif(trim(p_override_reason), ''), auth.uid(), auth.uid(), now() from public.product_batches b where b.id = return_record.batch_id returning id into v_movement_id;
  update public.inventory_returns set status = 'posted', movement_id = v_movement_id, posted_by = auth.uid(), posted_at = now() where id = p_return_id;
  return p_return_id;
end;
$$;

create or replace function public.create_retailer_reconciliation(
  p_reconciliation_number text, p_count_date date, p_retailer_id uuid, p_branch_id uuid,
  p_product_id uuid, p_sku_id uuid, p_batch_id uuid, p_counted_quantity integer, p_reason text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare reconciliation_id uuid; branch_retailer uuid; branch_location uuid; calculated integer;
begin
  if not public.has_permission('inventory.reconcile') then raise exception 'You do not have permission to reconcile retailer stock'; end if;
  if nullif(trim(p_reconciliation_number), '') is null or p_count_date is null or p_counted_quantity is null or p_counted_quantity < 0 or nullif(trim(p_reason), '') is null then raise exception 'Reconciliation reference, date, non-negative count and reason are required'; end if;
  select retailer_id into branch_retailer from public.retailer_branches where id = p_branch_id and status = 'active';
  select id into branch_location from public.inventory_locations where branch_id = p_branch_id and location_type = 'retailer_branch' and status = 'active' order by id limit 1;
  if branch_retailer is null or branch_retailer <> p_retailer_id or branch_location is null then raise exception 'Retailer branch is not linked to an active inventory location'; end if;
  perform public.stage5_validate_reference(p_product_id, p_sku_id, p_batch_id, branch_location, p_count_date, false);
  calculated := public.stage5_available_quantity(p_product_id, p_batch_id, branch_location);
  insert into public.retailer_stock_reconciliations (reconciliation_number, count_date, retailer_id, branch_id, product_id, sku_id, batch_id, counted_quantity, calculated_quantity, reason, created_by)
  values (trim(p_reconciliation_number), p_count_date, p_retailer_id, p_branch_id, p_product_id, p_sku_id, p_batch_id, p_counted_quantity, greatest(calculated, 0), trim(p_reason), auth.uid()) returning id into reconciliation_id;
  return reconciliation_id;
end;
$$;

create or replace function public.post_retailer_reconciliation(p_reconciliation_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare reconciliation public.retailer_stock_reconciliations; branch_location uuid; current_quantity integer; difference integer; movement_kind text; v_movement_id uuid;
begin
  if not public.has_permission('inventory.reconcile') then raise exception 'You do not have permission to post retailer reconciliations'; end if;
  select * into reconciliation from public.retailer_stock_reconciliations where id = p_reconciliation_id for update;
  if reconciliation.id is null then raise exception 'Reconciliation not found'; end if;
  if reconciliation.status = 'posted' then return p_reconciliation_id; end if;
  if reconciliation.status <> 'pending' then raise exception 'Only pending reconciliations can be posted'; end if;
  select id into branch_location from public.inventory_locations where branch_id = reconciliation.branch_id and location_type = 'retailer_branch' and status = 'active' order by id limit 1;
  current_quantity := public.stage5_available_quantity(reconciliation.product_id, reconciliation.batch_id, branch_location);
  difference := reconciliation.counted_quantity - current_quantity;
  perform set_config('goodlivin.stage5_internal', 'on', true);
  if difference <> 0 then
    movement_kind := case when difference > 0 then 'adjustment_in' else 'adjustment_out' end;
    insert into public.stock_movements (movement_type, status, product_id, sku_id, batch_id, source_location_id, destination_location_id, quantity, unit_cost, reference_type, reference_id, reason, created_by, posted_by, posted_at)
    select movement_kind, 'posted', reconciliation.product_id, reconciliation.sku_id, reconciliation.batch_id, case when difference < 0 then branch_location else null end, case when difference > 0 then branch_location else null end, abs(difference), b.unit_cost, 'retailer_reconciliation', reconciliation.id, reconciliation.reason, auth.uid(), auth.uid(), now() from public.product_batches b where b.id = reconciliation.batch_id returning id into v_movement_id;
  end if;
  update public.retailer_stock_reconciliations set status = 'posted', calculated_quantity = current_quantity, movement_id = v_movement_id, posted_by = auth.uid(), posted_at = now() where id = p_reconciliation_id;
  return p_reconciliation_id;
end;
$$;

create or replace function public.save_replenishment_target(p_retailer_id uuid, p_branch_id uuid, p_product_id uuid, p_sku_id uuid, p_minimum_stock integer, p_target_stock integer, p_lead_time_days integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare target_id uuid; branch_retailer uuid;
begin
  if not public.has_permission('replenishment.manage') then raise exception 'You do not have permission to manage replenishment targets'; end if;
  if p_minimum_stock < 0 or p_target_stock < p_minimum_stock or p_lead_time_days < 0 then raise exception 'Replenishment thresholds are invalid'; end if;
  select retailer_id into branch_retailer from public.retailer_branches where id = p_branch_id and status = 'active';
  if branch_retailer is null or branch_retailer <> p_retailer_id then raise exception 'Retailer and branch relationships must match'; end if;
  if not exists (select 1 from public.products where id = p_product_id and status = 'active') or not exists (select 1 from public.product_skus where id = p_sku_id and product_id = p_product_id and status = 'active') then raise exception 'An active product and SKU are required'; end if;
  insert into public.replenishment_targets (retailer_id, branch_id, product_id, sku_id, minimum_stock, target_stock, lead_time_days, created_by)
  values (p_retailer_id, p_branch_id, p_product_id, p_sku_id, p_minimum_stock, p_target_stock, p_lead_time_days, auth.uid())
  on conflict (branch_id, sku_id) do update set minimum_stock = excluded.minimum_stock, target_stock = excluded.target_stock, lead_time_days = excluded.lead_time_days, status = 'active', archived_at = null
  returning id into target_id;
  return target_id;
end;
$$;

create or replace view public.retailer_sell_through with (security_invoker = true) as
with branch_locations as (
  select b.id as branch_id, b.retailer_id, l.id as location_id
  from public.retailer_branches b join public.inventory_locations l on l.branch_id = b.id and l.location_type = 'retailer_branch' and l.status = 'active'
), report_totals as (
  select branch_id, sku_id, sum(quantity_sold)::integer as sold, sum(returns_quantity)::integer as returns_sent_back, sum(damaged_quantity)::integer as damaged, sum(expired_quantity)::integer as expired, max(report_date) as last_report_date
  from public.retailer_sales_reports where status = 'posted' group by branch_id, sku_id
), deliveries as (
  select bl.branch_id, sm.sku_id, sum(sm.quantity)::integer as delivered
  from branch_locations bl join public.stock_movements sm on sm.destination_location_id = bl.location_id and sm.status = 'posted' and sm.movement_type in ('transfer', 'receipt') group by bl.branch_id, sm.sku_id
), current_stock as (
  select bl.branch_id, sb.product_id, pb.sku_id, sum(sb.quantity_on_hand)::integer as current_stock
  from branch_locations bl join public.stock_balances sb on sb.location_id = bl.location_id join public.product_batches pb on pb.id = sb.batch_id group by bl.branch_id, sb.product_id, pb.sku_id
)
select b.id as branch_id, b.retailer_id, b.code as branch_code, b.name as branch_name, p.id as product_id, p.product_code, p.name as product_name, s.id as sku_id, s.sku_code, s.sellable_name,
  coalesce(d.delivered, 0)::integer as deliveries, coalesce(rt.sold, 0)::integer as sold, coalesce(rt.returns_sent_back, 0)::integer as returns_sent_back, coalesce(rt.damaged, 0)::integer as damaged, coalesce(rt.expired, 0)::integer as expired,
  coalesce(cs.current_stock, 0)::integer as current_stock, 0::integer as opening_stock, rt.last_report_date,
  round(case when coalesce(d.delivered, 0) + coalesce(rt.sold, 0) = 0 then 0 else (coalesce(rt.sold, 0)::numeric / greatest(coalesce(d.delivered, 0), 1)::numeric) * 100 end, 2) as sell_through_percent,
  greatest(0, current_date - coalesce(rt.last_report_date, current_date))::integer as days_since_last_report
from public.retailer_branches b join public.products p on p.status = 'active' join public.product_skus s on s.product_id = p.id and s.status = 'active'
left join deliveries d on d.branch_id = b.id and d.sku_id = s.id left join report_totals rt on rt.branch_id = b.id and rt.sku_id = s.id left join current_stock cs on cs.branch_id = b.id and cs.product_id = p.id and cs.sku_id = s.id
where b.status = 'active';

create or replace view public.replenishment_recommendations with (security_invoker = true) as
with branch_locations as (
  select b.id as branch_id, b.retailer_id, l.id as location_id from public.retailer_branches b join public.inventory_locations l on l.branch_id = b.id and l.location_type = 'retailer_branch' and l.status = 'active'
), sales_rate as (
  select branch_id, sku_id, coalesce(sum(quantity_sold) filter (where report_date >= current_date - 30), 0)::numeric / 30 as avg_daily_sales from public.retailer_sales_reports where status = 'posted' group by branch_id, sku_id
), warehouse_stock as (
  select sb.product_id, pb.sku_id, sum(sb.quantity_on_hand)::integer as available_warehouse_stock from public.stock_balances sb join public.product_batches pb on pb.id = sb.batch_id join public.inventory_locations l on l.id = sb.location_id and l.status = 'active' and l.location_type in ('warehouse','main_warehouse','office_stock','online_order_stock') where pb.status = 'active' and pb.quality_status = 'approved' and pb.expires_on >= current_date group by sb.product_id, pb.sku_id
), branch_stock as (
  select bl.branch_id, sb.product_id, pb.sku_id, sum(sb.quantity_on_hand)::integer as current_branch_stock from branch_locations bl join public.stock_balances sb on sb.location_id = bl.location_id join public.product_batches pb on pb.id = sb.batch_id group by bl.branch_id, sb.product_id, pb.sku_id
)
select t.id as target_id, t.retailer_id, t.branch_id, t.product_id, t.sku_id, r.name as retailer_name, b.code as branch_code, b.name as branch_name, p.product_code, p.name as product_name, s.sku_code, s.sellable_name, t.minimum_stock, t.target_stock, t.lead_time_days, coalesce(bs.current_branch_stock, 0)::integer as current_branch_stock, coalesce(sr.avg_daily_sales, 0)::numeric as avg_daily_sales, coalesce(ws.available_warehouse_stock, 0)::integer as available_warehouse_stock, greatest(0, t.target_stock - coalesce(bs.current_branch_stock, 0))::integer as suggested_quantity,
  case when coalesce(ws.available_warehouse_stock, 0) < greatest(0, t.target_stock - coalesce(bs.current_branch_stock, 0)) then 'insufficient warehouse stock' else 'ready for planning' end as recommendation_status
from public.replenishment_targets t join public.retailers r on r.id = t.retailer_id join public.retailer_branches b on b.id = t.branch_id join public.products p on p.id = t.product_id join public.product_skus s on s.id = t.sku_id left join branch_stock bs on bs.branch_id = t.branch_id and bs.product_id = t.product_id and bs.sku_id = t.sku_id left join sales_rate sr on sr.branch_id = t.branch_id and sr.sku_id = t.sku_id left join warehouse_stock ws on ws.product_id = t.product_id and ws.sku_id = t.sku_id where t.status = 'active';

alter table public.sales_orders enable row level security;
alter table public.retailer_sales_reports enable row level security;
alter table public.inventory_returns enable row level security;
alter table public.retailer_stock_reconciliations enable row level security;
alter table public.replenishment_targets enable row level security;

revoke all on public.sales_orders, public.retailer_sales_reports, public.inventory_returns, public.retailer_stock_reconciliations, public.replenishment_targets from anon, authenticated;
grant select on public.sales_orders, public.retailer_sales_reports, public.inventory_returns, public.retailer_stock_reconciliations, public.replenishment_targets to authenticated;
grant select on public.retailer_sell_through, public.replenishment_recommendations to authenticated;

drop policy if exists sales_orders_read on public.sales_orders;
create policy sales_orders_read on public.sales_orders for select to authenticated using (public.has_permission('sales.view') or public.has_permission('financial.view') or public.has_permission('audit.view') or retailer_id = public.current_user_retailer_id());
drop policy if exists retailer_sales_reports_read on public.retailer_sales_reports;
create policy retailer_sales_reports_read on public.retailer_sales_reports for select to authenticated using (public.has_permission('sales.view') or public.has_permission('audit.view') or public.has_permission('financial.view') or retailer_id = public.current_user_retailer_id());
drop policy if exists inventory_returns_read on public.inventory_returns;
create policy inventory_returns_read on public.inventory_returns for select to authenticated using (public.has_permission('returns.view') or public.has_permission('audit.view') or retailer_id = public.current_user_retailer_id());
drop policy if exists reconciliations_read on public.retailer_stock_reconciliations;
create policy reconciliations_read on public.retailer_stock_reconciliations for select to authenticated using (public.has_permission('inventory.view') or public.has_permission('audit.view') or retailer_id = public.current_user_retailer_id());
drop policy if exists replenishment_targets_read on public.replenishment_targets;
create policy replenishment_targets_read on public.replenishment_targets for select to authenticated using (public.has_permission('replenishment.view') or public.has_permission('audit.view') or retailer_id = public.current_user_retailer_id());

grant execute on function public.create_sales_order(text, date, text, uuid, uuid, uuid, uuid, integer, numeric, numeric, uuid, uuid, text, text, text) to authenticated;
grant execute on function public.confirm_sales_order(uuid) to authenticated;
grant execute on function public.fulfil_sales_order(uuid, text) to authenticated;
grant execute on function public.cancel_sales_order(uuid, text) to authenticated;
grant execute on function public.refund_sales_order(uuid, text, uuid, text) to authenticated;
grant execute on function public.create_retailer_sales_report(text, date, date, date, uuid, uuid, uuid, uuid, uuid, integer, integer, integer, integer, uuid, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.post_retailer_sales_report(uuid, text) to authenticated;
grant execute on function public.cancel_retailer_sales_report(uuid, text) to authenticated;
grant execute on function public.create_inventory_return(text, text, date, uuid, uuid, uuid, uuid, uuid, uuid, uuid, integer, text, text) to authenticated;
grant execute on function public.post_inventory_return(uuid, text) to authenticated;
grant execute on function public.create_retailer_reconciliation(text, date, uuid, uuid, uuid, uuid, uuid, integer, text) to authenticated;
grant execute on function public.post_retailer_reconciliation(uuid) to authenticated;
grant execute on function public.save_replenishment_target(uuid, uuid, uuid, uuid, integer, integer, integer) to authenticated;

comment on table public.sales_orders is 'Stage 5 sales workflow. Fulfilment creates an immutable issue movement; cancellation creates none; refunds create a reversal/return movement.';
comment on table public.retailer_sales_reports is 'Stage 5 retailer sell-through reports. Posted quantity components create the corresponding immutable ledger movements.';
comment on table public.inventory_returns is 'Stage 5 customer and retailer returns. Returned stock is routed by condition and never silently made sellable.';
comment on view public.retailer_sell_through is 'Calculated Stage 5 retailer sell-through. Values are derived from posted reports and the immutable ledger.';
comment on view public.replenishment_recommendations is 'Stage 5 planning suggestions only. No automatic stock transfer is performed.';

commit;

-- GoodLivin Stage 6: suppliers, purchase orders, payments and inbound planning.
--
-- Purchase orders are workflow documents. They never write inventory until an
-- approved quantity is physically accepted by receive_purchase_order_line().
-- All stock changes continue to use the immutable Stage 4 stock_movements
-- ledger and all mutations are transaction-scoped security-definer functions.

begin;

alter table public.manufacturers
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists city text,
  add column if not exists country text default 'Sri Lanka',
  add column if not exists default_currency char(3) default 'LKR',
  add column if not exists standard_lead_time_days integer not null default 0,
  add column if not exists minimum_order_quantity integer not null default 0,
  add column if not exists payment_terms text,
  add column if not exists tax_registration_details text;

alter table public.suppliers
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists city text,
  add column if not exists country text default 'Sri Lanka',
  add column if not exists default_currency char(3) default 'LKR',
  add column if not exists standard_lead_time_days integer not null default 0,
  add column if not exists minimum_order_quantity integer not null default 0,
  add column if not exists payment_terms text,
  add column if not exists tax_registration_details text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'manufacturers_lead_time_check') then
    alter table public.manufacturers add constraint manufacturers_lead_time_check check (standard_lead_time_days >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'manufacturers_moq_check') then
    alter table public.manufacturers add constraint manufacturers_moq_check check (minimum_order_quantity >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'suppliers_lead_time_check') then
    alter table public.suppliers add constraint suppliers_lead_time_check check (standard_lead_time_days >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'suppliers_moq_check') then
    alter table public.suppliers add constraint suppliers_moq_check check (minimum_order_quantity >= 0);
  end if;
end $$;

create table if not exists public.supplier_product_catalog (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id),
  manufacturer_id uuid references public.manufacturers(id),
  product_id uuid not null references public.products(id),
  sku_id uuid not null references public.product_skus(id),
  supplier_sku_code text,
  unit_cost numeric(14, 2) not null default 0 check (unit_cost >= 0),
  currency_code char(3) not null default 'LKR',
  minimum_order_quantity integer not null default 0 check (minimum_order_quantity >= 0),
  lead_time_days integer not null default 0 check (lead_time_days >= 0),
  is_default boolean not null default false,
  status public.record_status not null default 'active',
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (supplier_id is not null or manufacturer_id is not null),
  unique (supplier_id, sku_id),
  unique (manufacturer_id, sku_id)
);

create sequence if not exists public.purchase_order_number_seq;

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique default ('GL-PO-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.purchase_order_number_seq')::text, 5, '0')),
  supplier_id uuid references public.suppliers(id),
  manufacturer_id uuid references public.manufacturers(id),
  order_date date not null default current_date,
  expected_production_completion_date date,
  expected_delivery_date date,
  receiving_location_id uuid not null references public.inventory_locations(id),
  currency_code char(3) not null default 'LKR',
  payment_terms text,
  deposit_required numeric(16, 2) not null default 0 check (deposit_required >= 0),
  discount_amount numeric(16, 2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(16, 2) not null default 0 check (tax_amount >= 0),
  shipping_amount numeric(16, 2) not null default 0 check (shipping_amount >= 0),
  additional_costs numeric(16, 2) not null default 0 check (additional_costs >= 0),
  subtotal numeric(16, 2) not null default 0 check (subtotal >= 0),
  total_amount numeric(16, 2) not null default 0 check (total_amount >= 0),
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'sent_to_supplier', 'in_production', 'partially_ready', 'ready_for_dispatch', 'in_transit', 'partially_received', 'fully_received', 'cancelled')),
  notes text,
  created_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  cancelled_by uuid references auth.users(id),
  cancelled_at timestamptz,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (supplier_id is not null or manufacturer_id is not null),
  check (expected_production_completion_date is null or expected_production_completion_date >= order_date),
  check (expected_delivery_date is null or expected_delivery_date >= order_date),
  check (status <> 'approved' or (approved_by is not null and approved_at is not null))
);

create table if not exists public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  line_number integer not null,
  product_id uuid not null references public.products(id),
  sku_id uuid not null references public.product_skus(id),
  quantity_ordered integer not null check (quantity_ordered > 0),
  unit_cost numeric(14, 2) not null check (unit_cost >= 0),
  discount_amount numeric(14, 2) not null default 0 check (discount_amount >= 0),
  line_total numeric(16, 2) generated always as (greatest(quantity_ordered * unit_cost - discount_amount, 0)) stored,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (purchase_order_id, line_number),
  check (discount_amount <= quantity_ordered * unit_cost)
);

create table if not exists public.purchase_order_status_history (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid not null references auth.users(id),
  reason text,
  changed_at timestamptz not null default now()
);

create table if not exists public.purchase_order_payments (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id),
  payment_number text not null unique,
  payment_type text not null check (payment_type in ('deposit', 'intermediate', 'final', 'other')),
  payment_date date not null,
  amount numeric(16, 2) not null check (amount > 0),
  currency_code char(3) not null default 'LKR',
  payment_method text not null,
  reference_number text,
  attachment_id uuid references public.attachments(id),
  overpayment_reason text,
  entered_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (purchase_order_id, reference_number)
);

create table if not exists public.purchase_order_attachments (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  attachment_id uuid not null references public.attachments(id),
  document_type text not null check (document_type in ('quotation', 'proforma_invoice', 'commercial_invoice', 'payment_confirmation', 'delivery_note', 'certificate_of_analysis', 'quality_compliance', 'other')),
  added_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (purchase_order_id, attachment_id)
);

create table if not exists public.purchase_order_receipts (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id),
  purchase_order_line_id uuid not null references public.purchase_order_lines(id),
  receipt_number text not null unique,
  received_on date not null,
  receiving_location_id uuid not null references public.inventory_locations(id),
  batch_id uuid references public.product_batches(id),
  batch_number text,
  manufactured_on date,
  expires_on date,
  quantity_accepted integer not null default 0 check (quantity_accepted >= 0),
  quantity_damaged integer not null default 0 check (quantity_damaged >= 0),
  quantity_rejected integer not null default 0 check (quantity_rejected >= 0),
  quantity_quarantined integer not null default 0 check (quantity_quarantined >= 0),
  total_received integer generated always as (quantity_accepted + quantity_damaged + quantity_rejected + quantity_quarantined) stored,
  attachment_id uuid references public.attachments(id),
  notes text,
  status text not null default 'posted' check (status in ('posted', 'cancelled')),
  movement_id uuid references public.stock_movements(id),
  created_by uuid not null references auth.users(id),
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  check (total_received > 0),
  check (status <> 'posted' or posted_at is not null),
  check (expires_on is null or manufactured_on is null or expires_on > manufactured_on)
);

create index if not exists supplier_product_catalog_sku_idx on public.supplier_product_catalog (sku_id, status);
create index if not exists purchase_orders_status_delivery_idx on public.purchase_orders (status, expected_delivery_date, created_at desc);
create index if not exists purchase_order_lines_order_idx on public.purchase_order_lines (purchase_order_id, line_number);
create index if not exists purchase_order_status_history_order_idx on public.purchase_order_status_history (purchase_order_id, changed_at desc);
create index if not exists purchase_order_payments_order_idx on public.purchase_order_payments (purchase_order_id, payment_date desc);
create index if not exists purchase_order_receipts_order_idx on public.purchase_order_receipts (purchase_order_id, created_at desc);

create or replace function public.stage6_validate_supplier_catalog()
returns trigger language plpgsql security definer set search_path = public as $$
declare product_status public.record_status; sku_product uuid; sku_status public.record_status;
begin
  if new.supplier_id is not null and not exists (select 1 from public.suppliers where id = new.supplier_id and status = 'active') then raise exception 'Archived or missing supplier cannot be used'; end if;
  if new.manufacturer_id is not null and not exists (select 1 from public.manufacturers where id = new.manufacturer_id and status = 'active') then raise exception 'Archived or missing manufacturer cannot be used'; end if;
  select status into product_status from public.products where id = new.product_id;
  select product_id, status into sku_product, sku_status from public.product_skus where id = new.sku_id;
  if product_status is distinct from 'active'::public.record_status or sku_product is null or sku_product <> new.product_id or sku_status is distinct from 'active'::public.record_status then raise exception 'Only active related products and SKUs can be supplied'; end if;
  return new;
end;
$$;

drop trigger if exists supplier_catalog_reference_guard on public.supplier_product_catalog;
create trigger supplier_catalog_reference_guard before insert or update on public.supplier_product_catalog for each row execute function public.stage6_validate_supplier_catalog();

create or replace function public.stage6_recompute_purchase_order_totals()
returns trigger language plpgsql security definer set search_path = public as $$
declare order_id uuid := coalesce(new.purchase_order_id, old.purchase_order_id); begin
  update public.purchase_orders po
  set subtotal = coalesce((select sum(line_total) from public.purchase_order_lines where purchase_order_id = order_id), 0),
      total_amount = greatest(coalesce((select sum(line_total) from public.purchase_order_lines where purchase_order_id = order_id), 0) - po.discount_amount + po.tax_amount + po.shipping_amount + po.additional_costs, 0),
      updated_at = now()
  where po.id = order_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists purchase_order_lines_totals on public.purchase_order_lines;
create trigger purchase_order_lines_totals after insert or update or delete on public.purchase_order_lines for each row execute function public.stage6_recompute_purchase_order_totals();

create or replace function public.stage6_protect_procurement_records()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('goodlivin.stage6_internal', true) = 'on' then return coalesce(new, old); end if;
  if tg_table_name = 'purchase_orders' and (tg_op = 'DELETE' or old.status not in ('draft')) then raise exception 'Approved or completed purchase orders are immutable; use a controlled workflow action'; end if;
  if tg_table_name = 'purchase_order_lines' and tg_op in ('UPDATE', 'DELETE') and exists (select 1 from public.purchase_orders where id = old.purchase_order_id and status <> 'draft') then raise exception 'Lines on approved purchase orders cannot be edited'; end if;
  if tg_table_name = 'purchase_order_payments' and tg_op = 'DELETE' then raise exception 'Payments are immutable; add a correcting payment record'; end if;
  if tg_table_name = 'purchase_order_receipts' and (tg_op = 'DELETE' or old.status = 'posted') then raise exception 'Posted purchase-order receipts are immutable'; end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists purchase_orders_workflow_guard on public.purchase_orders;
create trigger purchase_orders_workflow_guard before update or delete on public.purchase_orders for each row execute function public.stage6_protect_procurement_records();
drop trigger if exists purchase_order_lines_workflow_guard on public.purchase_order_lines;
create trigger purchase_order_lines_workflow_guard before update or delete on public.purchase_order_lines for each row execute function public.stage6_protect_procurement_records();
drop trigger if exists purchase_order_payments_workflow_guard on public.purchase_order_payments;
create trigger purchase_order_payments_workflow_guard before delete on public.purchase_order_payments for each row execute function public.stage6_protect_procurement_records();
drop trigger if exists purchase_order_receipts_workflow_guard on public.purchase_order_receipts;
create trigger purchase_order_receipts_workflow_guard before update or delete on public.purchase_order_receipts for each row execute function public.stage6_protect_procurement_records();

do $$
declare table_name text;
begin
  foreach table_name in array array['supplier_product_catalog','purchase_orders','purchase_order_lines'] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array['supplier_product_catalog','purchase_orders','purchase_order_lines','purchase_order_status_history','purchase_order_payments','purchase_order_attachments','purchase_order_receipts'] loop
    execute format('drop trigger if exists %I_audit on public.%I', table_name, table_name);
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row_change()', table_name, table_name);
  end loop;
end $$;

create or replace function public.stage6_require_active_po_reference(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare po public.purchase_orders; location_status public.record_status;
begin
  select * into po from public.purchase_orders where id = p_order_id;
  if po.id is null then raise exception 'Purchase order not found'; end if;
  if po.status = 'cancelled' then raise exception 'Cancelled purchase orders cannot be used'; end if;
  select status into location_status from public.inventory_locations where id = po.receiving_location_id;
  if location_status is distinct from 'active'::public.record_status then raise exception 'Archived receiving locations cannot be used'; end if;
end;
$$;

create or replace function public.save_purchase_order(
  p_purchase_order_id uuid,
  p_supplier_id uuid,
  p_manufacturer_id uuid,
  p_order_date date,
  p_expected_production_completion_date date,
  p_expected_delivery_date date,
  p_receiving_location_id uuid,
  p_currency_code text,
  p_payment_terms text,
  p_deposit_required numeric,
  p_discount_amount numeric,
  p_tax_amount numeric,
  p_shipping_amount numeric,
  p_additional_costs numeric,
  p_notes text,
  p_lines jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare order_id uuid; order_status text; line_record record; line_number integer := 0; product_status public.record_status; sku_product uuid; sku_status public.record_status; location_status public.record_status;
begin
  if not public.has_permission('purchasing.manage') then raise exception 'You do not have permission to manage purchase orders'; end if;
  if p_supplier_id is null and p_manufacturer_id is null then raise exception 'A supplier or manufacturer is required'; end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then raise exception 'At least one purchase-order line is required'; end if;
  if coalesce(p_deposit_required, 0) < 0 or coalesce(p_discount_amount, 0) < 0 or coalesce(p_tax_amount, 0) < 0 or coalesce(p_shipping_amount, 0) < 0 or coalesce(p_additional_costs, 0) < 0 then raise exception 'Purchase-order costs cannot be negative'; end if;
  if p_supplier_id is not null and not exists (select 1 from public.suppliers where id = p_supplier_id and status = 'active') then raise exception 'Archived or missing supplier cannot be used'; end if;
  if p_manufacturer_id is not null and not exists (select 1 from public.manufacturers where id = p_manufacturer_id and status = 'active') then raise exception 'Archived or missing manufacturer cannot be used'; end if;
  select status into location_status from public.inventory_locations where id = p_receiving_location_id;
  if location_status is distinct from 'active'::public.record_status then raise exception 'Archived or missing receiving location cannot be used'; end if;
  perform set_config('goodlivin.stage6_internal', 'on', true);
  if p_purchase_order_id is null then
    insert into public.purchase_orders (supplier_id, manufacturer_id, order_date, expected_production_completion_date, expected_delivery_date, receiving_location_id, currency_code, payment_terms, deposit_required, discount_amount, tax_amount, shipping_amount, additional_costs, notes, created_by)
    values (p_supplier_id, p_manufacturer_id, p_order_date, p_expected_production_completion_date, p_expected_delivery_date, p_receiving_location_id, upper(coalesce(p_currency_code, 'LKR')), nullif(trim(p_payment_terms), ''), coalesce(p_deposit_required, 0), coalesce(p_discount_amount, 0), coalesce(p_tax_amount, 0), coalesce(p_shipping_amount, 0), coalesce(p_additional_costs, 0), nullif(trim(p_notes), ''), auth.uid()) returning id into order_id;
  else
    select status into order_status from public.purchase_orders where id = p_purchase_order_id for update;
    if order_status is null then raise exception 'Purchase order not found'; end if;
    if order_status <> 'draft' then raise exception 'Only draft purchase orders can be edited'; end if;
    update public.purchase_orders set supplier_id = p_supplier_id, manufacturer_id = p_manufacturer_id, order_date = p_order_date, expected_production_completion_date = p_expected_production_completion_date, expected_delivery_date = p_expected_delivery_date, receiving_location_id = p_receiving_location_id, currency_code = upper(coalesce(p_currency_code, 'LKR')), payment_terms = nullif(trim(p_payment_terms), ''), deposit_required = coalesce(p_deposit_required, 0), discount_amount = coalesce(p_discount_amount, 0), tax_amount = coalesce(p_tax_amount, 0), shipping_amount = coalesce(p_shipping_amount, 0), additional_costs = coalesce(p_additional_costs, 0), notes = nullif(trim(p_notes), '') where id = p_purchase_order_id;
    order_id := p_purchase_order_id;
    delete from public.purchase_order_lines where purchase_order_id = order_id;
  end if;
  for line_record in select * from jsonb_to_recordset(p_lines) as x(product_id uuid, sku_id uuid, quantity_ordered integer, unit_cost numeric, discount_amount numeric, notes text) loop
    line_number := line_number + 1;
    if line_record.quantity_ordered is null or line_record.quantity_ordered <= 0 or line_record.unit_cost is null or line_record.unit_cost < 0 or coalesce(line_record.discount_amount, 0) < 0 or coalesce(line_record.discount_amount, 0) > line_record.quantity_ordered * line_record.unit_cost then raise exception 'Purchase-order line quantity, cost or discount is invalid'; end if;
    select status into product_status from public.products where id = line_record.product_id;
    select product_id, status into sku_product, sku_status from public.product_skus where id = line_record.sku_id;
    if product_status is distinct from 'active'::public.record_status or sku_product is null or sku_product <> line_record.product_id or sku_status is distinct from 'active'::public.record_status then raise exception 'Only active related products and SKUs can be ordered'; end if;
    insert into public.purchase_order_lines (purchase_order_id, line_number, product_id, sku_id, quantity_ordered, unit_cost, discount_amount, notes) values (order_id, line_number, line_record.product_id, line_record.sku_id, line_record.quantity_ordered, line_record.unit_cost, coalesce(line_record.discount_amount, 0), nullif(trim(line_record.notes), ''));
  end loop;
  perform public.write_audit_log('purchase_orders', order_id, case when p_purchase_order_id is null then 'created' else 'updated' end, null, (select to_jsonb(po) from public.purchase_orders po where po.id = order_id), null);
  return order_id;
end;
$$;

create or replace function public.change_purchase_order_status(p_purchase_order_id uuid, p_status text, p_reason text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare current_status text; allowed boolean := false;
begin
  select status into current_status from public.purchase_orders where id = p_purchase_order_id for update;
  if current_status is null then raise exception 'Purchase order not found'; end if;
  if p_status not in ('pending_approval','approved','sent_to_supplier','in_production','partially_ready','ready_for_dispatch','in_transit','cancelled') then raise exception 'Invalid purchase-order status'; end if;
  if p_status = 'approved' then
    if not public.is_admin() then raise exception 'Only Director/Admin can approve purchase orders'; end if;
    allowed := current_status = 'pending_approval';
  elsif p_status = 'pending_approval' then allowed := public.has_permission('purchasing.manage') and current_status = 'draft';
  elsif p_status = 'cancelled' then allowed := public.has_permission('purchasing.manage') and current_status in ('draft','pending_approval','approved','sent_to_supplier','in_production','partially_ready','ready_for_dispatch','in_transit','partially_received');
  else allowed := public.has_permission('purchasing.manage') and current_status in ('approved','sent_to_supplier','in_production','partially_ready','ready_for_dispatch'); end if;
  if not allowed then raise exception 'Purchase-order status transition is not permitted'; end if;
  if p_status = 'cancelled' and nullif(trim(p_reason), '') is null then raise exception 'A cancellation reason is required'; end if;
  perform set_config('goodlivin.stage6_internal', 'on', true);
  update public.purchase_orders set status = p_status, approved_by = case when p_status = 'approved' then auth.uid() else approved_by end, approved_at = case when p_status = 'approved' then now() else approved_at end, cancelled_by = case when p_status = 'cancelled' then auth.uid() else cancelled_by end, cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end, cancelled_reason = case when p_status = 'cancelled' then trim(p_reason) else cancelled_reason end where id = p_purchase_order_id;
  insert into public.purchase_order_status_history (purchase_order_id, from_status, to_status, changed_by, reason) values (p_purchase_order_id, current_status, p_status, auth.uid(), nullif(trim(p_reason), ''));
  return p_purchase_order_id;
end;
$$;

create or replace function public.record_purchase_order_payment(
  p_purchase_order_id uuid,
  p_payment_number text,
  p_payment_type text,
  p_payment_date date,
  p_amount numeric,
  p_currency_code text,
  p_payment_method text,
  p_reference_number text,
  p_attachment_id uuid,
  p_overpayment_reason text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare payment_id uuid; total_amount numeric; paid_amount numeric;
begin
  if not (public.has_permission('purchasing.payments') or public.has_permission('financial.manage')) then raise exception 'You do not have permission to record purchase-order payments'; end if;
  if nullif(trim(p_payment_number), '') is null or p_amount is null or p_amount <= 0 then raise exception 'Payment number and positive amount are required'; end if;
  select po.total_amount into total_amount from public.purchase_orders po where po.id = p_purchase_order_id for update;
  if total_amount is null then raise exception 'Purchase order not found'; end if;
  select coalesce(sum(amount), 0) into paid_amount from public.purchase_order_payments where purchase_order_id = p_purchase_order_id;
  if paid_amount + p_amount > total_amount and (not public.is_admin() or nullif(trim(p_overpayment_reason), '') is null) then raise exception 'Payment exceeds purchase-order total; Director/Admin overpayment reason required'; end if;
  insert into public.purchase_order_payments (purchase_order_id, payment_number, payment_type, payment_date, amount, currency_code, payment_method, reference_number, attachment_id, overpayment_reason, entered_by) values (p_purchase_order_id, trim(p_payment_number), p_payment_type, p_payment_date, p_amount, upper(coalesce(p_currency_code, 'LKR')), trim(p_payment_method), nullif(trim(p_reference_number), ''), p_attachment_id, nullif(trim(p_overpayment_reason), ''), auth.uid()) returning id into payment_id;
  return payment_id;
end;
$$;

create or replace function public.receive_purchase_order_line(
  p_purchase_order_id uuid,
  p_purchase_order_line_id uuid,
  p_receipt_number text,
  p_received_on date,
  p_receiving_location_id uuid,
  p_batch_id uuid,
  p_batch_number text,
  p_manufactured_on date,
  p_expires_on date,
  p_quantity_accepted integer,
  p_quantity_damaged integer,
  p_quantity_rejected integer,
  p_quantity_quarantined integer,
  p_attachment_id uuid,
  p_notes text,
  p_variance_reason text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare po public.purchase_orders; line public.purchase_order_lines; receipt_id uuid; receive_movement_id uuid; selected_batch uuid := p_batch_id; total_new integer; total_prior integer; batch_product uuid; batch_sku uuid; batch_quality text; batch_expiry date; location_status public.record_status; line_received integer; all_received boolean; any_received boolean;
begin
  if not (public.has_permission('purchasing.receive') or public.has_permission('inventory.post')) then raise exception 'You do not have permission to receive purchase-order stock'; end if;
  if p_quantity_accepted < 0 or p_quantity_damaged < 0 or p_quantity_rejected < 0 or p_quantity_quarantined < 0 then raise exception 'Receipt quantities cannot be negative'; end if;
  total_new := coalesce(p_quantity_accepted, 0) + coalesce(p_quantity_damaged, 0) + coalesce(p_quantity_rejected, 0) + coalesce(p_quantity_quarantined, 0);
  if total_new <= 0 then raise exception 'At least one received quantity is required'; end if;
  select * into po from public.purchase_orders where id = p_purchase_order_id for update;
  select * into line from public.purchase_order_lines where id = p_purchase_order_line_id and purchase_order_id = p_purchase_order_id for update;
  if po.id is null or line.id is null then raise exception 'Purchase-order or line not found'; end if;
  if po.status in ('draft','pending_approval','cancelled','fully_received') then raise exception 'Purchase order is not eligible for receiving'; end if;
  select status into location_status from public.inventory_locations where id = p_receiving_location_id;
  if location_status is distinct from 'active'::public.record_status then raise exception 'Archived receiving locations cannot be used'; end if;
  select coalesce(sum(total_received), 0) into total_prior from public.purchase_order_receipts where purchase_order_line_id = line.id and status = 'posted';
  if total_prior + total_new > line.quantity_ordered and (not public.is_admin() or nullif(trim(p_variance_reason), '') is null) then raise exception 'Receiving exceeds ordered quantity; Director/Admin variance reason required'; end if;
  if p_quantity_accepted > 0 then
    if selected_batch is null and nullif(trim(p_batch_number), '') is null then raise exception 'Accepted stock requires a batch number or existing batch'; end if;
    if selected_batch is null then
      insert into public.product_batches (product_id, sku_id, batch_number, manufactured_on, expires_on, supplier_id, purchase_cost, unit_cost, quality_status, received_on, initial_quantity, created_by, notes) values (line.product_id, line.sku_id, trim(p_batch_number), p_manufactured_on, p_expires_on, po.supplier_id, line.unit_cost, line.unit_cost, 'approved', p_received_on, p_quantity_accepted, auth.uid(), nullif(trim(p_notes), '')) returning id into selected_batch;
    else
      select product_id, sku_id, quality_status, expires_on into batch_product, batch_sku, batch_quality, batch_expiry from public.product_batches where id = selected_batch for update;
      if batch_product is null or batch_product <> line.product_id or batch_sku <> line.sku_id or batch_quality <> 'approved' or batch_expiry < p_received_on then raise exception 'Selected batch is not an active eligible batch for this purchase-order line'; end if;
    end if;
  end if;
  perform set_config('goodlivin.stage6_internal', 'on', true);
  insert into public.purchase_order_receipts (purchase_order_id, purchase_order_line_id, receipt_number, received_on, receiving_location_id, batch_id, batch_number, manufactured_on, expires_on, quantity_accepted, quantity_damaged, quantity_rejected, quantity_quarantined, attachment_id, notes, status, created_by, posted_at) values (po.id, line.id, trim(p_receipt_number), p_received_on, p_receiving_location_id, selected_batch, nullif(trim(p_batch_number), ''), p_manufactured_on, p_expires_on, p_quantity_accepted, p_quantity_damaged, p_quantity_rejected, p_quantity_quarantined, p_attachment_id, nullif(trim(p_notes), ''), 'posted', auth.uid(), now()) returning id into receipt_id;
  if p_quantity_accepted > 0 then
    insert into public.stock_movements (movement_type, status, product_id, sku_id, batch_id, destination_location_id, quantity, unit_cost, reference_type, reference_id, reason, created_by, posted_by, posted_at) values ('receipt', 'posted', line.product_id, line.sku_id, selected_batch, p_receiving_location_id, p_quantity_accepted, line.unit_cost, 'purchase_order_receipt', receipt_id, nullif(trim(p_notes), ''), auth.uid(), auth.uid(), now()) returning id into receive_movement_id;
    update public.purchase_order_receipts por set movement_id = receive_movement_id where por.id = receipt_id;
  end if;
  select coalesce(sum(total_received), 0) into line_received from public.purchase_order_receipts where purchase_order_line_id = line.id and status = 'posted';
  select not exists (select 1 from public.purchase_order_lines pol where pol.purchase_order_id = po.id and coalesce((select sum(por.total_received) from public.purchase_order_receipts por where por.purchase_order_line_id = pol.id and por.status = 'posted'), 0) < pol.quantity_ordered), exists (select 1 from public.purchase_order_receipts por join public.purchase_order_lines pol on pol.id = por.purchase_order_line_id where por.purchase_order_id = po.id and por.status = 'posted') into all_received, any_received;
  update public.purchase_orders set status = case when all_received then 'fully_received' when any_received then 'partially_received' else status end where id = po.id;
  if all_received or any_received then insert into public.purchase_order_status_history (purchase_order_id, from_status, to_status, changed_by, reason) values (po.id, po.status, case when all_received then 'fully_received' else 'partially_received' end, auth.uid(), nullif(trim(p_variance_reason), '')); end if;
  return receipt_id;
end;
$$;

create or replace function public.attach_purchase_order_document(p_purchase_order_id uuid, p_attachment_id uuid, p_document_type text)
returns uuid language plpgsql security definer set search_path = public as $$
declare link_id uuid;
begin
  if not public.has_permission('purchasing.manage') then raise exception 'You do not have permission to attach purchase-order documents'; end if;
  if p_document_type not in ('quotation','proforma_invoice','commercial_invoice','payment_confirmation','delivery_note','certificate_of_analysis','quality_compliance','other') then raise exception 'Document type is invalid'; end if;
  perform public.stage6_require_active_po_reference(p_purchase_order_id);
  insert into public.purchase_order_attachments (purchase_order_id, attachment_id, document_type, added_by) values (p_purchase_order_id, p_attachment_id, p_document_type, auth.uid()) returning id into link_id;
  return link_id;
end;
$$;

create or replace view public.purchase_order_inbound with (security_invoker = true) as
select po.id as purchase_order_id, po.po_number, po.status, po.order_date, po.expected_production_completion_date, po.expected_delivery_date, po.currency_code, po.total_amount, po.created_at, po.supplier_id, coalesce(s.name, m.name) as supplier_name, l.id as receiving_location_id, l.name as receiving_location_name, pol.id as line_id, pol.product_id, p.product_code, p.name as product_name, pol.sku_id, sku.sku_code, sku.sellable_name, pol.quantity_ordered, coalesce((select sum(por.total_received) from public.purchase_order_receipts por where por.purchase_order_line_id = pol.id and por.status = 'posted'), 0)::integer as quantity_received, greatest(0, pol.quantity_ordered - coalesce((select sum(por.total_received) from public.purchase_order_receipts por where por.purchase_order_line_id = pol.id and por.status = 'posted'), 0))::integer as quantity_outstanding, greatest(0, current_date - po.expected_delivery_date)::integer as days_overdue
from public.purchase_orders po join public.purchase_order_lines pol on pol.purchase_order_id = po.id join public.products p on p.id = pol.product_id join public.product_skus sku on sku.id = pol.sku_id join public.inventory_locations l on l.id = po.receiving_location_id left join public.suppliers s on s.id = po.supplier_id left join public.manufacturers m on m.id = po.manufacturer_id
where po.status <> 'cancelled';

create or replace view public.inbound_stock_planning with (security_invoker = true) as
with current_stock as (
  select sb.product_id, pb.sku_id, sum(sb.quantity_on_hand)::integer as current_available_stock
  from public.stock_balances sb join public.product_batches pb on pb.id = sb.batch_id join public.inventory_locations l on l.id = sb.location_id and l.status = 'active' group by sb.product_id, pb.sku_id
), incoming as (
  select pol.product_id, pol.sku_id, sum(greatest(0, pol.quantity_ordered - coalesce((select sum(por.total_received) from public.purchase_order_receipts por where por.purchase_order_line_id = pol.id and por.status = 'posted'), 0)))::integer as incoming_stock
  from public.purchase_orders po join public.purchase_order_lines pol on pol.purchase_order_id = po.id where po.status in ('approved','sent_to_supplier','in_production','partially_ready','ready_for_dispatch','in_transit','partially_received') group by pol.product_id, pol.sku_id
), reorder as (
  select product_id, sku_id, sum(suggested_quantity)::integer as recommended_reorder_quantity from public.replenishment_recommendations group by product_id, sku_id
)
select p.id as product_id, p.product_code, p.name as product_name, sku.id as sku_id, sku.sku_code, sku.sellable_name, coalesce(cs.current_available_stock, 0)::integer as current_available_stock, coalesce(i.incoming_stock, 0)::integer as incoming_stock, coalesce(r.recommended_reorder_quantity, 0)::integer as recommended_reorder_quantity, (coalesce(cs.current_available_stock, 0) + coalesce(i.incoming_stock, 0))::integer as projected_stock_after_incoming
from public.products p join public.product_skus sku on sku.product_id = p.id and sku.status = 'active' left join current_stock cs on cs.product_id = p.id and cs.sku_id = sku.id left join incoming i on i.product_id = p.id and i.sku_id = sku.id left join reorder r on r.product_id = p.id and r.sku_id = sku.id where p.status = 'active';

insert into public.permissions (code, label, description) values
  ('purchasing.view', 'View purchasing', 'View suppliers, purchase orders, payments and inbound planning.'),
  ('purchasing.manage', 'Manage purchasing', 'Create and manage draft purchase orders and supplier catalog data.'),
  ('purchasing.approve', 'Approve purchasing', 'Approve purchase orders for supplier release.'),
  ('purchasing.payments', 'Record purchase payments', 'Record purchase-order payment milestones.'),
  ('purchasing.receive', 'Receive against purchase orders', 'Receive accepted, damaged, rejected and quarantined purchase-order quantities.'),
  ('inbound.view', 'View inbound stock', 'View ordered, incoming and projected stock planning data.')
on conflict (code) do update set label = excluded.label, description = excluded.description;

insert into public.role_permissions (role_code, permission_code)
select 'director_admin', code from public.permissions where code in ('purchasing.view','purchasing.manage','purchasing.approve','purchasing.payments','purchasing.receive','inbound.view') on conflict do nothing;
insert into public.role_permissions (role_code, permission_code) values
  ('inventory_manager','purchasing.view'),('inventory_manager','purchasing.manage'),('inventory_manager','purchasing.receive'),('inventory_manager','inbound.view'),
  ('warehouse_staff','purchasing.view'),('warehouse_staff','purchasing.receive'),('warehouse_staff','inbound.view'),
  ('finance_team','purchasing.view'),('finance_team','purchasing.payments'),('finance_team','inbound.view'),
  ('sales_manager','purchasing.view'),('sales_manager','inbound.view'),
  ('auditor_read_only','purchasing.view'),('auditor_read_only','inbound.view')
on conflict do nothing;

alter table public.supplier_product_catalog enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.purchase_order_status_history enable row level security;
alter table public.purchase_order_payments enable row level security;
alter table public.purchase_order_attachments enable row level security;
alter table public.purchase_order_receipts enable row level security;

grant select on public.supplier_product_catalog, public.purchase_orders, public.purchase_order_lines, public.purchase_order_status_history, public.purchase_order_payments, public.purchase_order_attachments, public.purchase_order_receipts to authenticated;
grant select on public.purchase_order_inbound, public.inbound_stock_planning to authenticated;
revoke insert, update, delete on public.supplier_product_catalog, public.purchase_orders, public.purchase_order_lines, public.purchase_order_status_history, public.purchase_order_payments, public.purchase_order_attachments, public.purchase_order_receipts from authenticated;

drop policy if exists supplier_catalog_read on public.supplier_product_catalog;
create policy supplier_catalog_read on public.supplier_product_catalog for select to authenticated using (public.has_permission('purchasing.view') or public.has_permission('products.view'));
drop policy if exists purchase_orders_read on public.purchase_orders;
create policy purchase_orders_read on public.purchase_orders for select to authenticated using (public.has_permission('purchasing.view') or public.has_permission('financial.view') or public.has_permission('inbound.view'));
drop policy if exists purchase_order_lines_read on public.purchase_order_lines;
create policy purchase_order_lines_read on public.purchase_order_lines for select to authenticated using (exists (select 1 from public.purchase_orders po where po.id = purchase_order_id));
drop policy if exists purchase_order_history_read on public.purchase_order_status_history;
create policy purchase_order_history_read on public.purchase_order_status_history for select to authenticated using (public.has_permission('purchasing.view') or public.has_permission('audit.view'));
drop policy if exists purchase_order_payments_read on public.purchase_order_payments;
create policy purchase_order_payments_read on public.purchase_order_payments for select to authenticated using (public.has_permission('purchasing.payments') or public.has_permission('financial.view') or public.has_permission('audit.view'));
drop policy if exists purchase_order_attachments_read on public.purchase_order_attachments;
create policy purchase_order_attachments_read on public.purchase_order_attachments for select to authenticated using (public.has_permission('purchasing.view') or public.has_permission('attachments.view') or public.has_permission('audit.view'));
drop policy if exists purchase_order_receipts_read on public.purchase_order_receipts;
create policy purchase_order_receipts_read on public.purchase_order_receipts for select to authenticated using (public.has_permission('purchasing.view') or public.has_permission('purchasing.receive') or public.has_permission('inventory.view') or public.has_permission('audit.view'));

grant execute on function public.save_purchase_order(uuid, uuid, uuid, date, date, date, uuid, text, text, numeric, numeric, numeric, numeric, numeric, text, jsonb) to authenticated;
grant execute on function public.change_purchase_order_status(uuid, text, text) to authenticated;
grant execute on function public.record_purchase_order_payment(uuid, text, text, date, numeric, text, text, text, uuid, text) to authenticated;
grant execute on function public.receive_purchase_order_line(uuid, uuid, text, date, uuid, uuid, text, date, date, integer, integer, integer, integer, uuid, text, text) to authenticated;
grant execute on function public.attach_purchase_order_document(uuid, uuid, text) to authenticated;

commit;

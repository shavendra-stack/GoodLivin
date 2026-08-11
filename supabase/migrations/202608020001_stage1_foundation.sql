-- GoodLivin Stage 1 foundation
-- Run this migration in Supabase before enabling live application data.

create extension if not exists pgcrypto;

create type public.record_status as enum ('active', 'archived');
create type public.movement_status as enum ('draft', 'posted', 'reversed');
create type public.approval_status as enum ('pending', 'approved', 'rejected');
create type public.stock_count_status as enum ('draft', 'in_progress', 'submitted', 'posted', 'cancelled');

create table public.roles (
  code text primary key,
  label text not null unique,
  description text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.permissions (
  code text primary key,
  label text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_code text not null references public.roles(code) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_code, permission_code)
);

create table public.manufacturers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  status public.record_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  contact_name text,
  contact_email text,
  contact_phone text,
  status public.record_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.retailers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  legal_name text,
  tax_identifier text,
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,
  status public.record_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.retailer_branches (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id),
  code text not null,
  name text not null,
  address_line_1 text,
  address_line_2 text,
  city text,
  district text,
  contact_name text,
  contact_phone text,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (retailer_id, code)
);

create table public.retailer_commercial_agreements (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id),
  agreement_number text not null unique,
  effective_from date not null,
  effective_to date,
  currency_code char(3) not null default 'LKR' check (currency_code = 'LKR'),
  payment_terms_days integer not null default 30 check (payment_terms_days >= 0),
  default_discount_percent numeric(7, 2) not null default 0 check (default_discount_percent between 0 and 100),
  status public.record_status not null default 'active',
  document_attachment_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (effective_to is null or effective_to >= effective_from)
);

create table public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  location_type text not null check (location_type in ('warehouse', 'retailer_branch', 'quarantine', 'transit', 'production')),
  retailer_id uuid references public.retailers(id),
  branch_id uuid references public.retailer_branches(id),
  address_line_1 text,
  city text,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check ((location_type = 'retailer_branch' and branch_id is not null and retailer_id is not null) or location_type <> 'retailer_branch')
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  product_code text not null unique,
  name text not null,
  description text,
  category text,
  manufacturer_id uuid references public.manufacturers(id),
  supplier_id uuid references public.suppliers(id),
  base_unit text not null default 'unit',
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.product_skus (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  sku_code text not null unique,
  barcode text unique,
  sellable_name text not null,
  pack_size integer not null default 1 check (pack_size > 0),
  unit_price numeric(14, 2) not null default 0 check (unit_price >= 0),
  currency_code char(3) not null default 'LKR' check (currency_code = 'LKR'),
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default 'GoodLivin user',
  phone text,
  retailer_id uuid references public.retailers(id),
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.user_roles (
  id uuid not null default gen_random_uuid() unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_code text not null references public.roles(code),
  assigned_by uuid references auth.users(id),
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_code)
);

create table public.product_batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  sku_id uuid references public.product_skus(id),
  batch_number text not null,
  manufactured_on date,
  expires_on date not null,
  supplier_id uuid references public.suppliers(id),
  purchase_cost numeric(14, 2) check (purchase_cost is null or purchase_cost >= 0),
  currency_code char(3) not null default 'LKR' check (currency_code = 'LKR'),
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (product_id, batch_number),
  check (manufactured_on is null or expires_on >= manufactured_on)
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  movement_number bigint generated always as identity unique,
  movement_type text not null check (movement_type in ('receipt', 'issue', 'transfer', 'return', 'damage', 'wastage', 'adjustment_in', 'adjustment_out', 'production_receipt', 'production_issue')),
  status public.movement_status not null default 'draft',
  product_id uuid not null references public.products(id),
  sku_id uuid references public.product_skus(id),
  batch_id uuid not null references public.product_batches(id),
  source_location_id uuid references public.inventory_locations(id),
  destination_location_id uuid references public.inventory_locations(id),
  quantity integer not null check (quantity > 0),
  unit_cost numeric(14, 2) check (unit_cost is null or unit_cost >= 0),
  currency_code char(3) not null default 'LKR' check (currency_code = 'LKR'),
  transfer_group_id uuid,
  reversal_of_id uuid references public.stock_movements(id),
  reference_type text,
  reference_id uuid,
  reason text,
  override_reason text,
  created_by uuid references auth.users(id),
  posted_by uuid references auth.users(id),
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_location_id is not null or destination_location_id is not null),
  check (source_location_id is null or destination_location_id is null or source_location_id <> destination_location_id),
  check (status <> 'posted' or posted_at is not null),
  check (status <> 'posted' or posted_by is not null or created_by is null)
);

create table public.free_product_requests (
  id uuid primary key default gen_random_uuid(),
  request_number bigint generated always as identity unique,
  retailer_id uuid not null references public.retailers(id),
  branch_id uuid references public.retailer_branches(id),
  product_id uuid not null references public.products(id),
  batch_id uuid references public.product_batches(id),
  quantity integer not null check (quantity > 0),
  requested_by uuid not null references auth.users(id),
  status public.approval_status not null default 'pending',
  business_reason text not null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.approval_records (
  id uuid primary key default gen_random_uuid(),
  record_type text not null,
  record_id uuid not null,
  approval_step integer not null default 1 check (approval_step > 0),
  status public.approval_status not null default 'pending',
  requested_by uuid not null references auth.users(id),
  decided_by uuid references auth.users(id),
  decision_reason text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (record_type, record_id, approval_step),
  check (status = 'pending' or (decided_by is not null and decided_at is not null and nullif(trim(decision_reason), '') is not null))
);

create table public.stock_counts (
  id uuid primary key default gen_random_uuid(),
  count_number bigint generated always as identity unique,
  location_id uuid not null references public.inventory_locations(id),
  status public.stock_count_status not null default 'draft',
  counted_by uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  started_at timestamptz,
  submitted_at timestamptz,
  posted_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stock_count_lines (
  id uuid primary key default gen_random_uuid(),
  stock_count_id uuid not null references public.stock_counts(id) on delete restrict,
  product_id uuid not null references public.products(id),
  batch_id uuid not null references public.product_batches(id),
  expected_quantity integer not null default 0 check (expected_quantity >= 0),
  counted_quantity integer check (counted_quantity is null or counted_quantity >= 0),
  variance_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stock_count_id, batch_id)
);

create table public.production_orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  finished_product_id uuid not null references public.products(id),
  finished_batch_id uuid references public.product_batches(id),
  planned_quantity integer not null check (planned_quantity > 0),
  produced_quantity integer not null default 0 check (produced_quantity >= 0),
  planned_start_on date,
  planned_finish_on date,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed', 'cancelled')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (produced_quantity <= planned_quantity)
);

create table public.returns_damages_wastage (
  id uuid primary key default gen_random_uuid(),
  record_type text not null check (record_type in ('return', 'damage', 'wastage')),
  retailer_id uuid references public.retailers(id),
  branch_id uuid references public.retailer_branches(id),
  product_id uuid not null references public.products(id),
  batch_id uuid not null references public.product_batches(id),
  location_id uuid not null references public.inventory_locations(id),
  quantity integer not null check (quantity > 0),
  reason text not null,
  status public.approval_status not null default 'pending',
  created_by uuid not null references auth.users(id),
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  storage_bucket text not null default 'goodlivin-attachments',
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  record_type text,
  record_id uuid,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  title text not null,
  message text not null,
  record_type text,
  record_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  action text not null,
  table_name text not null,
  record_id uuid,
  reason text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  created_at timestamptz not null default now()
);

create index product_batches_fefo_idx on public.product_batches (product_id, expires_on, created_at) where status = 'active';
create index stock_movements_product_batch_location_idx on public.stock_movements (product_id, batch_id, source_location_id, destination_location_id, status);
create index stock_movements_transfer_group_idx on public.stock_movements (transfer_group_id) where transfer_group_id is not null;
create index retailer_branches_retailer_idx on public.retailer_branches (retailer_id);
create index notifications_recipient_unread_idx on public.notifications (recipient_user_id, created_at) where read_at is null;
create index audit_logs_record_idx on public.audit_logs (table_name, record_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_user_retailer_id()
returns uuid language sql stable security definer set search_path = public as $$
  select retailer_id from public.profiles where user_id = auth.uid();
$$;

create or replace function public.has_role(required_role text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role_code = required_role);
$$;

create or replace function public.has_permission(required_permission text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('director_admin') or exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_code = ur.role_code
    where ur.user_id = auth.uid() and rp.permission_code = required_permission
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('director_admin');
$$;

create or replace function public.write_audit_log(
  p_table_name text,
  p_record_id uuid,
  p_action text,
  p_before_snapshot jsonb default null,
  p_after_snapshot jsonb default null,
  p_reason text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (actor_user_id, action, table_name, record_id, reason, before_snapshot, after_snapshot)
  values (auth.uid(), p_action, p_table_name, p_record_id, p_reason, p_before_snapshot, p_after_snapshot);
end;
$$;

create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  changed_record_id uuid;
begin
  if tg_op = 'DELETE' then
    changed_record_id := old.id;
    perform public.write_audit_log(tg_table_name, changed_record_id, lower(tg_op), to_jsonb(old), null, null);
    return old;
  end if;

  changed_record_id := new.id;
  perform public.write_audit_log(tg_table_name, changed_record_id, lower(tg_op), case when tg_op = 'UPDATE' then to_jsonb(old) else null end, to_jsonb(new), null);
  return new;
end;
$$;

create or replace function public.protect_profile_scope()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.retailer_id is distinct from new.retailer_id and not public.is_admin() then
    raise exception 'Retailer scope can only be changed by a Director/Admin';
  end if;
  return new;
end;
$$;

create or replace function public.validate_stock_movement()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  matching_batch_product uuid;
  available_quantity integer;
  outbound boolean;
begin
  select product_id into matching_batch_product from public.product_batches where id = new.batch_id;
  if matching_batch_product is null or matching_batch_product <> new.product_id then
    raise exception 'Stock movement product must match its batch';
  end if;

  if new.movement_type = 'transfer' and (new.source_location_id is null or new.destination_location_id is null) then
    raise exception 'Transfers require both source and destination locations';
  end if;

  if new.status = 'posted' then
    if new.posted_at is null then new.posted_at = now(); end if;
    if new.posted_by is null and auth.uid() is not null then new.posted_by = auth.uid(); end if;

    outbound := new.source_location_id is not null and new.movement_type in ('issue', 'transfer', 'damage', 'wastage', 'adjustment_out', 'production_issue');
    if outbound then
      select coalesce(sum(case when destination_location_id = new.source_location_id then quantity else 0 end), 0)
        - coalesce(sum(case when source_location_id = new.source_location_id then quantity else 0 end), 0)
      into available_quantity
      from public.stock_movements
      where product_id = new.product_id and batch_id = new.batch_id and status = 'posted' and id <> new.id;

      if available_quantity < new.quantity and (not public.is_admin() or nullif(trim(new.override_reason), '') is null) then
        raise exception 'Insufficient stock. Director/Admin override requires a written reason';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.protect_posted_movement()
returns trigger language plpgsql security invoker as $$
begin
  if tg_op = 'DELETE' and old.status = 'posted' then raise exception 'Posted stock movements cannot be deleted; create a reversal'; end if;
  if tg_op = 'UPDATE' and old.status = 'posted' then raise exception 'Posted stock movements are immutable; create a reversal'; end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.protect_final_approval()
returns trigger language plpgsql security invoker as $$
begin
  if tg_op = 'DELETE' and old.status in ('approved', 'rejected') then raise exception 'Final approval records cannot be deleted'; end if;
  if tg_op = 'UPDATE' and old.status in ('approved', 'rejected') then raise exception 'Final approval records cannot be modified'; end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.set_user_role(target_user_id uuid, new_role_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only Director/Admin users can assign roles'; end if;
  if not exists (select 1 from auth.users where id = target_user_id) then raise exception 'Target user does not exist'; end if;
  if not exists (select 1 from public.roles where code = new_role_code) then raise exception 'Role does not exist'; end if;

  delete from public.user_roles where user_id = target_user_id;
  insert into public.user_roles (user_id, role_code, assigned_by) values (target_user_id, new_role_code, auth.uid());
  perform public.write_audit_log('user_roles', target_user_id, 'role_assignment', null, jsonb_build_object('role_code', new_role_code), 'Role assigned by Director/Admin');
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'GoodLivin user'), '@', 1)))
  on conflict (user_id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace view public.stock_balances with (security_invoker = true) as
select product_id, batch_id, location_id, sum(quantity_delta)::integer as quantity_on_hand
from (
  select product_id, batch_id, source_location_id as location_id, -quantity as quantity_delta
  from public.stock_movements
  where status = 'posted' and source_location_id is not null
  union all
  select product_id, batch_id, destination_location_id as location_id, quantity as quantity_delta
  from public.stock_movements
  where status = 'posted' and destination_location_id is not null
) ledger_entries
group by product_id, batch_id, location_id
having sum(quantity_delta) <> 0;

insert into public.roles (code, label, description, sort_order) values
  ('director_admin', 'Director / Admin', 'Full operational control, approvals, and administrative access.', 1),
  ('inventory_manager', 'Inventory Manager', 'Inventory, batches, transfers, counts, and replenishment oversight.', 2),
  ('warehouse_staff', 'Warehouse Staff', 'Day-to-day warehouse handling and stock-count execution.', 3),
  ('finance_team', 'Finance Team', 'Commercial agreements, costs, and financial reporting access.', 4),
  ('sales_manager', 'Sales Manager', 'Retailer relationships, agreements, and sales-facing workflows.', 5),
  ('retailer_user', 'Retailer User', 'Scoped access to the assigned retailer and its branches.', 6),
  ('auditor_read_only', 'Auditor / Read-only', 'Read-only visibility for review and audit activities.', 7)
on conflict (code) do update set label = excluded.label, description = excluded.description, sort_order = excluded.sort_order;

insert into public.permissions (code, label, description) values
  ('dashboard.view', 'View dashboard', 'View the operations dashboard.'),
  ('products.view', 'View products', 'View products and sellable SKUs.'),
  ('products.manage', 'Manage products', 'Create, edit, and archive product master data.'),
  ('batches.view', 'View batches', 'View batches, expiry dates, and FEFO information.'),
  ('inventory.view', 'View inventory', 'View stock balances and movements.'),
  ('inventory.create', 'Create inventory movements', 'Create draft stock movements.'),
  ('inventory.post', 'Post inventory movements', 'Post or reverse stock movements.'),
  ('retailers.view', 'View retailers', 'View retailers and branches.'),
  ('retailers.manage', 'Manage retailers', 'Create, edit, and archive retailers and branches.'),
  ('agreements.view', 'View agreements', 'View commercial agreements.'),
  ('agreements.manage', 'Manage agreements', 'Create and edit commercial agreements.'),
  ('free_product_requests.view', 'View free-product requests', 'View free-product requests.'),
  ('free_product_requests.create', 'Create free-product requests', 'Create free-product requests.'),
  ('free_product_requests.approve', 'Approve free-product requests', 'Approve or reject requests.'),
  ('replenishment.view', 'View replenishment', 'View replenishment needs.'),
  ('replenishment.manage', 'Manage replenishment', 'Create and manage replenishment plans.'),
  ('production.view', 'View production', 'View production orders.'),
  ('production.manage', 'Manage production', 'Create and manage production orders.'),
  ('stock_counts.view', 'View stock counts', 'View stock-count sessions.'),
  ('stock_counts.create', 'Create stock counts', 'Create and submit stock counts.'),
  ('stock_counts.post', 'Post stock counts', 'Post approved count variances.'),
  ('reports.view', 'View reports', 'View operational and financial reports.'),
  ('reports.export', 'Export reports', 'Export reports.'),
  ('notifications.view', 'View notifications', 'View personal notifications.'),
  ('settings.view', 'View settings', 'View personal settings.'),
  ('users.manage', 'Manage users', 'Invite users and assign roles.'),
  ('roles.manage', 'Manage roles', 'Manage role definitions and assignments.'),
  ('audit.view', 'View audit logs', 'View audit history.'),
  ('attachments.view', 'View attachments', 'View record attachments.'),
  ('attachments.upload', 'Upload attachments', 'Upload record attachments.'),
  ('financial.view', 'View financial data', 'View costs, prices, and agreements.'),
  ('financial.manage', 'Manage financial data', 'Edit financial data.')
on conflict (code) do update set label = excluded.label, description = excluded.description;

insert into public.role_permissions (role_code, permission_code)
select 'director_admin', code from public.permissions
on conflict do nothing;

insert into public.role_permissions (role_code, permission_code) values
  ('inventory_manager', 'dashboard.view'), ('inventory_manager', 'products.view'), ('inventory_manager', 'products.manage'), ('inventory_manager', 'batches.view'), ('inventory_manager', 'inventory.view'), ('inventory_manager', 'inventory.create'), ('inventory_manager', 'inventory.post'), ('inventory_manager', 'replenishment.view'), ('inventory_manager', 'replenishment.manage'), ('inventory_manager', 'stock_counts.view'), ('inventory_manager', 'stock_counts.create'), ('inventory_manager', 'stock_counts.post'), ('inventory_manager', 'reports.view'), ('inventory_manager', 'notifications.view'),
  ('warehouse_staff', 'dashboard.view'), ('warehouse_staff', 'products.view'), ('warehouse_staff', 'batches.view'), ('warehouse_staff', 'inventory.view'), ('warehouse_staff', 'inventory.create'), ('warehouse_staff', 'stock_counts.view'), ('warehouse_staff', 'stock_counts.create'), ('warehouse_staff', 'notifications.view'),
  ('finance_team', 'dashboard.view'), ('finance_team', 'products.view'), ('finance_team', 'agreements.view'), ('finance_team', 'agreements.manage'), ('finance_team', 'financial.view'), ('finance_team', 'financial.manage'), ('finance_team', 'reports.view'), ('finance_team', 'reports.export'), ('finance_team', 'notifications.view'),
  ('sales_manager', 'dashboard.view'), ('sales_manager', 'products.view'), ('sales_manager', 'retailers.view'), ('sales_manager', 'retailers.manage'), ('sales_manager', 'agreements.view'), ('sales_manager', 'agreements.manage'), ('sales_manager', 'free_product_requests.view'), ('sales_manager', 'free_product_requests.create'), ('sales_manager', 'replenishment.view'), ('sales_manager', 'notifications.view'),
  ('retailer_user', 'dashboard.view'), ('retailer_user', 'products.view'), ('retailer_user', 'inventory.view'), ('retailer_user', 'retailers.view'), ('retailer_user', 'free_product_requests.view'), ('retailer_user', 'free_product_requests.create'), ('retailer_user', 'replenishment.view'), ('retailer_user', 'notifications.view'), ('retailer_user', 'attachments.view'), ('retailer_user', 'attachments.upload'),
  ('auditor_read_only', 'dashboard.view'), ('auditor_read_only', 'products.view'), ('auditor_read_only', 'batches.view'), ('auditor_read_only', 'inventory.view'), ('auditor_read_only', 'retailers.view'), ('auditor_read_only', 'agreements.view'), ('auditor_read_only', 'free_product_requests.view'), ('auditor_read_only', 'replenishment.view'), ('auditor_read_only', 'production.view'), ('auditor_read_only', 'stock_counts.view'), ('auditor_read_only', 'reports.view'), ('auditor_read_only', 'reports.export'), ('auditor_read_only', 'audit.view'), ('auditor_read_only', 'notifications.view')
on conflict do nothing;

-- Shared updated-at triggers.
do $$
declare table_name text;
begin
  foreach table_name in array array['manufacturers','suppliers','retailers','retailer_branches','retailer_commercial_agreements','inventory_locations','products','product_skus','profiles','product_batches','stock_movements','free_product_requests','approval_records','stock_counts','stock_count_lines','production_orders','returns_damages_wastage'] loop
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

create trigger profiles_scope_guard before update on public.profiles for each row execute function public.protect_profile_scope();
create trigger stock_movement_guard before insert or update on public.stock_movements for each row execute function public.validate_stock_movement();
create trigger stock_movement_immutable before update or delete on public.stock_movements for each row execute function public.protect_posted_movement();
create trigger approval_immutable before update or delete on public.approval_records for each row execute function public.protect_final_approval();

do $$
declare table_name text;
begin
  foreach table_name in array array['manufacturers','suppliers','retailers','retailer_branches','retailer_commercial_agreements','inventory_locations','products','product_skus','profiles','user_roles','product_batches','stock_movements','free_product_requests','approval_records','stock_counts','stock_count_lines','production_orders','returns_damages_wastage','attachments'] loop
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row_change()', table_name, table_name);
  end loop;
end $$;

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.manufacturers enable row level security;
alter table public.suppliers enable row level security;
alter table public.retailers enable row level security;
alter table public.retailer_branches enable row level security;
alter table public.retailer_commercial_agreements enable row level security;
alter table public.inventory_locations enable row level security;
alter table public.products enable row level security;
alter table public.product_skus enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.product_batches enable row level security;
alter table public.stock_movements enable row level security;
alter table public.free_product_requests enable row level security;
alter table public.approval_records enable row level security;
alter table public.stock_counts enable row level security;
alter table public.stock_count_lines enable row level security;
alter table public.production_orders enable row level security;
alter table public.returns_damages_wastage enable row level security;
alter table public.attachments enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

create policy roles_read on public.roles for select to authenticated using (public.has_permission('settings.view'));
create policy permissions_read on public.permissions for select to authenticated using (public.has_permission('settings.view'));
create policy role_permissions_read on public.role_permissions for select to authenticated using (public.has_permission('settings.view'));

create policy profiles_read on public.profiles for select to authenticated using (user_id = auth.uid() or public.has_permission('users.manage') or public.has_permission('audit.view'));
create policy profiles_insert_self on public.profiles for insert to authenticated with check (user_id = auth.uid() or public.has_permission('users.manage'));
create policy profiles_update_self on public.profiles for update to authenticated using (user_id = auth.uid() or public.has_permission('users.manage')) with check (user_id = auth.uid() or public.has_permission('users.manage'));
create policy user_roles_read on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_permission('users.manage') or public.has_permission('audit.view'));
create policy user_roles_admin_insert on public.user_roles for insert to authenticated with check (public.has_permission('users.manage'));
create policy user_roles_admin_delete on public.user_roles for delete to authenticated using (public.has_permission('users.manage'));

create policy manufacturers_read on public.manufacturers for select to authenticated using (public.has_permission('products.view'));
create policy manufacturers_write on public.manufacturers for all to authenticated using (public.has_permission('products.manage')) with check (public.has_permission('products.manage'));
create policy suppliers_read on public.suppliers for select to authenticated using (public.has_permission('products.view') or public.has_permission('financial.view'));
create policy suppliers_write on public.suppliers for all to authenticated using (public.has_permission('products.manage')) with check (public.has_permission('products.manage'));
create policy products_read on public.products for select to authenticated using (public.has_permission('products.view'));
create policy products_write on public.products for all to authenticated using (public.has_permission('products.manage')) with check (public.has_permission('products.manage'));
create policy skus_read on public.product_skus for select to authenticated using (public.has_permission('products.view'));
create policy skus_write on public.product_skus for all to authenticated using (public.has_permission('products.manage')) with check (public.has_permission('products.manage'));
create policy batches_read on public.product_batches for select to authenticated using (public.has_permission('batches.view') or public.has_permission('inventory.view'));
create policy batches_write on public.product_batches for all to authenticated using (public.has_permission('products.manage') or public.has_permission('inventory.create')) with check (public.has_permission('products.manage') or public.has_permission('inventory.create'));

create policy retailers_read on public.retailers for select to authenticated using (public.has_permission('retailers.view') and (id = public.current_user_retailer_id() or public.has_permission('retailers.manage') or public.has_permission('audit.view')));
create policy retailers_write on public.retailers for all to authenticated using (public.has_permission('retailers.manage')) with check (public.has_permission('retailers.manage'));
create policy branches_read on public.retailer_branches for select to authenticated using (public.has_permission('retailers.view') and (retailer_id = public.current_user_retailer_id() or public.has_permission('retailers.manage') or public.has_permission('audit.view')));
create policy branches_write on public.retailer_branches for all to authenticated using (public.has_permission('retailers.manage')) with check (public.has_permission('retailers.manage'));
create policy agreements_read on public.retailer_commercial_agreements for select to authenticated using ((public.has_permission('agreements.view') or public.has_permission('financial.view')) and (retailer_id = public.current_user_retailer_id() or public.has_permission('agreements.manage') or public.has_permission('audit.view')));
create policy agreements_write on public.retailer_commercial_agreements for all to authenticated using (public.has_permission('agreements.manage') or public.has_permission('financial.manage')) with check (public.has_permission('agreements.manage') or public.has_permission('financial.manage'));

create policy locations_read on public.inventory_locations for select to authenticated using (public.has_permission('inventory.view') and (retailer_id = public.current_user_retailer_id() or public.has_role('warehouse_staff') or public.has_permission('inventory.post') or public.has_permission('audit.view')));
create policy locations_write on public.inventory_locations for all to authenticated using (public.has_permission('inventory.post')) with check (public.has_permission('inventory.post'));
create policy movements_read on public.stock_movements for select to authenticated using (public.has_permission('inventory.view') and (source_location_id in (select id from public.inventory_locations where retailer_id = public.current_user_retailer_id()) or destination_location_id in (select id from public.inventory_locations where retailer_id = public.current_user_retailer_id()) or public.has_role('warehouse_staff') or public.has_permission('inventory.post') or public.has_permission('audit.view')));
create policy movements_insert on public.stock_movements for insert to authenticated with check (public.has_permission('inventory.create') and (created_by = auth.uid() or public.has_permission('inventory.post')));
create policy movements_update_draft on public.stock_movements for update to authenticated using (status = 'draft' and public.has_permission('inventory.create')) with check (status = 'draft' and public.has_permission('inventory.create'));
create policy movements_delete_draft on public.stock_movements for delete to authenticated using (status = 'draft' and public.has_permission('inventory.create'));
create policy free_requests_read on public.free_product_requests for select to authenticated using (public.has_permission('free_product_requests.view') and (retailer_id = public.current_user_retailer_id() or public.has_permission('free_product_requests.approve') or public.has_permission('audit.view')));
create policy free_requests_insert on public.free_product_requests for insert to authenticated with check (public.has_permission('free_product_requests.create') and requested_by = auth.uid() and retailer_id = public.current_user_retailer_id());
create policy free_requests_update on public.free_product_requests for update to authenticated using (public.has_permission('free_product_requests.approve')) with check (public.has_permission('free_product_requests.approve'));
create policy approvals_read on public.approval_records for select to authenticated using (requested_by = auth.uid() or public.has_permission('free_product_requests.approve') or public.has_permission('audit.view'));
create policy approvals_insert on public.approval_records for insert to authenticated with check (requested_by = auth.uid() or public.has_permission('free_product_requests.approve'));
create policy approvals_update_pending on public.approval_records for update to authenticated using (status = 'pending' and public.has_permission('free_product_requests.approve')) with check (status in ('approved', 'rejected') and decided_by = auth.uid());

create policy stock_counts_read on public.stock_counts for select to authenticated using (public.has_permission('stock_counts.view') and (location_id in (select id from public.inventory_locations where retailer_id = public.current_user_retailer_id()) or public.has_role('warehouse_staff') or public.has_permission('stock_counts.post') or public.has_permission('audit.view')));
create policy stock_counts_insert on public.stock_counts for insert to authenticated with check (public.has_permission('stock_counts.create'));
create policy stock_counts_update on public.stock_counts for update to authenticated using (public.has_permission('stock_counts.create') or public.has_permission('stock_counts.post')) with check (public.has_permission('stock_counts.create') or public.has_permission('stock_counts.post'));
create policy count_lines_read on public.stock_count_lines for select to authenticated using (exists (select 1 from public.stock_counts sc where sc.id = stock_count_id));
create policy count_lines_write on public.stock_count_lines for all to authenticated using (public.has_permission('stock_counts.create') or public.has_permission('stock_counts.post')) with check (public.has_permission('stock_counts.create') or public.has_permission('stock_counts.post'));

create policy production_read on public.production_orders for select to authenticated using (public.has_permission('production.view') or public.has_permission('audit.view'));
create policy production_write on public.production_orders for all to authenticated using (public.has_permission('production.manage')) with check (public.has_permission('production.manage'));
create policy returns_read on public.returns_damages_wastage for select to authenticated using (public.has_permission('inventory.view') and (retailer_id = public.current_user_retailer_id() or public.has_permission('inventory.post') or public.has_permission('audit.view')));
create policy returns_write on public.returns_damages_wastage for insert to authenticated with check (public.has_permission('inventory.create'));
create policy attachments_read on public.attachments for select to authenticated using (public.has_permission('attachments.view') and (uploaded_by = auth.uid() or public.has_permission('audit.view') or public.has_permission('inventory.view')));
create policy attachments_insert on public.attachments for insert to authenticated with check (public.has_permission('attachments.upload') and uploaded_by = auth.uid());
create policy notifications_read on public.notifications for select to authenticated using (recipient_user_id = auth.uid() or public.has_permission('notifications.view') and public.is_admin());
create policy notifications_update_self on public.notifications for update to authenticated using (recipient_user_id = auth.uid()) with check (recipient_user_id = auth.uid());
create policy audit_logs_read on public.audit_logs for select to authenticated using (public.has_permission('audit.view') or public.is_admin());

revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;
revoke all on public.stock_balances from anon;
grant select on public.stock_balances to authenticated;

comment on table public.stock_movements is 'Immutable source-of-truth ledger. Corrections are new reversal or adjustment rows.';
comment on view public.stock_balances is 'Derived balance view. FEFO allocation should order product_batches by expires_on, then created_at.';
comment on function public.set_user_role(uuid, text) is 'Admin-only role replacement operation. Writes an audit log entry.';

-- GoodLivin Stage 3: product batch management and expiry tracking
--
-- Extends the Stage 1 batch/ledger structures in place. Stock receiving,
-- movement posting, allocation, transfers and retailer stock calculations
-- remain outside this migration and Stage 3.

begin;

alter table public.product_batches
  add column if not exists manufacturer_id uuid references public.manufacturers(id),
  add column if not exists received_on date,
  add column if not exists initial_quantity integer not null default 0,
  add column if not exists unit_cost numeric(14, 2) not null default 0,
  add column if not exists quality_status text not null default 'pending',
  add column if not exists attachment_id uuid references public.attachments(id),
  add column if not exists notes text,
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists correction_reason text;

update public.product_batches b
set manufacturer_id = p.manufacturer_id
from public.products p
where p.id = b.product_id
  and b.manufacturer_id is null;

update public.product_batches
set unit_cost = purchase_cost
where purchase_cost is not null
  and unit_cost = 0;

update public.product_batches b
set initial_quantity = coalesce((
  select sum(sm.quantity)::integer
  from public.stock_movements sm
  where sm.batch_id = b.id
    and sm.status = 'posted'
    and sm.source_location_id is null
    and sm.destination_location_id is not null
), 0)
where b.initial_quantity = 0;

do $$
begin
  update public.product_batches b
  set sku_id = only_sku.id
  from (
    select p.id as product_id, (array_agg(s.id order by s.id))[1] as id
    from public.products p
    join public.product_skus s on s.product_id = p.id
    group by p.id
    having count(*) = 1
  ) only_sku
  where b.product_id = only_sku.product_id
    and b.sku_id is null;

  if exists (select 1 from public.product_batches where sku_id is null) then
    raise exception 'Stage 3 requires every product batch to reference a sellable SKU; resolve ambiguous or missing SKU links before applying this migration';
  end if;
end $$;

alter table public.product_batches
  alter column sku_id set not null;

alter table public.product_batches
  drop constraint if exists product_batches_product_id_batch_number_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.product_batches'::regclass
      and conname = 'product_batches_sku_id_batch_number_key'
  ) then
    alter table public.product_batches
      add constraint product_batches_sku_id_batch_number_key unique (sku_id, batch_number);
  end if;
end $$;

alter table public.product_batches drop constraint if exists product_batches_check;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'product_batches_dates_check') then
    alter table public.product_batches add constraint product_batches_dates_check
      check (manufactured_on is null or expires_on > manufactured_on);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'product_batches_received_check') then
    alter table public.product_batches add constraint product_batches_received_check
      check (received_on is null or manufactured_on is null or received_on >= manufactured_on);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'product_batches_initial_quantity_check') then
    alter table public.product_batches add constraint product_batches_initial_quantity_check
      check (initial_quantity >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'product_batches_unit_cost_check') then
    alter table public.product_batches add constraint product_batches_unit_cost_check
      check (unit_cost >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'product_batches_quality_status_check') then
    alter table public.product_batches add constraint product_batches_quality_status_check
      check (quality_status in ('pending', 'approved', 'quarantined', 'rejected', 'recalled'));
  end if;
end $$;

create index if not exists product_batches_sku_expiry_idx
  on public.product_batches (sku_id, expires_on, created_at)
  where status = 'active';
create index if not exists product_batches_quality_expiry_idx
  on public.product_batches (quality_status, expires_on, status);
create index if not exists product_batches_manufacturer_idx
  on public.product_batches (manufacturer_id);

create table if not exists public.expiry_notification_settings (
  id uuid primary key default gen_random_uuid(),
  threshold_days integer not null unique check (threshold_days >= 0),
  label text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.expiry_notification_settings (threshold_days, label)
values (90, 'Expiring within 90 days'), (60, 'Expiring within 60 days'), (30, 'Expiring within 30 days')
on conflict (threshold_days) do update set label = excluded.label, enabled = true;

create index if not exists expiry_notification_settings_enabled_idx
  on public.expiry_notification_settings (threshold_days)
  where enabled;

create or replace function public.validate_product_batch_relationship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sku_product_id uuid;
  product_status public.record_status;
  sku_status public.record_status;
  manufacturer_status public.record_status;
  supplier_status public.record_status;
begin
  if new.sku_id is null then
    raise exception 'Every product batch must reference a sellable SKU';
  end if;

  select product_id, status into sku_product_id, sku_status
  from public.product_skus where id = new.sku_id;
  if sku_product_id is null or sku_product_id <> new.product_id then
    raise exception 'Batch SKU must belong to the selected product';
  end if;

  if tg_op = 'INSERT' or new.product_id is distinct from old.product_id or new.sku_id is distinct from old.sku_id then
    select status into product_status from public.products where id = new.product_id;
    if product_status is distinct from 'active'::public.record_status then
      raise exception 'Archived products cannot be selected for new batches';
    end if;
    if sku_status is distinct from 'active'::public.record_status then
      raise exception 'Archived SKUs cannot be selected for new batches';
    end if;
  end if;

  if new.manufacturer_id is not null and (tg_op = 'INSERT' or new.manufacturer_id is distinct from old.manufacturer_id) then
    select status into manufacturer_status from public.manufacturers where id = new.manufacturer_id;
    if manufacturer_status is distinct from 'active'::public.record_status then
      raise exception 'Archived manufacturers cannot be selected for new batches';
    end if;
  end if;

  if new.supplier_id is not null and (tg_op = 'INSERT' or new.supplier_id is distinct from old.supplier_id) then
    select status into supplier_status from public.suppliers where id = new.supplier_id;
    if supplier_status is distinct from 'active'::public.record_status then
      raise exception 'Archived suppliers cannot be selected for new batches';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists product_batch_relationship_guard on public.product_batches;
create trigger product_batch_relationship_guard
before insert or update on public.product_batches
for each row execute function public.validate_product_batch_relationship();

create or replace function public.protect_product_batch_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  has_movements boolean;
  has_reason boolean := length(btrim(coalesce(new.correction_reason, ''))) > 0;
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.stock_movements where batch_id = old.id) then
      raise exception 'Batches connected to stock transactions cannot be hard-deleted';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if public.has_role('warehouse_staff') and not public.has_permission('batches.manage') then
      if coalesce(new.unit_cost, 0) <> 0
        or coalesce(new.purchase_cost, 0) <> 0
        or new.quality_status is distinct from 'pending' then
        raise exception 'Warehouse Staff may only create pending batches without cost data';
      end if;
    end if;
    return new;
  end if;

  if public.has_role('warehouse_staff') and not public.has_permission('batches.manage') then
    if new.unit_cost is distinct from old.unit_cost
      or new.purchase_cost is distinct from old.purchase_cost
      or new.quality_status is distinct from old.quality_status
      or new.product_id is distinct from old.product_id
      or new.sku_id is distinct from old.sku_id
      or new.batch_number is distinct from old.batch_number
      or new.manufactured_on is distinct from old.manufactured_on
      or new.expires_on is distinct from old.expires_on
      or new.manufacturer_id is distinct from old.manufacturer_id
      or new.supplier_id is distinct from old.supplier_id
      or new.currency_code is distinct from old.currency_code
      or new.status is distinct from old.status
      or new.archived_at is distinct from old.archived_at
      or new.created_at is distinct from old.created_at
      or new.created_by is distinct from old.created_by then
      raise exception 'Warehouse Staff may only change permitted operational batch fields';
    end if;
  end if;

  select exists (select 1 from public.stock_movements where batch_id = old.id) into has_movements;
  if has_movements and (
    new.product_id is distinct from old.product_id
    or new.sku_id is distinct from old.sku_id
    or new.batch_number is distinct from old.batch_number
    or new.manufacturer_id is distinct from old.manufacturer_id
    or new.supplier_id is distinct from old.supplier_id
    or new.manufactured_on is distinct from old.manufactured_on
    or new.expires_on is distinct from old.expires_on
    or new.received_on is distinct from old.received_on
    or new.initial_quantity is distinct from old.initial_quantity
    or new.unit_cost is distinct from old.unit_cost
    or new.purchase_cost is distinct from old.purchase_cost
    or new.quality_status is distinct from old.quality_status
  ) and not has_reason then
    raise exception 'A correction reason is required for traceability changes after stock movements exist';
  end if;

  return new;
end;
$$;

drop trigger if exists product_batch_change_guard on public.product_batches;
create trigger product_batch_change_guard
before insert or update or delete on public.product_batches
for each row execute function public.protect_product_batch_changes();

create or replace function public.set_product_batch_actor()
returns trigger
language plpgsql
security invoker
as $$
begin
  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by = auth.uid();
  end if;
  if auth.uid() is not null then
    new.updated_by = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists product_batch_actor on public.product_batches;
create trigger product_batch_actor
before insert or update on public.product_batches
for each row execute function public.set_product_batch_actor();

create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  changed_record_id uuid;
  audit_reason text;
begin
  if tg_op = 'DELETE' then
    changed_record_id := old.id;
    audit_reason := case when tg_table_name = 'product_batches' then to_jsonb(old)->>'correction_reason' else null end;
    perform public.write_audit_log(tg_table_name, changed_record_id, lower(tg_op), to_jsonb(old), null, audit_reason);
    return old;
  end if;

  changed_record_id := new.id;
  audit_reason := case when tg_table_name = 'product_batches' then to_jsonb(new)->>'correction_reason' else null end;
  perform public.write_audit_log(tg_table_name, changed_record_id, lower(tg_op), case when tg_op = 'UPDATE' then to_jsonb(old) else null end, to_jsonb(new), audit_reason);
  return new;
end;
$$;

insert into public.permissions (code, label, description) values
  ('batches.manage', 'Manage batches', 'Create, edit, approve, recall, reject, and archive product batches.'),
  ('batches.operations', 'Enter batch operations', 'Enter permitted warehouse batch information.')
on conflict (code) do update set label = excluded.label, description = excluded.description;

insert into public.role_permissions (role_code, permission_code) values
  ('director_admin', 'batches.manage'),
  ('inventory_manager', 'batches.manage'),
  ('warehouse_staff', 'batches.operations'),
  ('finance_team', 'batches.view')
on conflict do nothing;

alter table public.product_batches enable row level security;
alter table public.expiry_notification_settings enable row level security;

grant select, insert, update on public.product_batches to authenticated;
revoke delete on public.product_batches from authenticated;
grant select on public.expiry_notification_settings to authenticated;
grant insert, update on public.expiry_notification_settings to authenticated;
revoke delete on public.expiry_notification_settings from authenticated;
grant select, update on public.notifications to authenticated;

drop policy if exists batches_read on public.product_batches;
drop policy if exists batches_write on public.product_batches;
drop policy if exists batches_insert on public.product_batches;
drop policy if exists batches_update_manage on public.product_batches;
drop policy if exists batches_update_operations on public.product_batches;
drop policy if exists batches_delete on public.product_batches;

create policy batches_read on public.product_batches
for select to authenticated using (
  public.has_permission('batches.view')
  or public.has_permission('financial.view')
  or (public.has_permission('retailers.view') and quality_status = 'approved')
);

create policy batches_insert on public.product_batches
for insert to authenticated
with check (public.has_permission('batches.manage') or public.has_permission('batches.operations'));

create policy batches_update_manage on public.product_batches
for update to authenticated
using (public.has_permission('batches.manage'))
with check (public.has_permission('batches.manage'));

create policy batches_update_operations on public.product_batches
for update to authenticated
using (public.has_permission('batches.operations'))
with check (public.has_permission('batches.operations'));

drop policy if exists expiry_settings_read on public.expiry_notification_settings;
drop policy if exists expiry_settings_manage on public.expiry_notification_settings;
drop policy if exists expiry_settings_insert on public.expiry_notification_settings;
drop policy if exists expiry_settings_update on public.expiry_notification_settings;
create policy expiry_settings_read on public.expiry_notification_settings
for select to authenticated using (
  public.has_permission('notifications.view')
  or public.has_permission('batches.view')
  or public.has_permission('financial.view')
);
create policy expiry_settings_insert on public.expiry_notification_settings
for insert to authenticated
with check (public.has_permission('batches.manage'));
create policy expiry_settings_update on public.expiry_notification_settings
for update to authenticated
using (public.has_permission('batches.manage'))
with check (public.has_permission('batches.manage'));

comment on table public.product_batches is 'Stage 3 batch master. SKU-linked, expiry-tracked, archive-only through the application.';
comment on table public.expiry_notification_settings is 'Configurable Stage 3 expiry notification thresholds. No external notification integrations are used.';

commit;

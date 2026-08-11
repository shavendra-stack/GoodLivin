-- GoodLivin Stage 2 master-data management
--
-- This migration extends the Stage 1 master tables in place. It does not
-- remove data, introduce hard-delete policies, or change the audit model.

begin;

-- Product and SKU commercial/master-data fields.
alter table public.products
  add column if not exists brand text,
  add column if not exists minimum_stock_level integer not null default 0,
  add column if not exists reorder_level integer not null default 0,
  add column if not exists storage_instructions text,
  add column if not exists image_url text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_minimum_stock_level_check') then
    alter table public.products add constraint products_minimum_stock_level_check check (minimum_stock_level >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_reorder_level_check') then
    alter table public.products add constraint products_reorder_level_check check (reorder_level >= 0);
  end if;
end $$;

alter table public.product_skus
  add column if not exists unit_description text not null default 'unit',
  add column if not exists units_per_carton integer not null default 1,
  add column if not exists cost_per_unit numeric(14, 2) not null default 0,
  add column if not exists retail_price numeric(14, 2),
  add column if not exists wholesale_price numeric(14, 2) not null default 0;

update public.product_skus
set retail_price = unit_price
where retail_price is null;

alter table public.product_skus
  alter column retail_price set default 0,
  alter column retail_price set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'product_skus_units_per_carton_check') then
    alter table public.product_skus add constraint product_skus_units_per_carton_check check (units_per_carton > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'product_skus_cost_per_unit_check') then
    alter table public.product_skus add constraint product_skus_cost_per_unit_check check (cost_per_unit >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'product_skus_retail_price_check') then
    alter table public.product_skus add constraint product_skus_retail_price_check check (retail_price >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'product_skus_wholesale_price_check') then
    alter table public.product_skus add constraint product_skus_wholesale_price_check check (wholesale_price >= 0);
  end if;
end $$;

-- Preserve the original location values while adding the Stage 2 vocabulary.
-- Stage 1 created this check without an explicit name, so PostgreSQL named it
-- inventory_locations_check. Drop both possible names before adding the
-- expanded vocabulary; the relationship trigger below is now authoritative
-- for retailer/branch linkage.
alter table public.inventory_locations drop constraint if exists inventory_locations_check;
alter table public.inventory_locations drop constraint if exists inventory_locations_location_type_check;
alter table public.inventory_locations add constraint inventory_locations_location_type_check check (
  location_type in (
    'warehouse', 'main_warehouse', 'office_stock', 'online_order_stock',
    'event_stock', 'retailer_branch', 'sample_influencer_stock',
    'damaged_stock', 'quarantine', 'quarantine_stock', 'expired_stock',
    'transit', 'production'
  )
);

create or replace function public.validate_inventory_location_relationship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  branch_retailer_id uuid;
begin
  if new.location_type = 'retailer_branch' then
    if new.retailer_id is null or new.branch_id is null then
      raise exception 'Retailer-branch locations require both retailer and branch relationships';
    end if;

    select retailer_id into branch_retailer_id
    from public.retailer_branches
    where id = new.branch_id;

    if branch_retailer_id is null or branch_retailer_id <> new.retailer_id then
      raise exception 'Retailer-branch location must reference a branch belonging to the selected retailer';
    end if;
  elsif new.retailer_id is not null or new.branch_id is not null then
    raise exception 'Only retailer-branch locations may carry retailer or branch relationships';
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_location_relationship_guard on public.inventory_locations;
create trigger inventory_location_relationship_guard
before insert or update on public.inventory_locations
for each row execute function public.validate_inventory_location_relationship();

-- Agreement terms needed by internal GoodLivin commercial management.
alter table public.retailer_commercial_agreements
  add column if not exists arrangement_type text not null default 'wholesale',
  add column if not exists retailer_margin_percent numeric(7, 2) not null default 0,
  add column if not exists credit_limit numeric(14, 2) not null default 0,
  add column if not exists minimum_shelf_life_days integer not null default 0;

alter table public.retailers
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists city text,
  add column if not exists district text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'retailer_agreements_arrangement_type_check') then
    alter table public.retailer_commercial_agreements add constraint retailer_agreements_arrangement_type_check check (arrangement_type in ('wholesale', 'consignment'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'retailer_agreements_margin_check') then
    alter table public.retailer_commercial_agreements add constraint retailer_agreements_margin_check check (retailer_margin_percent between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'retailer_agreements_credit_limit_check') then
    alter table public.retailer_commercial_agreements add constraint retailer_agreements_credit_limit_check check (credit_limit >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'retailer_agreements_shelf_life_check') then
    alter table public.retailer_commercial_agreements add constraint retailer_agreements_shelf_life_check check (minimum_shelf_life_days >= 0);
  end if;
end $$;

-- Stage 1 audit triggers already cover all eight management tables. These
-- grants let authenticated users reach those RLS policies; no anonymous
-- access or delete privilege is introduced.
grant select, insert, update on public.manufacturers, public.suppliers,
  public.products, public.product_skus, public.inventory_locations,
  public.retailers, public.retailer_branches,
  public.retailer_commercial_agreements to authenticated;
revoke delete on public.manufacturers, public.suppliers, public.products,
  public.product_skus, public.inventory_locations, public.retailers,
  public.retailer_branches, public.retailer_commercial_agreements from authenticated;

-- Replace Stage 1 FOR ALL policies with insert/update-only policies so master
-- records can be archived but not hard-deleted through the application role.
drop policy if exists manufacturers_write on public.manufacturers;
drop policy if exists manufacturers_insert on public.manufacturers;
drop policy if exists manufacturers_update on public.manufacturers;
create policy manufacturers_insert on public.manufacturers for insert to authenticated with check (public.has_permission('products.manage'));
create policy manufacturers_update on public.manufacturers for update to authenticated using (public.has_permission('products.manage')) with check (public.has_permission('products.manage'));

drop policy if exists suppliers_write on public.suppliers;
drop policy if exists suppliers_insert on public.suppliers;
drop policy if exists suppliers_update on public.suppliers;
create policy suppliers_insert on public.suppliers for insert to authenticated with check (public.has_permission('products.manage'));
create policy suppliers_update on public.suppliers for update to authenticated using (public.has_permission('products.manage')) with check (public.has_permission('products.manage'));

drop policy if exists products_write on public.products;
drop policy if exists products_insert on public.products;
drop policy if exists products_update on public.products;
create policy products_insert on public.products for insert to authenticated with check (public.has_permission('products.manage'));
create policy products_update on public.products for update to authenticated using (public.has_permission('products.manage')) with check (public.has_permission('products.manage'));

drop policy if exists skus_write on public.product_skus;
drop policy if exists skus_insert on public.product_skus;
drop policy if exists skus_update on public.product_skus;
create policy skus_insert on public.product_skus for insert to authenticated with check (public.has_permission('products.manage'));
create policy skus_update on public.product_skus for update to authenticated using (public.has_permission('products.manage')) with check (public.has_permission('products.manage'));

drop policy if exists retailers_write on public.retailers;
drop policy if exists retailers_insert on public.retailers;
drop policy if exists retailers_update on public.retailers;
create policy retailers_insert on public.retailers for insert to authenticated with check (public.has_permission('retailers.manage'));
create policy retailers_update on public.retailers for update to authenticated using (public.has_permission('retailers.manage')) with check (public.has_permission('retailers.manage'));

drop policy if exists branches_write on public.retailer_branches;
drop policy if exists branches_insert on public.retailer_branches;
drop policy if exists branches_update on public.retailer_branches;
create policy branches_insert on public.retailer_branches for insert to authenticated with check (public.has_permission('retailers.manage'));
create policy branches_update on public.retailer_branches for update to authenticated using (public.has_permission('retailers.manage')) with check (public.has_permission('retailers.manage'));

drop policy if exists agreements_write on public.retailer_commercial_agreements;
drop policy if exists agreements_insert on public.retailer_commercial_agreements;
drop policy if exists agreements_update on public.retailer_commercial_agreements;
create policy agreements_insert on public.retailer_commercial_agreements for insert to authenticated with check (public.has_permission('agreements.manage') or public.has_permission('financial.manage'));
create policy agreements_update on public.retailer_commercial_agreements for update to authenticated using (public.has_permission('agreements.manage') or public.has_permission('financial.manage')) with check (public.has_permission('agreements.manage') or public.has_permission('financial.manage'));

drop policy if exists locations_write on public.inventory_locations;
drop policy if exists locations_insert on public.inventory_locations;
drop policy if exists locations_update on public.inventory_locations;
create policy locations_insert on public.inventory_locations for insert to authenticated with check (public.has_permission('inventory.post'));
create policy locations_update on public.inventory_locations for update to authenticated using (public.has_permission('inventory.post')) with check (public.has_permission('inventory.post'));

-- Internal agreement and location managers need reference data, while
-- retailer users remain scoped to their own retailer.
drop policy if exists retailers_read on public.retailers;
create policy retailers_read on public.retailers for select to authenticated using (
  (public.has_permission('retailers.view') or public.has_permission('agreements.view') or public.has_permission('financial.view') or public.has_permission('inventory.post'))
  and (id = public.current_user_retailer_id()
    or public.has_permission('retailers.manage')
    or public.has_permission('agreements.view')
    or public.has_permission('financial.view')
    or public.has_permission('inventory.post')
    or public.has_permission('audit.view'))
);

drop policy if exists branches_read on public.retailer_branches;
create policy branches_read on public.retailer_branches for select to authenticated using (
  (public.has_permission('retailers.view') or public.has_permission('agreements.view') or public.has_permission('financial.view') or public.has_permission('inventory.post'))
  and (retailer_id = public.current_user_retailer_id()
    or public.has_permission('retailers.manage')
    or public.has_permission('agreements.view')
    or public.has_permission('financial.view')
    or public.has_permission('inventory.post')
    or public.has_permission('audit.view'))
);

comment on table public.products is 'Stage 2 product master. Archive records instead of deleting them.';
comment on table public.product_skus is 'Stage 2 sellable SKU master. Archive records instead of deleting them.';
comment on table public.inventory_locations is 'Stage 2 location master. Retailer-branch rows must reference matching retailer and branch records.';
comment on table public.retailer_commercial_agreements is 'Stage 2 internal retailer commercial agreements. Retailer logins are not created here.';

commit;

-- GoodLivin Stage 6 completion: procurement documents and supplier/SKU catalog
-- management helpers.
--
-- This migration is intentionally additive and safe to rerun. It does not
-- weaken RLS, remove audit triggers, or make ordered stock available before a
-- controlled receipt is posted.

begin;

-- Procurement users need table-level access before the existing RLS policies
-- can evaluate attachment reads/uploads. RLS remains the final gate.
grant select, insert on public.attachments to authenticated;

insert into public.role_permissions (role_code, permission_code) values
  ('inventory_manager', 'attachments.view'),
  ('inventory_manager', 'attachments.upload'),
  ('warehouse_staff', 'attachments.view'),
  ('warehouse_staff', 'attachments.upload'),
  ('finance_team', 'attachments.view'),
  ('finance_team', 'attachments.upload'),
  ('sales_manager', 'attachments.view'),
  ('auditor_read_only', 'attachments.view')
on conflict do nothing;

drop policy if exists attachments_read on public.attachments;
create policy attachments_read on public.attachments
for select to authenticated
using (
  public.has_permission('attachments.view')
  and (
    uploaded_by = auth.uid()
    or public.has_permission('audit.view')
    or public.has_permission('inventory.view')
    or exists (
      select 1
      from public.purchase_order_attachments poa
      where poa.attachment_id = attachments.id
        and public.has_permission('purchasing.view')
    )
    or exists (
      select 1
      from public.purchase_order_payments pop
      where pop.attachment_id = attachments.id
        and (
          public.has_permission('purchasing.payments')
          or public.has_permission('financial.view')
          or public.has_permission('audit.view')
        )
    )
    or exists (
      select 1
      from public.purchase_order_receipts por
      where por.attachment_id = attachments.id
        and (
          public.has_permission('purchasing.view')
          or public.has_permission('purchasing.receive')
          or public.has_permission('inventory.view')
          or public.has_permission('audit.view')
        )
    )
  )
);

drop policy if exists attachments_insert on public.attachments;
create policy attachments_insert on public.attachments
for insert to authenticated
with check (
  public.has_permission('attachments.upload')
  and uploaded_by = auth.uid()
);

create or replace function public.save_supplier_catalog_item(
  p_catalog_id uuid,
  p_supplier_id uuid,
  p_manufacturer_id uuid,
  p_product_id uuid,
  p_sku_id uuid,
  p_supplier_sku_code text,
  p_unit_cost numeric,
  p_currency_code text,
  p_minimum_order_quantity integer,
  p_lead_time_days integer,
  p_is_default boolean,
  p_notes text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  catalog_id uuid;
  current_status public.record_status;
  product_status public.record_status;
  sku_product uuid;
  sku_status public.record_status;
begin
  if not (public.has_permission('purchasing.manage') or public.has_permission('products.manage')) then
    raise exception 'You do not have permission to manage supplier catalog data';
  end if;

  if (p_supplier_id is null and p_manufacturer_id is null)
     or (p_supplier_id is not null and p_manufacturer_id is not null) then
    raise exception 'Exactly one supplier or manufacturer is required';
  end if;

  if coalesce(p_unit_cost, 0) < 0
     or coalesce(p_minimum_order_quantity, 0) < 0
     or coalesce(p_lead_time_days, 0) < 0 then
    raise exception 'Supplier catalog cost, MOQ and lead time cannot be negative';
  end if;

  if p_supplier_id is not null
     and not exists (select 1 from public.suppliers where id = p_supplier_id and status = 'active') then
    raise exception 'Archived or missing supplier cannot be used';
  end if;

  if p_manufacturer_id is not null
     and not exists (select 1 from public.manufacturers where id = p_manufacturer_id and status = 'active') then
    raise exception 'Archived or missing manufacturer cannot be used';
  end if;

  select status into product_status from public.products where id = p_product_id;
  select product_id, status into sku_product, sku_status from public.product_skus where id = p_sku_id;

  if product_status is distinct from 'active'::public.record_status
     or sku_product is null
     or sku_product <> p_product_id
     or sku_status is distinct from 'active'::public.record_status then
    raise exception 'Only active related products and SKUs can be supplied';
  end if;

  if p_catalog_id is null then
    insert into public.supplier_product_catalog (
      supplier_id,
      manufacturer_id,
      product_id,
      sku_id,
      supplier_sku_code,
      unit_cost,
      currency_code,
      minimum_order_quantity,
      lead_time_days,
      is_default,
      notes,
      created_by
    )
    values (
      p_supplier_id,
      p_manufacturer_id,
      p_product_id,
      p_sku_id,
      nullif(trim(p_supplier_sku_code), ''),
      coalesce(p_unit_cost, 0),
      upper(coalesce(nullif(trim(p_currency_code), ''), 'LKR')),
      coalesce(p_minimum_order_quantity, 0),
      coalesce(p_lead_time_days, 0),
      coalesce(p_is_default, false),
      nullif(trim(p_notes), ''),
      auth.uid()
    )
    returning id into catalog_id;
  else
    select status into current_status
    from public.supplier_product_catalog
    where id = p_catalog_id
    for update;

    if current_status is null then
      raise exception 'Supplier catalog item not found';
    end if;

    update public.supplier_product_catalog
    set supplier_id = p_supplier_id,
        manufacturer_id = p_manufacturer_id,
        product_id = p_product_id,
        sku_id = p_sku_id,
        supplier_sku_code = nullif(trim(p_supplier_sku_code), ''),
        unit_cost = coalesce(p_unit_cost, 0),
        currency_code = upper(coalesce(nullif(trim(p_currency_code), ''), 'LKR')),
        minimum_order_quantity = coalesce(p_minimum_order_quantity, 0),
        lead_time_days = coalesce(p_lead_time_days, 0),
        is_default = coalesce(p_is_default, false),
        notes = nullif(trim(p_notes), '')
    where id = p_catalog_id
    returning id into catalog_id;
  end if;

  if coalesce(p_is_default, false) then
    update public.supplier_product_catalog
    set is_default = false
    where sku_id = p_sku_id
      and id <> catalog_id
      and status = 'active';
  end if;

  return catalog_id;
end;
$$;

create or replace function public.archive_supplier_catalog_item(p_catalog_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_permission('purchasing.manage') or public.has_permission('products.manage')) then
    raise exception 'You do not have permission to manage supplier catalog data';
  end if;

  update public.supplier_product_catalog
  set status = 'archived',
      archived_at = coalesce(archived_at, now()),
      is_default = false
  where id = p_catalog_id;
end;
$$;

grant execute on function public.save_supplier_catalog_item(uuid, uuid, uuid, uuid, uuid, text, numeric, text, integer, integer, boolean, text) to authenticated;
grant execute on function public.archive_supplier_catalog_item(uuid) to authenticated;

-- Storage is only present in hosted Supabase. Keep local/test database runs safe
-- by creating the bucket and object policies dynamically when the schema exists.
do $$
begin
  if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
    execute $sql$
      insert into storage.buckets (id, name, public, file_size_limit)
      values ('goodlivin-attachments', 'goodlivin-attachments', false, 10485760)
      on conflict (id) do update
      set public = false,
          file_size_limit = 10485760
    $sql$;

    execute 'drop policy if exists goodlivin_attachments_objects_read on storage.objects';
    execute 'drop policy if exists goodlivin_attachments_objects_insert on storage.objects';

    execute $sql$
      create policy goodlivin_attachments_objects_read on storage.objects
      for select to authenticated
      using (
        bucket_id = 'goodlivin-attachments'
        and public.has_permission('attachments.view')
        and exists (
          select 1
          from public.attachments a
          where a.storage_bucket = 'goodlivin-attachments'
            and a.storage_path = storage.objects.name
            and (
              a.uploaded_by = auth.uid()
              or public.has_permission('audit.view')
              or public.has_permission('inventory.view')
              or exists (
                select 1
                from public.purchase_order_attachments poa
                where poa.attachment_id = a.id
                  and public.has_permission('purchasing.view')
              )
              or exists (
                select 1
                from public.purchase_order_payments pop
                where pop.attachment_id = a.id
                  and (
                    public.has_permission('purchasing.payments')
                    or public.has_permission('financial.view')
                    or public.has_permission('audit.view')
                  )
              )
              or exists (
                select 1
                from public.purchase_order_receipts por
                where por.attachment_id = a.id
                  and (
                    public.has_permission('purchasing.view')
                    or public.has_permission('purchasing.receive')
                    or public.has_permission('inventory.view')
                    or public.has_permission('audit.view')
                  )
              )
            )
        )
      )
    $sql$;

    execute $sql$
      create policy goodlivin_attachments_objects_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'goodlivin-attachments'
        and public.has_permission('attachments.upload')
      )
    $sql$;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;

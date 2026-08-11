-- GoodLivin demo seed data. Run after the Stage 1, Stage 2 and Stage 3 migrations.
-- This intentionally seeds master data, posted opening receipts, and one retailer
-- transfer only; create an Auth user in Supabase Dashboard, then assign a profile
-- and role using the documented steps.
-- The transaction and deterministic IDs make this safe to rerun after a partial failure.

begin;

insert into public.manufacturers (id, name, code) values
  ('10000000-0000-0000-0000-000000000001', 'GoodLivin Labs', 'GL-LABS')
on conflict (id) do nothing;

insert into public.suppliers (id, name, code, contact_name, contact_email) values
  ('10000000-0000-0000-0000-000000000002', 'Serendib Wellness Supply', 'SWS', 'Tharindu Jayasuriya', 'supply@example.invalid')
on conflict (id) do nothing;

insert into public.retailers (id, code, name, legal_name, primary_contact_name) values
  ('10000000-0000-0000-0000-000000000101', 'CARGILLS', 'Cargills Food City', 'Cargills Ceylon PLC', 'Kavindi Silva')
on conflict (id) do nothing;

insert into public.retailer_branches (id, retailer_id, code, name, city, district) values
  ('10000000-0000-0000-0000-000000000102', '10000000-0000-0000-0000-000000000101', 'COL-CEN', 'Colombo Central', 'Colombo', 'Colombo')
on conflict (id) do nothing;

-- Retailer-branch locations must carry both relationships at insert time because
-- the Stage 2 migration intentionally enforces that invariant with a trigger.
insert into public.inventory_locations (id, code, name, location_type, retailer_id, branch_id) values
  ('10000000-0000-0000-0000-000000000201', 'WH-KOT', 'Kotte Main Warehouse', 'warehouse', null, null),
  ('10000000-0000-0000-0000-000000000202', 'RT-CARG-COL', 'Cargills Colombo Central', 'retailer_branch', '10000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-000000000102')
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  location_type = excluded.location_type,
  retailer_id = excluded.retailer_id,
  branch_id = excluded.branch_id,
  status = 'active',
  archived_at = null;

insert into public.products (id, product_code, name, category, description, brand, manufacturer_id, supplier_id, minimum_stock_level, reorder_level, storage_instructions) values
  ('10000000-0000-0000-0000-000000000301', 'GL-MAG', 'GoodLivin Magnesium Complex', 'Supplements', 'Daily magnesium support.', 'GoodLivin', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 240, 480, 'Store sealed in a cool, dry place.'),
  ('10000000-0000-0000-0000-000000000302', 'GL-OMEGA', 'GoodLivin Omega 3', 'Supplements', 'Omega 3 softgel supplement.', 'GoodLivin', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 120, 240, 'Store below 25°C away from direct sunlight.')
on conflict (id) do update set
  product_code = excluded.product_code,
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  brand = excluded.brand,
  manufacturer_id = excluded.manufacturer_id,
  supplier_id = excluded.supplier_id,
  minimum_stock_level = excluded.minimum_stock_level,
  reorder_level = excluded.reorder_level,
  storage_instructions = excluded.storage_instructions,
  status = 'active',
  archived_at = null;

insert into public.product_skus (id, product_id, sku_code, sellable_name, barcode, pack_size, unit_description, units_per_carton, cost_per_unit, retail_price, wholesale_price, unit_price) values
  ('10000000-0000-0000-0000-000000000311', '10000000-0000-0000-0000-000000000301', 'GL-MAG-60', 'Magnesium Complex · 60 capsules', '4790000000011', 60, 'capsules', 24, 2700.00, 4850.00, 4100.00, 4850.00),
  ('10000000-0000-0000-0000-000000000312', '10000000-0000-0000-0000-000000000302', 'GL-OMEGA-60', 'Omega 3 · 60 softgels', '4790000000012', 60, 'softgels', 24, 3900.00, 6250.00, 5300.00, 6250.00)
on conflict (id) do update set
  product_id = excluded.product_id,
  sku_code = excluded.sku_code,
  sellable_name = excluded.sellable_name,
  barcode = excluded.barcode,
  pack_size = excluded.pack_size,
  unit_description = excluded.unit_description,
  units_per_carton = excluded.units_per_carton,
  cost_per_unit = excluded.cost_per_unit,
  retail_price = excluded.retail_price,
  wholesale_price = excluded.wholesale_price,
  unit_price = excluded.unit_price,
  status = 'active',
  archived_at = null;

insert into public.retailer_commercial_agreements (id, retailer_id, agreement_number, arrangement_type, effective_from, effective_to, payment_terms_days, credit_limit, retailer_margin_percent, minimum_shelf_life_days, notes) values
  ('10000000-0000-0000-0000-000000000601', '10000000-0000-0000-0000-000000000101', 'AGR-CARG-001', 'wholesale', '2026-08-01', '2027-07-31', 30, 100000.00, 18.00, 120, 'Demo wholesale agreement')
on conflict (id) do update set
  retailer_id = excluded.retailer_id,
  agreement_number = excluded.agreement_number,
  arrangement_type = excluded.arrangement_type,
  effective_from = excluded.effective_from,
  effective_to = excluded.effective_to,
  payment_terms_days = excluded.payment_terms_days,
  credit_limit = excluded.credit_limit,
  retailer_margin_percent = excluded.retailer_margin_percent,
  minimum_shelf_life_days = excluded.minimum_shelf_life_days,
  notes = excluded.notes,
  status = 'active',
  archived_at = null;

insert into public.product_batches (id, product_id, sku_id, batch_number, manufacturer_id, manufactured_on, expires_on, received_on, initial_quantity, supplier_id, purchase_cost, unit_cost, quality_status, notes, correction_reason) values
  ('10000000-0000-0000-0000-000000000401', '10000000-0000-0000-0000-000000000301', '10000000-0000-0000-0000-000000000311', 'GL-MAG-2607', '10000000-0000-0000-0000-000000000001', '2026-07-28', '2027-07-28', '2026-08-01', 1200, '10000000-0000-0000-0000-000000000002', 2700.00, 2700.00, 'approved', 'Demo opening batch', 'Demo seed synchronization'),
  ('10000000-0000-0000-0000-000000000402', '10000000-0000-0000-0000-000000000302', '10000000-0000-0000-0000-000000000312', 'GL-OMEGA-2512', '10000000-0000-0000-0000-000000000001', '2025-12-14', '2026-09-14', '2026-08-01', 480, '10000000-0000-0000-0000-000000000002', 3900.00, 3900.00, 'approved', 'Demo opening batch', 'Demo seed synchronization')
on conflict (id) do update set
  product_id = excluded.product_id,
  sku_id = excluded.sku_id,
  batch_number = excluded.batch_number,
  manufacturer_id = excluded.manufacturer_id,
  manufactured_on = excluded.manufactured_on,
  expires_on = excluded.expires_on,
  received_on = excluded.received_on,
  initial_quantity = excluded.initial_quantity,
  supplier_id = excluded.supplier_id,
  purchase_cost = excluded.purchase_cost,
  unit_cost = excluded.unit_cost,
  quality_status = excluded.quality_status,
  notes = excluded.notes,
  correction_reason = excluded.correction_reason,
  status = 'active',
  archived_at = null;

insert into public.stock_movements (id, movement_type, status, product_id, sku_id, batch_id, source_location_id, destination_location_id, quantity, unit_cost, reason, posted_at) values
  ('10000000-0000-0000-0000-000000000501', 'receipt', 'posted', '10000000-0000-0000-0000-000000000301', '10000000-0000-0000-0000-000000000311', '10000000-0000-0000-0000-000000000401', null, '10000000-0000-0000-0000-000000000201', 1200, 2700.00, 'Demo opening receipt', '2026-08-01T04:00:00Z'),
  ('10000000-0000-0000-0000-000000000502', 'receipt', 'posted', '10000000-0000-0000-0000-000000000302', '10000000-0000-0000-0000-000000000312', '10000000-0000-0000-0000-000000000402', null, '10000000-0000-0000-0000-000000000201', 480, 3900.00, 'Demo opening receipt', '2026-08-01T04:05:00Z'),
  ('10000000-0000-0000-0000-000000000503', 'transfer', 'posted', '10000000-0000-0000-0000-000000000301', '10000000-0000-0000-0000-000000000311', '10000000-0000-0000-0000-000000000401', '10000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000202', 100, 2700.00, 'Demo retailer transfer', '2026-08-02T05:30:00Z')
on conflict (id) do nothing;

commit;

-- Stage 5 visibility correction.
-- Keep raw stock movements protected. The two aggregate views use restricted
-- security-definer helpers so Sales and Finance can see approved planning
-- signals without receiving a broad movement-history grant.

begin;

create or replace function public.stage5_deliveries_for_location(p_product_id uuid, p_sku_id uuid, p_location_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(sm.quantity), 0)::integer
  from public.stock_movements sm
  where sm.product_id = p_product_id
    and sm.sku_id = p_sku_id
    and sm.destination_location_id = p_location_id
    and sm.status = 'posted'
    and sm.movement_type in ('receipt', 'transfer');
$$;

revoke all on function public.stage5_available_quantity(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.stage5_deliveries_for_location(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.stage5_pick_fefo(uuid, uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.stage5_validate_reference(uuid, uuid, uuid, uuid, date, boolean) from public, anon, authenticated;

drop policy if exists locations_read on public.inventory_locations;
create policy locations_read on public.inventory_locations
for select to authenticated using (
  (public.has_permission('inventory.view') or public.has_permission('sales.view') or public.has_permission('returns.view') or public.has_permission('replenishment.view'))
  and (retailer_id = public.current_user_retailer_id()
    or public.has_permission('inventory.view')
    or public.has_permission('sales.view')
    or public.has_permission('replenishment.view')
    or public.has_permission('audit.view'))
);

drop policy if exists retailers_stage5_sell_through_read on public.retailers;
create policy retailers_stage5_sell_through_read on public.retailers
for select to authenticated using (public.has_permission('sell_through.view'));

drop policy if exists branches_stage5_sell_through_read on public.retailer_branches;
create policy branches_stage5_sell_through_read on public.retailer_branches
for select to authenticated using (public.has_permission('sell_through.view'));

create or replace view public.retailer_sell_through with (security_invoker = true) as
with branch_locations as (
  select b.id as branch_id, b.retailer_id, l.id as location_id
  from public.retailer_branches b
  join public.inventory_locations l on l.branch_id = b.id and l.location_type = 'retailer_branch' and l.status = 'active'
), report_totals as (
  select branch_id, sku_id, sum(quantity_sold)::integer as sold, sum(returns_quantity)::integer as returns_sent_back, sum(damaged_quantity)::integer as damaged, sum(expired_quantity)::integer as expired, max(report_date) as last_report_date
  from public.retailer_sales_reports where status = 'posted' group by branch_id, sku_id
), deliveries as (
  select bl.branch_id, s.id as sku_id, sum(public.stage5_deliveries_for_location(p.id, s.id, bl.location_id))::integer as delivered
  from branch_locations bl join public.products p on p.status = 'active' join public.product_skus s on s.product_id = p.id and s.status = 'active'
  group by bl.branch_id, s.id
), current_stock as (
  select bl.branch_id, p.id as product_id, s.id as sku_id, sum(public.stage5_available_quantity(p.id, pb.id, bl.location_id))::integer as current_stock
  from branch_locations bl join public.products p on p.status = 'active' join public.product_skus s on s.product_id = p.id and s.status = 'active' join public.product_batches pb on pb.product_id = p.id and pb.sku_id = s.id and pb.status = 'active'
  group by bl.branch_id, p.id, s.id
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
  select p.id as product_id, s.id as sku_id, sum(public.stage5_available_quantity(p.id, pb.id, l.id))::integer as available_warehouse_stock
  from public.products p join public.product_skus s on s.product_id = p.id and s.status = 'active' join public.product_batches pb on pb.product_id = p.id and pb.sku_id = s.id and pb.status = 'active' and pb.quality_status = 'approved' and pb.expires_on >= current_date join public.inventory_locations l on l.status = 'active' and l.location_type in ('warehouse','main_warehouse','office_stock','online_order_stock') group by p.id, s.id
), branch_stock as (
  select bl.branch_id, p.id as product_id, s.id as sku_id, sum(public.stage5_available_quantity(p.id, pb.id, bl.location_id))::integer as current_branch_stock
  from branch_locations bl join public.products p on p.status = 'active' join public.product_skus s on s.product_id = p.id and s.status = 'active' join public.product_batches pb on pb.product_id = p.id and pb.sku_id = s.id and pb.status = 'active' group by bl.branch_id, p.id, s.id
)
select t.id as target_id, t.retailer_id, t.branch_id, t.product_id, t.sku_id, r.name as retailer_name, b.code as branch_code, b.name as branch_name, p.product_code, p.name as product_name, s.sku_code, s.sellable_name, t.minimum_stock, t.target_stock, t.lead_time_days, coalesce(bs.current_branch_stock, 0)::integer as current_branch_stock, coalesce(sr.avg_daily_sales, 0)::numeric as avg_daily_sales, coalesce(ws.available_warehouse_stock, 0)::integer as available_warehouse_stock, greatest(0, t.target_stock - coalesce(bs.current_branch_stock, 0))::integer as suggested_quantity,
  case when coalesce(ws.available_warehouse_stock, 0) < greatest(0, t.target_stock - coalesce(bs.current_branch_stock, 0)) then 'insufficient warehouse stock' else 'ready for planning' end as recommendation_status
from public.replenishment_targets t join public.retailers r on r.id = t.retailer_id join public.retailer_branches b on b.id = t.branch_id join public.products p on p.id = t.product_id join public.product_skus s on s.id = t.sku_id left join branch_stock bs on bs.branch_id = t.branch_id and bs.product_id = t.product_id and bs.sku_id = t.sku_id left join sales_rate sr on sr.branch_id = t.branch_id and sr.sku_id = t.sku_id left join warehouse_stock ws on ws.product_id = t.product_id and ws.sku_id = t.sku_id where t.status = 'active';

grant select on public.retailer_sell_through, public.replenishment_recommendations to authenticated;

commit;

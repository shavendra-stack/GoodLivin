-- GoodLivin Stage 7: reports, dashboards and business insights
--
-- This migration is intentionally read/report focused. It does not change
-- stock, sales, purchase-order or audit history. Existing RLS policies remain
-- authoritative because the application reads the Stage 1–6 base tables and
-- security-invoker views through the authenticated user session.

begin;

insert into public.permissions (code, label, description) values
  ('reports.inventory', 'View inventory reports', 'View live stock, movement, expiry and operational inventory reports.'),
  ('reports.sales', 'View sales reports', 'View sales, returns, refunds, channels and sell-through reports.'),
  ('reports.retailers', 'View retailer performance reports', 'View retailer branch holdings, sell-through and replenishment reporting.'),
  ('reports.purchasing', 'View purchasing reports', 'View purchase orders, incoming stock, supplier delivery and operational purchasing reports.'),
  ('reports.financial', 'View financial report values', 'View restricted financial report values including valuation, costs, payments and sales values.'),
  ('reports.traceability', 'View batch traceability reports', 'View batch traceability across procurement, ledger, sales, returns and retailer holdings.')
on conflict (code) do update
set label = excluded.label,
    description = excluded.description;

insert into public.role_permissions (role_code, permission_code)
select 'director_admin', code
from public.permissions
where code in (
  'reports.view',
  'reports.export',
  'reports.inventory',
  'reports.sales',
  'reports.retailers',
  'reports.purchasing',
  'reports.financial',
  'reports.traceability'
)
on conflict do nothing;

insert into public.role_permissions (role_code, permission_code) values
  ('inventory_manager', 'reports.view'),
  ('inventory_manager', 'reports.export'),
  ('inventory_manager', 'reports.inventory'),
  ('inventory_manager', 'reports.purchasing'),
  ('inventory_manager', 'reports.traceability'),
  ('warehouse_staff', 'reports.view'),
  ('warehouse_staff', 'reports.export'),
  ('warehouse_staff', 'reports.inventory'),
  ('warehouse_staff', 'reports.purchasing'),
  ('warehouse_staff', 'reports.traceability'),
  ('sales_manager', 'reports.view'),
  ('sales_manager', 'reports.export'),
  ('sales_manager', 'reports.sales'),
  ('sales_manager', 'reports.retailers'),
  ('sales_manager', 'reports.traceability'),
  ('finance_team', 'reports.view'),
  ('finance_team', 'reports.export'),
  ('finance_team', 'reports.sales'),
  ('finance_team', 'reports.retailers'),
  ('finance_team', 'reports.purchasing'),
  ('finance_team', 'reports.financial'),
  ('finance_team', 'reports.traceability'),
  ('auditor_read_only', 'reports.inventory'),
  ('auditor_read_only', 'reports.sales'),
  ('auditor_read_only', 'reports.retailers'),
  ('auditor_read_only', 'reports.purchasing'),
  ('auditor_read_only', 'reports.financial'),
  ('auditor_read_only', 'reports.traceability')
on conflict do nothing;

create index if not exists stock_movements_report_created_idx
  on public.stock_movements (status, created_at desc, movement_type);

create index if not exists stock_movements_report_batch_idx
  on public.stock_movements (batch_id, status, created_at desc);

create index if not exists sales_orders_report_channel_idx
  on public.sales_orders (status, sales_channel, sale_date desc);

create index if not exists sales_orders_report_product_idx
  on public.sales_orders (product_id, sku_id, sale_date desc);

create index if not exists retailer_sales_reports_report_branch_idx
  on public.retailer_sales_reports (status, retailer_id, branch_id, report_date desc);

create index if not exists inventory_returns_report_condition_idx
  on public.inventory_returns (status, condition, return_date desc);

create index if not exists purchase_order_lines_report_sku_idx
  on public.purchase_order_lines (product_id, sku_id, purchase_order_id);

create index if not exists purchase_order_payments_report_order_idx
  on public.purchase_order_payments (purchase_order_id, payment_date desc);

create index if not exists purchase_order_receipts_report_batch_idx
  on public.purchase_order_receipts (batch_id, status, received_on desc);

create index if not exists retailer_agreements_report_shelf_life_idx
  on public.retailer_commercial_agreements (retailer_id, status, minimum_shelf_life_days);

create or replace function public.log_report_export(
  p_report_type text,
  p_filters jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('reports.export') then
    raise exception 'You do not have permission to export reports';
  end if;

  if p_report_type not in ('inventory', 'sales', 'retailers', 'purchasing', 'valuation', 'expiry', 'traceability') then
    raise exception 'Unknown report type';
  end if;

  perform public.write_audit_log(
    'report_exports',
    null,
    'export',
    null,
    jsonb_build_object(
      'report_type', p_report_type,
      'filters', coalesce(p_filters, '{}'::jsonb),
      'exported_at', now()
    ),
    'Report CSV exported'
  );
end;
$$;

grant execute on function public.log_report_export(text, jsonb) to authenticated;

comment on function public.log_report_export(text, jsonb) is
  'Stage 7 export audit helper. It records report CSV exports without bypassing RLS or exposing report data.';

commit;

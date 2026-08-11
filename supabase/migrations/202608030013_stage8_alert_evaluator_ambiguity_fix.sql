-- GoodLivin Stage 8 corrective migration
--
-- Fixes the live alert evaluator failure:
--   column reference "alert_type" is ambiguous
--
-- The evaluator declares a PL/pgSQL variable named alert_type and also reads
-- public.operational_alert_rules.alert_type. PostgreSQL can treat the
-- unqualified rule lookups as ambiguous. This migration keeps the existing
-- function body and qualifies only those rule-table column references.
--
-- Safe to rerun. Does not change alert permissions, RLS policies, inventory
-- movements, approval decisions, external delivery, or historical data.

begin;

do $$
declare
  function_sql text;
begin
  select pg_get_functiondef('public.stage8_run_operational_alert_check(text)'::regprocedure)
  into function_sql;

  if function_sql is null then
    raise exception 'public.stage8_run_operational_alert_check(text) does not exist. Run Stage 8 migration first.';
  end if;

  function_sql := replace(
    function_sql,
    'from public.operational_alert_rules
    where enabled and alert_type = ''expiry.approaching'' and expiry_warning_days is not null;',
    'from public.operational_alert_rules r
    where r.enabled and r.alert_type = ''expiry.approaching'' and r.expiry_warning_days is not null;'
  );

  function_sql := replace(
    function_sql,
    'from public.operational_alert_rules
    where enabled and alert_type = ''retailer.sales_report_overdue'' and retailer_sales_report_overdue_days is not null;',
    'from public.operational_alert_rules r
    where r.enabled and r.alert_type = ''retailer.sales_report_overdue'' and r.retailer_sales_report_overdue_days is not null;'
  );

  function_sql := replace(
    function_sql,
    'from public.operational_alert_rules
    where enabled and alert_type = ''purchase_order.delivery'' and supplier_order_reminder_days is not null;',
    'from public.operational_alert_rules r
    where r.enabled and r.alert_type = ''purchase_order.delivery'' and r.supplier_order_reminder_days is not null;'
  );

  function_sql := replace(
    function_sql,
    'from public.operational_alert_rules
    where enabled and alert_type = ''purchase_order.payment'' and purchase_order_payment_reminder_days is not null;',
    'from public.operational_alert_rules r
    where r.enabled and r.alert_type = ''purchase_order.payment'' and r.purchase_order_payment_reminder_days is not null;'
  );

  execute function_sql;

  select pg_get_functiondef('public.stage8_run_operational_alert_check(text)'::regprocedure)
  into function_sql;

  if function_sql like '%where enabled and alert_type =%' then
    raise exception 'Stage 8 alert evaluator still contains ambiguous alert_type rule lookups';
  end if;
end $$;

grant execute on function public.stage8_run_operational_alert_check(text) to authenticated;

comment on function public.stage8_run_operational_alert_check(text) is
  'Idempotent Stage 8 alert evaluator. Qualifies rule alert_type lookups to avoid PL/pgSQL ambiguity; it creates, updates or resolves alerts only and does not post stock, approve workflows, send orders or record payments.';

notify pgrst, 'reload schema';

commit;

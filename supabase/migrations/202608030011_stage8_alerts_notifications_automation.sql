-- GoodLivin Stage 8: Alerts, notifications and operational automation
--
-- Alerts are advisory workflow records. This migration does not modify stock
-- movements, purchase-order postings, payments, approvals or balances.
-- Repeated alert evaluation is idempotent and preserves alert history.

begin;

insert into public.permissions (code, label, description) values
  ('alerts.view', 'View operational alerts', 'View in-app operational alerts and notification history.'),
  ('alerts.acknowledge', 'Acknowledge alerts', 'Mark assigned alerts as read or acknowledged.'),
  ('alerts.manage', 'Manage operational alerts', 'Assign, snooze, resolve and reopen permitted operational alerts.'),
  ('alerts.rules.manage', 'Manage alert rules', 'Adjust operational alert rules and thresholds.'),
  ('alerts.run', 'Run alert checks', 'Run server-side operational alert evaluation.'),
  ('approvals.view', 'View approval inbox', 'View pending approval requests and controlled workflow review items.')
on conflict (code) do update set label = excluded.label, description = excluded.description;

insert into public.role_permissions (role_code, permission_code)
select 'director_admin', code
from public.permissions
where code in ('alerts.view','alerts.acknowledge','alerts.manage','alerts.rules.manage','alerts.run','approvals.view')
on conflict do nothing;

insert into public.role_permissions (role_code, permission_code) values
  ('inventory_manager', 'alerts.view'),
  ('inventory_manager', 'alerts.acknowledge'),
  ('inventory_manager', 'alerts.manage'),
  ('inventory_manager', 'alerts.rules.manage'),
  ('inventory_manager', 'alerts.run'),
  ('inventory_manager', 'approvals.view'),
  ('warehouse_staff', 'alerts.view'),
  ('warehouse_staff', 'alerts.acknowledge'),
  ('warehouse_staff', 'approvals.view'),
  ('finance_team', 'alerts.view'),
  ('finance_team', 'alerts.acknowledge'),
  ('finance_team', 'alerts.manage'),
  ('finance_team', 'approvals.view'),
  ('sales_manager', 'alerts.view'),
  ('sales_manager', 'alerts.acknowledge'),
  ('sales_manager', 'alerts.manage'),
  ('sales_manager', 'alerts.rules.manage'),
  ('sales_manager', 'alerts.run'),
  ('sales_manager', 'approvals.view'),
  ('auditor_read_only', 'alerts.view'),
  ('auditor_read_only', 'approvals.view')
on conflict do nothing;

create table if not exists public.operational_alert_rules (
  id uuid primary key default gen_random_uuid(),
  rule_code text not null unique,
  alert_type text not null,
  name text not null,
  description text,
  scope text not null default 'global' check (scope in ('global','sku','location','sku_location','retailer','retailer_branch','supplier','purchase_order')),
  product_id uuid references public.products(id),
  sku_id uuid references public.product_skus(id),
  location_id uuid references public.inventory_locations(id),
  retailer_id uuid references public.retailers(id),
  branch_id uuid references public.retailer_branches(id),
  supplier_id uuid references public.suppliers(id),
  minimum_stock_level integer check (minimum_stock_level is null or minimum_stock_level >= 0),
  target_stock_level integer check (target_stock_level is null or target_stock_level >= 0),
  reorder_point integer check (reorder_point is null or reorder_point >= 0),
  expiry_warning_days integer check (expiry_warning_days is null or expiry_warning_days >= 0),
  minimum_shelf_life_days integer check (minimum_shelf_life_days is null or minimum_shelf_life_days >= 0),
  retailer_sales_report_overdue_days integer check (retailer_sales_report_overdue_days is null or retailer_sales_report_overdue_days >= 0),
  supplier_order_reminder_days integer check (supplier_order_reminder_days is null or supplier_order_reminder_days >= 0),
  purchase_order_payment_reminder_days integer check (purchase_order_payment_reminder_days is null or purchase_order_payment_reminder_days >= 0),
  priority text not null default 'medium' check (priority in ('informational','low','medium','high','critical')),
  recipient_roles text[] not null default array['director_admin']::text[],
  enabled boolean not null default true,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (target_stock_level is null or minimum_stock_level is null or target_stock_level >= minimum_stock_level),
  check (reorder_point is null or minimum_stock_level is null or reorder_point >= minimum_stock_level)
);

create table if not exists public.operational_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null,
  alert_type text not null,
  priority text not null default 'medium' check (priority in ('informational','low','medium','high','critical')),
  title text not null,
  explanation text not null,
  recommended_action text not null,
  status text not null default 'open' check (status in ('open','acknowledged','snoozed','resolved')),
  due_at timestamptz,
  related_table text,
  related_record_id uuid,
  product_id uuid references public.products(id),
  sku_id uuid references public.product_skus(id),
  batch_id uuid references public.product_batches(id),
  location_id uuid references public.inventory_locations(id),
  retailer_id uuid references public.retailers(id),
  branch_id uuid references public.retailer_branches(id),
  supplier_id uuid references public.suppliers(id),
  purchase_order_id uuid references public.purchase_orders(id),
  assigned_role text references public.roles(code),
  assigned_user_id uuid references auth.users(id),
  acknowledged_by uuid references auth.users(id),
  acknowledged_at timestamptz,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  resolution_reason text,
  metadata jsonb not null default '{}'::jsonb,
  last_evaluated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operational_alert_recipients (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.operational_alerts(id) on delete cascade,
  recipient_user_id uuid references auth.users(id) on delete cascade,
  recipient_role_code text references public.roles(code),
  read_at timestamptz,
  snoozed_until timestamptz,
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((recipient_user_id is not null)::integer + (recipient_role_code is not null)::integer = 1)
);

create table if not exists public.operational_alert_events (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid references public.operational_alerts(id) on delete cascade,
  event_type text not null check (event_type in ('created','condition_updated','read','unread','acknowledged','assigned','snoozed','resolved','reopened','auto_resolved','rule_updated')),
  actor_user_id uuid references auth.users(id),
  reason text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.alert_automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_name text not null,
  trigger_source text not null default 'manual' check (trigger_source in ('manual','scheduled','system','data_change')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running','succeeded','failed','partial')),
  records_checked integer not null default 0 check (records_checked >= 0),
  alerts_created integer not null default 0 check (alerts_created >= 0),
  alerts_updated integer not null default 0 check (alerts_updated >= 0),
  alerts_resolved integer not null default 0 check (alerts_resolved >= 0),
  errors jsonb not null default '[]'::jsonb,
  retry_count integer not null default 0 check (retry_count >= 0),
  triggered_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.notification_delivery_queue (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid references public.operational_alerts(id) on delete cascade,
  channel text not null default 'in_app' check (channel in ('in_app','email','sms','whatsapp','webhook')),
  provider text not null default 'none',
  status text not null default 'deferred' check (status in ('deferred','queued','sent','failed','cancelled')),
  payload jsonb not null default '{}'::jsonb,
  last_error text,
  attempted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists operational_alert_rules_type_enabled_idx on public.operational_alert_rules (alert_type, enabled);
create index if not exists operational_alerts_status_priority_idx on public.operational_alerts (status, priority, created_at desc);
create index if not exists operational_alerts_related_idx on public.operational_alerts (related_table, related_record_id);
create unique index if not exists operational_alerts_unresolved_key_idx on public.operational_alerts (alert_key) where status <> 'resolved';
create unique index if not exists operational_alert_recipients_user_idx on public.operational_alert_recipients (alert_id, recipient_user_id) where recipient_user_id is not null;
create unique index if not exists operational_alert_recipients_role_idx on public.operational_alert_recipients (alert_id, recipient_role_code) where recipient_role_code is not null;
create index if not exists operational_alert_events_alert_idx on public.operational_alert_events (alert_id, created_at desc);
create index if not exists alert_automation_runs_started_idx on public.alert_automation_runs (started_at desc);

insert into public.operational_alert_rules
  (rule_code, alert_type, name, description, minimum_stock_level, target_stock_level, reorder_point, expiry_warning_days, minimum_shelf_life_days, retailer_sales_report_overdue_days, supplier_order_reminder_days, purchase_order_payment_reminder_days, priority, recipient_roles)
values
  ('stock.low.warehouse.default', 'stock.low_stock', 'Warehouse low-stock default', 'Uses SKU/location override first, then product minimum and reorder levels.', null, null, null, null, null, null, null, null, 'high', array['director_admin','inventory_manager','warehouse_staff']),
  ('stock.out.default', 'stock.out_of_stock', 'Out-of-stock default', 'Raises a critical signal when sellable available stock reaches zero.', null, null, null, null, null, null, null, null, 'critical', array['director_admin','inventory_manager','warehouse_staff']),
  ('retailer.replenishment.default', 'retailer.replenishment', 'Retailer replenishment default', 'Uses existing retailer replenishment targets and warehouse availability.', 6, 18, 6, null, null, null, null, null, 'medium', array['director_admin','inventory_manager','sales_manager']),
  ('expiry.warning.default', 'expiry.approaching', 'Expiry warning default', 'Warns before stock expires using FEFO-aware batch balances.', null, null, null, 90, null, null, null, null, 'medium', array['director_admin','inventory_manager','warehouse_staff']),
  ('expiry.expired.default', 'expiry.expired', 'Expired stock default', 'Raises critical alerts for stock already expired.', null, null, null, 0, null, null, null, null, 'critical', array['director_admin','inventory_manager','warehouse_staff']),
  ('retailer.sales_report.default', 'retailer.sales_report_overdue', 'Retailer sales report overdue default', 'Flags branches whose latest GoodLivin-entered sales report is overdue.', null, null, null, null, null, 14, null, null, 'high', array['director_admin','sales_manager']),
  ('purchase_order.delivery.default', 'purchase_order.delivery', 'Purchase-order delivery reminder default', 'Flags active purchase orders approaching or past expected delivery.', null, null, null, null, null, null, 7, null, 'high', array['director_admin','inventory_manager','warehouse_staff']),
  ('purchase_order.payment.default', 'purchase_order.payment', 'Purchase-order payment reminder default', 'Flags outstanding purchase-order payment amounts near expected delivery.', null, null, null, null, null, null, null, 7, 'high', array['director_admin','finance_team']),
  ('approval.pending.default', 'approval.pending', 'Approval inbox default', 'Surfaces pending controlled workflow approvals without bypassing existing workflows.', null, null, null, null, null, null, null, null, 'high', array['director_admin','inventory_manager','sales_manager','finance_team'])
on conflict (rule_code) do nothing;

create or replace function public.stage8_current_user_roles()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(role_code order by role_code), array[]::text[])
  from public.user_roles
  where user_id = auth.uid();
$$;

create or replace function public.stage8_can_manage_alert_type(p_alert_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_role('director_admin')
    or (
      public.has_role('inventory_manager')
      and (
        p_alert_type like 'stock.%'
        or p_alert_type like 'batch.%'
        or p_alert_type like 'expiry.%'
        or p_alert_type like 'inventory.%'
        or p_alert_type like 'transfer.%'
        or p_alert_type like 'receiving.%'
        or p_alert_type = 'retailer.replenishment'
        or p_alert_type like 'purchase_order.delivery%'
        or p_alert_type like 'purchase_order.receipt%'
        or p_alert_type = 'approval.pending'
      )
    )
    or (
      public.has_role('sales_manager')
      and (
        p_alert_type like 'retailer.%'
        or p_alert_type like 'sales.%'
        or p_alert_type = 'approval.pending'
      )
    )
    or (
      public.has_role('finance_team')
      and (
        p_alert_type like 'purchase_order.payment%'
        or p_alert_type like 'finance.%'
        or p_alert_type = 'approval.pending'
      )
    );
$$;

create or replace function public.stage8_user_can_view_alert(
  p_alert_id uuid,
  p_alert_type text,
  p_assigned_user_id uuid,
  p_assigned_role text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_permission('alerts.view')
    and not public.has_role('retailer_user')
    and (
      public.has_role('director_admin')
      or public.has_role('auditor_read_only')
      or public.stage8_can_manage_alert_type(p_alert_type)
      or p_assigned_user_id = auth.uid()
      or p_assigned_role = any(public.stage8_current_user_roles())
      or exists (
        select 1
        from public.operational_alert_recipients r
        where r.alert_id = p_alert_id
          and (
            r.recipient_user_id = auth.uid()
            or r.recipient_role_code = any(public.stage8_current_user_roles())
          )
      )
    );
$$;

create or replace function public.stage8_assert_rule_roles(p_roles text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_roles is null or array_length(p_roles, 1) is null then
    raise exception 'At least one recipient role is required';
  end if;

  if exists (
    select 1
    from unnest(p_roles) as requested(role_code)
    left join public.roles r on r.code = requested.role_code
    where r.code is null or requested.role_code = 'retailer_user'
  ) then
    raise exception 'Alert recipient roles must be valid internal GoodLivin roles';
  end if;
end;
$$;

create or replace function public.stage8_validate_alert_rule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.stage8_assert_rule_roles(new.recipient_roles);
  if new.updated_by is null and auth.uid() is not null then new.updated_by := auth.uid(); end if;
  if tg_op = 'INSERT' and new.created_by is null and auth.uid() is not null then new.created_by := auth.uid(); end if;
  return new;
end;
$$;

drop trigger if exists operational_alert_rules_validate on public.operational_alert_rules;
create trigger operational_alert_rules_validate
before insert or update on public.operational_alert_rules
for each row execute function public.stage8_validate_alert_rule();

create or replace function public.stage8_upsert_operational_alert(
  p_alert_key text,
  p_alert_type text,
  p_priority text,
  p_title text,
  p_explanation text,
  p_recommended_action text,
  p_due_at timestamptz default null,
  p_related_table text default null,
  p_related_record_id uuid default null,
  p_product_id uuid default null,
  p_sku_id uuid default null,
  p_batch_id uuid default null,
  p_location_id uuid default null,
  p_retailer_id uuid default null,
  p_branch_id uuid default null,
  p_supplier_id uuid default null,
  p_purchase_order_id uuid default null,
  p_assigned_role text default null,
  p_assigned_user_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_recipient_roles text[] default array['director_admin']::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.operational_alerts;
  v_alert_id uuid;
  v_action text;
  role_code text;
begin
  if nullif(trim(p_alert_key), '') is null then raise exception 'Alert key is required'; end if;
  if p_priority not in ('informational','low','medium','high','critical') then raise exception 'Invalid alert priority'; end if;
  perform public.stage8_assert_rule_roles(coalesce(p_recipient_roles, array['director_admin']::text[]));

  select * into existing
  from public.operational_alerts
  where alert_key = p_alert_key
    and status <> 'resolved'
  for update;

  if existing.id is null then
    insert into public.operational_alerts (
      alert_key, alert_type, priority, title, explanation, recommended_action, due_at,
      related_table, related_record_id, product_id, sku_id, batch_id, location_id,
      retailer_id, branch_id, supplier_id, purchase_order_id, assigned_role,
      assigned_user_id, metadata, created_by
    )
    values (
      trim(p_alert_key), p_alert_type, p_priority, p_title, p_explanation, p_recommended_action, p_due_at,
      p_related_table, p_related_record_id, p_product_id, p_sku_id, p_batch_id, p_location_id,
      p_retailer_id, p_branch_id, p_supplier_id, p_purchase_order_id, p_assigned_role,
      p_assigned_user_id, coalesce(p_metadata, '{}'::jsonb), auth.uid()
    )
    returning id into v_alert_id;
    v_action := 'created';
  else
    v_alert_id := existing.id;
    update public.operational_alerts
    set alert_type = p_alert_type,
        priority = p_priority,
        title = p_title,
        explanation = p_explanation,
        recommended_action = p_recommended_action,
        due_at = p_due_at,
        related_table = p_related_table,
        related_record_id = p_related_record_id,
        product_id = p_product_id,
        sku_id = p_sku_id,
        batch_id = p_batch_id,
        location_id = p_location_id,
        retailer_id = p_retailer_id,
        branch_id = p_branch_id,
        supplier_id = p_supplier_id,
        purchase_order_id = p_purchase_order_id,
        assigned_role = coalesce(p_assigned_role, assigned_role),
        assigned_user_id = coalesce(p_assigned_user_id, assigned_user_id),
        metadata = coalesce(p_metadata, '{}'::jsonb),
        last_evaluated_at = now(),
        status = case
          when status = 'snoozed' and (p_priority = 'critical' or due_at is not null and due_at <= now()) then 'open'
          else status
        end,
        updated_at = now()
    where id = v_alert_id;
    v_action := 'updated';
  end if;

  foreach role_code in array coalesce(p_recipient_roles, array['director_admin']::text[]) loop
    insert into public.operational_alert_recipients (alert_id, recipient_role_code)
    values (v_alert_id, role_code)
    on conflict do nothing;
  end loop;

  insert into public.operational_alert_events (alert_id, event_type, actor_user_id, after_snapshot)
  values (v_alert_id, case when v_action = 'created' then 'created' else 'condition_updated' end, auth.uid(), jsonb_build_object('alert_key', p_alert_key, 'priority', p_priority, 'metadata', coalesce(p_metadata, '{}'::jsonb)));

  return jsonb_build_object('id', v_alert_id, 'action', v_action);
end;
$$;

create or replace function public.stage8_resolve_stale_alerts(
  p_alert_types text[],
  p_seen_keys text[],
  p_reason text default 'Underlying condition no longer exists'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  alert_row record;
  resolved_count integer := 0;
begin
  for alert_row in
    select id, alert_key
    from public.operational_alerts
    where status <> 'resolved'
      and alert_type = any(p_alert_types)
      and not (alert_key = any(coalesce(p_seen_keys, array[]::text[])))
    for update
  loop
    update public.operational_alerts
    set status = 'resolved',
        resolved_by = auth.uid(),
        resolved_at = now(),
        resolution_reason = p_reason,
        updated_at = now()
    where id = alert_row.id;
    insert into public.operational_alert_events (alert_id, event_type, actor_user_id, reason)
    values (alert_row.id, 'auto_resolved', auth.uid(), p_reason);
    resolved_count := resolved_count + 1;
  end loop;
  return resolved_count;
end;
$$;

create or replace function public.stage8_run_operational_alert_check(p_source text default 'manual')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  run_id uuid;
  rec record;
  result jsonb;
  seen_keys text[] := array[]::text[];
  generated_types text[] := array[
    'stock.low_stock','stock.out_of_stock','retailer.replenishment',
    'expiry.approaching','expiry.expired','batch.quality_action',
    'retailer.sales_report_overdue','purchase_order.approval_request',
    'purchase_order.not_sent','purchase_order.delivery_due','purchase_order.overdue',
    'purchase_order.outstanding_receipt','purchase_order.payment_due',
    'inventory.adjustment_review','inventory.discrepancy','transfer.approval_request',
    'approval.pending'
  ]::text[];
  v_records_checked integer := 0;
  v_alerts_created integer := 0;
  v_alerts_updated integer := 0;
  v_alerts_resolved integer := 0;
  expiry_window integer := 90;
  retailer_report_days integer := 14;
  delivery_reminder_days integer := 7;
  payment_reminder_days integer := 7;
  threshold integer;
  target integer;
  alert_type text;
  priority text;
  key text;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not (public.has_permission('alerts.run') or public.has_permission('alerts.manage')) then
    raise exception 'You do not have permission to run operational alert checks';
  end if;

  insert into public.alert_automation_runs (automation_name, trigger_source, triggered_by)
  values ('stage8_operational_alert_check', coalesce(nullif(p_source, ''), 'manual'), auth.uid())
  returning id into run_id;

  begin
    select coalesce(max(expiry_warning_days), 90) into expiry_window
    from public.operational_alert_rules r
    where r.enabled and r.alert_type = 'expiry.approaching' and r.expiry_warning_days is not null;

    select coalesce(max(retailer_sales_report_overdue_days), 14) into retailer_report_days
    from public.operational_alert_rules r
    where r.enabled and r.alert_type = 'retailer.sales_report_overdue' and r.retailer_sales_report_overdue_days is not null;

    select coalesce(max(supplier_order_reminder_days), 7) into delivery_reminder_days
    from public.operational_alert_rules r
    where r.enabled and r.alert_type = 'purchase_order.delivery' and r.supplier_order_reminder_days is not null;

    select coalesce(max(purchase_order_payment_reminder_days), 7) into payment_reminder_days
    from public.operational_alert_rules r
    where r.enabled and r.alert_type = 'purchase_order.payment' and r.purchase_order_payment_reminder_days is not null;

    for rec in
      with sku_locations as (
        select p.id as product_id, p.product_code, p.name as product_name, p.minimum_stock_level as product_minimum_stock,
          p.reorder_level as product_reorder_level, s.id as sku_id, s.sku_code, s.sellable_name,
          l.id as location_id, l.code as location_code, l.name as location_name, l.location_type,
          coalesce(sum(sb.quantity_on_hand), 0)::integer as physical_stock,
          coalesce(sum(case when b.quality_status = 'approved' and b.expires_on >= current_date then sb.quantity_on_hand else 0 end), 0)::integer as available_stock
        from public.products p
        join public.product_skus s on s.product_id = p.id and s.status = 'active'
        join public.inventory_locations l on l.status = 'active' and l.location_type in ('warehouse','main_warehouse','office_stock','online_order_stock')
        left join public.stock_balances sb on sb.product_id = p.id and sb.location_id = l.id
        left join public.product_batches b on b.id = sb.batch_id and b.sku_id = s.id and b.status = 'active'
        where p.status = 'active'
        group by p.id, p.product_code, p.name, p.minimum_stock_level, p.reorder_level, s.id, s.sku_code, s.sellable_name, l.id, l.code, l.name, l.location_type
      )
      select sl.*, rule.minimum_stock_level as rule_minimum_stock, rule.target_stock_level as rule_target_stock,
        rule.reorder_point as rule_reorder_point, rule.priority as rule_priority, rule.recipient_roles
      from sku_locations sl
      left join lateral (
        select *
        from public.operational_alert_rules r
        where r.enabled
          and r.alert_type in ('stock.low_stock','stock.out_of_stock')
          and (r.sku_id is null or r.sku_id = sl.sku_id)
          and (r.location_id is null or r.location_id = sl.location_id)
        order by (case when r.sku_id is null then 0 else 2 end + case when r.location_id is null then 0 else 1 end) desc, r.created_at desc
        limit 1
      ) rule on true
    loop
      v_records_checked := v_records_checked + 1;
      threshold := greatest(coalesce(rec.rule_minimum_stock, rec.product_minimum_stock, 0), coalesce(rec.rule_reorder_point, rec.product_reorder_level, 0));
      target := greatest(coalesce(rec.rule_target_stock, rec.product_reorder_level, threshold), threshold);

      if threshold > 0 and rec.available_stock <= threshold then
        alert_type := case when rec.available_stock <= 0 then 'stock.out_of_stock' else 'stock.low_stock' end;
        priority := case when rec.available_stock <= 0 then 'critical' else coalesce(rec.rule_priority, 'high') end;
        key := alert_type || ':' || rec.sku_id::text || ':' || rec.location_id::text;
        result := public.stage8_upsert_operational_alert(
          key, alert_type, priority,
          case when rec.available_stock <= 0 then 'Out of stock: ' else 'Low stock: ' end || rec.sku_code || ' at ' || rec.location_code,
          rec.sellable_name || ' has ' || rec.available_stock || ' available units at ' || rec.location_name || '. Physical stock is ' || rec.physical_stock || ', threshold is ' || threshold || '.',
          'Review FEFO stock, pending inbound supply and replenishment. Create a draft purchase order or transfer only after operational review.',
          now(), 'product_skus', rec.sku_id, rec.product_id, rec.sku_id, null, rec.location_id,
          null, null, null, null, 'inventory_manager', null,
          jsonb_build_object('physical_stock', rec.physical_stock, 'available_stock', rec.available_stock, 'incoming_stock', 0, 'projected_stock', rec.available_stock, 'minimum_stock_level', threshold, 'target_stock_level', target, 'recommended_reorder_quantity', greatest(0, target - rec.available_stock)),
          coalesce(rec.recipient_roles, array['director_admin','inventory_manager','warehouse_staff']::text[])
        );
        seen_keys := array_append(seen_keys, key);
        if result->>'action' = 'created' then v_alerts_created := v_alerts_created + 1; else v_alerts_updated := v_alerts_updated + 1; end if;
      end if;
    end loop;

    for rec in
      select rr.*, rule.priority as rule_priority, rule.recipient_roles
      from public.replenishment_recommendations rr
      left join lateral (
        select *
        from public.operational_alert_rules r
        where r.enabled
          and r.alert_type = 'retailer.replenishment'
          and (r.sku_id is null or r.sku_id = rr.sku_id)
          and (r.branch_id is null or r.branch_id = rr.branch_id)
        order by (case when r.sku_id is null then 0 else 2 end + case when r.branch_id is null then 0 else 1 end) desc, r.created_at desc
        limit 1
      ) rule on true
      where rr.current_branch_stock <= rr.minimum_stock or rr.suggested_quantity > 0
    loop
      v_records_checked := v_records_checked + 1;
      key := 'retailer.replenishment:' || rec.target_id::text;
      priority := case when rec.current_branch_stock <= 0 then 'critical' when rec.available_warehouse_stock < rec.suggested_quantity then 'high' else coalesce(rec.rule_priority, 'medium') end;
      result := public.stage8_upsert_operational_alert(
        key, 'retailer.replenishment', priority,
        'Retailer replenishment: ' || rec.branch_code || ' · ' || rec.sku_code,
        rec.branch_name || ' has ' || rec.current_branch_stock || ' calculated units. Minimum is ' || rec.minimum_stock || ', target is ' || rec.target_stock || '. Warehouse availability is ' || rec.available_warehouse_stock || '.',
        'Review the recommendation and create a draft stock transfer for approval if appropriate. This alert does not reserve stock.',
        now(), 'replenishment_targets', rec.target_id, rec.product_id, rec.sku_id, null, null,
        rec.retailer_id, rec.branch_id, null, null, 'sales_manager', null,
        jsonb_build_object('physical_stock', rec.current_branch_stock, 'available_stock', rec.current_branch_stock, 'incoming_stock', 0, 'projected_stock', rec.current_branch_stock, 'recommended_reorder_quantity', rec.suggested_quantity, 'warehouse_available_stock', rec.available_warehouse_stock, 'stock_basis', 'calculated from latest GoodLivin-entered movements and retailer reports'),
        coalesce(rec.recipient_roles, array['director_admin','inventory_manager','sales_manager']::text[])
      );
      seen_keys := array_append(seen_keys, key);
      if result->>'action' = 'created' then v_alerts_created := v_alerts_created + 1; else v_alerts_updated := v_alerts_updated + 1; end if;
    end loop;

    for rec in
      select b.id as batch_id, b.batch_number, b.product_id, b.sku_id, b.expires_on, b.quality_status,
        p.product_code, p.name as product_name, s.sku_code, s.sellable_name,
        l.id as location_id, l.code as location_code, l.name as location_name, l.retailer_id, l.branch_id,
        sb.quantity_on_hand,
        (b.expires_on - current_date)::integer as days_remaining
      from public.stock_balances sb
      join public.product_batches b on b.id = sb.batch_id and b.status = 'active'
      join public.products p on p.id = b.product_id and p.status = 'active'
      join public.product_skus s on s.id = b.sku_id and s.status = 'active'
      join public.inventory_locations l on l.id = sb.location_id and l.status = 'active'
      where sb.quantity_on_hand > 0
        and b.quality_status <> 'rejected'
        and b.quality_status <> 'recalled'
        and (b.expires_on - current_date) <= expiry_window
    loop
      v_records_checked := v_records_checked + 1;
      alert_type := case when rec.days_remaining < 0 then 'expiry.expired' else 'expiry.approaching' end;
      priority := case when rec.days_remaining < 0 then 'critical' when rec.days_remaining <= 30 then 'high' else 'medium' end;
      key := alert_type || ':' || rec.batch_id::text || ':' || rec.location_id::text;
      result := public.stage8_upsert_operational_alert(
        key, alert_type, priority,
        case when rec.days_remaining < 0 then 'Expired stock: ' else 'Expiry watch: ' end || rec.batch_number || ' at ' || rec.location_code,
        rec.sellable_name || ' batch ' || rec.batch_number || ' has ' || rec.quantity_on_hand || ' units at ' || rec.location_name || '. Days remaining: ' || rec.days_remaining || '.',
        case when rec.days_remaining < 0 then 'Stop selling or transferring this batch and review quarantine or controlled disposal workflow.' else 'Prioritize eligible FEFO allocation and review whether the stock can sell before expiry.' end,
        rec.expires_on::timestamptz, 'product_batches', rec.batch_id, rec.product_id, rec.sku_id, rec.batch_id, rec.location_id,
        rec.retailer_id, rec.branch_id, null, null, 'inventory_manager', null,
        jsonb_build_object('physical_stock', rec.quantity_on_hand, 'available_stock', case when rec.quality_status = 'approved' and rec.days_remaining >= 0 then rec.quantity_on_hand else 0 end, 'days_remaining', rec.days_remaining, 'expiry_window_days', expiry_window),
        array['director_admin','inventory_manager','warehouse_staff']::text[]
      );
      seen_keys := array_append(seen_keys, key);
      if result->>'action' = 'created' then v_alerts_created := v_alerts_created + 1; else v_alerts_updated := v_alerts_updated + 1; end if;
    end loop;

    for rec in
      select b.id as batch_id, b.batch_number, b.product_id, b.sku_id, b.quality_status,
        p.product_code, p.name as product_name, s.sku_code, s.sellable_name,
        l.id as location_id, l.code as location_code, l.name as location_name, l.location_type,
        l.retailer_id, l.branch_id, sb.quantity_on_hand
      from public.stock_balances sb
      join public.product_batches b on b.id = sb.batch_id and b.status = 'active'
      join public.products p on p.id = b.product_id
      join public.product_skus s on s.id = b.sku_id
      join public.inventory_locations l on l.id = sb.location_id
      where sb.quantity_on_hand > 0
        and (b.quality_status in ('quarantined','rejected','recalled') or l.location_type in ('quarantine','quarantine_stock','damaged_stock','expired_stock'))
    loop
      v_records_checked := v_records_checked + 1;
      key := 'batch.quality_action:' || rec.batch_id::text || ':' || rec.location_id::text;
      priority := case when rec.quality_status in ('rejected','recalled') or rec.location_type in ('expired_stock','damaged_stock') then 'critical' else 'high' end;
      result := public.stage8_upsert_operational_alert(
        key, 'batch.quality_action', priority,
        'Quality action required: ' || rec.batch_number,
        rec.quantity_on_hand || ' units of ' || rec.sellable_name || ' are held at ' || rec.location_name || ' with quality/location status requiring follow-up.',
        'Investigate batch condition, keep the stock segregated, and use controlled workflows for any disposal or correction.',
        now(), 'product_batches', rec.batch_id, rec.product_id, rec.sku_id, rec.batch_id, rec.location_id,
        rec.retailer_id, rec.branch_id, null, null, 'inventory_manager', null,
        jsonb_build_object('physical_stock', rec.quantity_on_hand, 'quality_status', rec.quality_status, 'location_type', rec.location_type),
        array['director_admin','inventory_manager','warehouse_staff']::text[]
      );
      seen_keys := array_append(seen_keys, key);
      if result->>'action' = 'created' then v_alerts_created := v_alerts_created + 1; else v_alerts_updated := v_alerts_updated + 1; end if;
    end loop;

    for rec in
      select *
      from public.retailer_sell_through
      where days_since_last_report > retailer_report_days
        and (current_stock > 0 or deliveries > 0 or sold > 0)
    loop
      v_records_checked := v_records_checked + 1;
      key := 'retailer.sales_report_overdue:' || rec.branch_id::text || ':' || rec.sku_id::text;
      result := public.stage8_upsert_operational_alert(
        key, 'retailer.sales_report_overdue', 'high',
        'Retailer sales report overdue: ' || rec.branch_code || ' · ' || rec.sku_code,
        rec.branch_name || ' has not had a GoodLivin-entered sales report for ' || rec.days_since_last_report || ' days. Current stock is calculated, not physically verified.',
        'Request or enter the latest retailer sell-through report before making replenishment decisions.',
        now(), 'retailer_branches', rec.branch_id, rec.product_id, rec.sku_id, null, null,
        rec.retailer_id, rec.branch_id, null, null, 'sales_manager', null,
        jsonb_build_object('days_since_last_report', rec.days_since_last_report, 'current_stock', rec.current_stock, 'stock_basis', 'calculated from latest GoodLivin-entered information'),
        array['director_admin','sales_manager']::text[]
      );
      seen_keys := array_append(seen_keys, key);
      if result->>'action' = 'created' then v_alerts_created := v_alerts_created + 1; else v_alerts_updated := v_alerts_updated + 1; end if;
    end loop;

    for rec in
      select po.*, coalesce(s.name, m.name) as supplier_name
      from public.purchase_orders po
      left join public.suppliers s on s.id = po.supplier_id
      left join public.manufacturers m on m.id = po.manufacturer_id
      where po.status in ('pending_approval','approved','sent_to_supplier','in_production','partially_ready','ready_for_dispatch','in_transit','partially_received')
    loop
      v_records_checked := v_records_checked + 1;

      if rec.status = 'pending_approval' then
        key := 'purchase_order.approval_request:' || rec.id::text;
        result := public.stage8_upsert_operational_alert(
          key, 'purchase_order.approval_request', 'high',
          'Purchase order awaiting approval: ' || rec.po_number,
          rec.po_number || ' is waiting for Director/Admin approval before it can be sent to the supplier.',
          'Open the purchase order, review supplier, quantities and costs, then use the existing approval workflow.',
          now(), 'purchase_orders', rec.id, null, null, null, rec.receiving_location_id,
          null, null, rec.supplier_id, rec.id, 'director_admin', null,
          jsonb_build_object('status', rec.status, 'total_amount', rec.total_amount, 'currency_code', rec.currency_code),
          array['director_admin']::text[]
        );
        seen_keys := array_append(seen_keys, key);
        if result->>'action' = 'created' then v_alerts_created := v_alerts_created + 1; else v_alerts_updated := v_alerts_updated + 1; end if;
      end if;

      if rec.status = 'approved' then
        key := 'purchase_order.not_sent:' || rec.id::text;
        result := public.stage8_upsert_operational_alert(
          key, 'purchase_order.not_sent', 'medium',
          'Approved PO not yet sent: ' || rec.po_number,
          rec.po_number || ' is approved but still not marked as sent to supplier.',
          'Confirm whether the order has been sent and update the existing purchase-order status workflow.',
          now(), 'purchase_orders', rec.id, null, null, null, rec.receiving_location_id,
          null, null, rec.supplier_id, rec.id, 'inventory_manager', null,
          jsonb_build_object('status', rec.status, 'supplier_name', rec.supplier_name),
          array['director_admin','inventory_manager']::text[]
        );
        seen_keys := array_append(seen_keys, key);
        if result->>'action' = 'created' then v_alerts_created := v_alerts_created + 1; else v_alerts_updated := v_alerts_updated + 1; end if;
      end if;

      if rec.expected_delivery_date is not null and rec.status not in ('fully_received','cancelled') and rec.expected_delivery_date <= current_date + delivery_reminder_days then
        alert_type := case when rec.expected_delivery_date < current_date then 'purchase_order.overdue' else 'purchase_order.delivery_due' end;
        priority := case when rec.expected_delivery_date < current_date then 'critical' else 'high' end;
        key := alert_type || ':' || rec.id::text;
        result := public.stage8_upsert_operational_alert(
          key, alert_type, priority,
          case when rec.expected_delivery_date < current_date then 'Overdue purchase order: ' else 'Purchase order delivery due: ' end || rec.po_number,
          rec.po_number || ' expected delivery date is ' || rec.expected_delivery_date || '. Current status is ' || rec.status || '.',
          'Contact the supplier or update the purchase-order workflow with the latest delivery status. Do not receive stock until it physically arrives.',
          rec.expected_delivery_date::timestamptz, 'purchase_orders', rec.id, null, null, null, rec.receiving_location_id,
          null, null, rec.supplier_id, rec.id, 'inventory_manager', null,
          jsonb_build_object('status', rec.status, 'expected_delivery_date', rec.expected_delivery_date),
          array['director_admin','inventory_manager','warehouse_staff']::text[]
        );
        seen_keys := array_append(seen_keys, key);
        if result->>'action' = 'created' then v_alerts_created := v_alerts_created + 1; else v_alerts_updated := v_alerts_updated + 1; end if;
      end if;

      if rec.total_amount > coalesce((select sum(amount) from public.purchase_order_payments where purchase_order_id = rec.id), 0)
        and rec.expected_delivery_date is not null
        and rec.expected_delivery_date <= current_date + payment_reminder_days then
        key := 'purchase_order.payment_due:' || rec.id::text;
        priority := case when rec.expected_delivery_date < current_date then 'critical' else 'high' end;
        result := public.stage8_upsert_operational_alert(
          key, 'purchase_order.payment_due', priority,
          'Purchase-order payment outstanding: ' || rec.po_number,
          rec.po_number || ' has outstanding payment of ' || (rec.total_amount - coalesce((select sum(amount) from public.purchase_order_payments where purchase_order_id = rec.id), 0)) || ' ' || rec.currency_code || '.',
          'Finance should review payment milestones and record any payment using the existing purchase-order payment workflow.',
          rec.expected_delivery_date::timestamptz, 'purchase_orders', rec.id, null, null, null, null,
          null, null, rec.supplier_id, rec.id, 'finance_team', null,
          jsonb_build_object('total_amount', rec.total_amount, 'paid_amount', coalesce((select sum(amount) from public.purchase_order_payments where purchase_order_id = rec.id), 0), 'currency_code', rec.currency_code),
          array['director_admin','finance_team']::text[]
        );
        seen_keys := array_append(seen_keys, key);
        if result->>'action' = 'created' then v_alerts_created := v_alerts_created + 1; else v_alerts_updated := v_alerts_updated + 1; end if;
      end if;
    end loop;

    for rec in
      select distinct purchase_order_id, po_number, status, supplier_id, supplier_name, receiving_location_id,
        sum(quantity_outstanding)::integer as quantity_outstanding
      from public.purchase_order_inbound
      where status = 'partially_received' and quantity_outstanding > 0
      group by purchase_order_id, po_number, status, supplier_id, supplier_name, receiving_location_id
    loop
      v_records_checked := v_records_checked + 1;
      key := 'purchase_order.outstanding_receipt:' || rec.purchase_order_id::text;
      result := public.stage8_upsert_operational_alert(
        key, 'purchase_order.outstanding_receipt', 'medium',
        'Partially received PO has outstanding quantity: ' || rec.po_number,
        rec.po_number || ' still has ' || rec.quantity_outstanding || ' units outstanding.',
        'Track the remaining inbound quantity and receive only physically accepted stock through the purchase-order receiving workflow.',
        now(), 'purchase_orders', rec.purchase_order_id, null, null, null, rec.receiving_location_id,
        null, null, rec.supplier_id, rec.purchase_order_id, 'inventory_manager', null,
        jsonb_build_object('quantity_outstanding', rec.quantity_outstanding, 'supplier_name', rec.supplier_name),
        array['director_admin','inventory_manager','warehouse_staff']::text[]
      );
      seen_keys := array_append(seen_keys, key);
      if result->>'action' = 'created' then v_alerts_created := v_alerts_created + 1; else v_alerts_updated := v_alerts_updated + 1; end if;
    end loop;

    for rec in
      select id, adjustment_number, adjustment_type, direction, quantity, product_id, sku_id, batch_id, location_id, created_by, reason
      from public.stock_adjustments
      where status = 'pending'
    loop
      v_records_checked := v_records_checked + 1;
      key := 'inventory.adjustment_review:' || rec.id::text;
      result := public.stage8_upsert_operational_alert(
        key, 'inventory.adjustment_review', 'high',
        'Inventory adjustment requires review: ' || rec.adjustment_number,
        'A ' || rec.direction || ' adjustment of ' || rec.quantity || ' units is pending for review. Reason: ' || rec.reason,
        'Review the adjustment details and use the existing controlled posting workflow if approved.',
        now(), 'stock_adjustments', rec.id, rec.product_id, rec.sku_id, rec.batch_id, rec.location_id,
        null, null, null, null, 'inventory_manager', null,
        jsonb_build_object('adjustment_type', rec.adjustment_type, 'direction', rec.direction, 'quantity', rec.quantity),
        array['director_admin','inventory_manager']::text[]
      );
      seen_keys := array_append(seen_keys, key);
      if result->>'action' = 'created' then v_alerts_created := v_alerts_created + 1; else v_alerts_updated := v_alerts_updated + 1; end if;
    end loop;

    for rec in
      select id, reconciliation_number, count_date, retailer_id, branch_id, product_id, sku_id, batch_id, counted_quantity, calculated_quantity, adjustment_quantity, created_by, reason
      from public.retailer_stock_reconciliations
      where status = 'pending' and adjustment_quantity <> 0
    loop
      v_records_checked := v_records_checked + 1;
      key := 'inventory.discrepancy:' || rec.id::text;
      result := public.stage8_upsert_operational_alert(
        key, 'inventory.discrepancy', 'high',
        'Retailer stock discrepancy: ' || rec.reconciliation_number,
        'Physical count differs from calculated branch stock by ' || rec.adjustment_quantity || ' units.',
        'Review the reconciliation evidence and post only through the existing controlled reconciliation workflow.',
        now(), 'retailer_stock_reconciliations', rec.id, rec.product_id, rec.sku_id, rec.batch_id, null,
        rec.retailer_id, rec.branch_id, null, null, 'inventory_manager', null,
        jsonb_build_object('counted_quantity', rec.counted_quantity, 'calculated_quantity', rec.calculated_quantity, 'adjustment_quantity', rec.adjustment_quantity, 'stock_basis', 'calculated until physically verified'),
        array['director_admin','inventory_manager','sales_manager']::text[]
      );
      seen_keys := array_append(seen_keys, key);
      if result->>'action' = 'created' then v_alerts_created := v_alerts_created + 1; else v_alerts_updated := v_alerts_updated + 1; end if;
    end loop;

    for rec in
      select id, transfer_number, transfer_date, product_id, sku_id, batch_id, source_location_id, destination_location_id, quantity, created_by
      from public.stock_transfers
      where status = 'draft'
    loop
      v_records_checked := v_records_checked + 1;
      key := 'transfer.approval_request:' || rec.id::text;
      result := public.stage8_upsert_operational_alert(
        key, 'transfer.approval_request', 'medium',
        'Draft transfer ready for review: ' || rec.transfer_number,
        'A stock transfer of ' || rec.quantity || ' units is still in draft.',
        'Review FEFO, shelf-life and destination eligibility before dispatching through the existing transfer workflow.',
        rec.transfer_date::timestamptz, 'stock_transfers', rec.id, rec.product_id, rec.sku_id, rec.batch_id, rec.source_location_id,
        null, null, null, null, 'inventory_manager', null,
        jsonb_build_object('quantity', rec.quantity, 'transfer_date', rec.transfer_date, 'destination_location_id', rec.destination_location_id),
        array['director_admin','inventory_manager','warehouse_staff']::text[]
      );
      seen_keys := array_append(seen_keys, key);
      if result->>'action' = 'created' then v_alerts_created := v_alerts_created + 1; else v_alerts_updated := v_alerts_updated + 1; end if;
    end loop;

    for rec in
      select id, record_type, record_id, approval_step, requested_by, created_at
      from public.approval_records
      where status = 'pending'
    loop
      v_records_checked := v_records_checked + 1;
      key := 'approval.pending:' || rec.id::text;
      result := public.stage8_upsert_operational_alert(
        key, 'approval.pending', 'high',
        'Approval request pending: ' || rec.record_type,
        'Approval step ' || rec.approval_step || ' is pending for ' || rec.record_type || '.',
        'Open the approval inbox and complete the existing controlled approval workflow.',
        rec.created_at, 'approval_records', rec.id, null, null, null, null,
        null, null, null, null, 'director_admin', null,
        jsonb_build_object('record_type', rec.record_type, 'record_id', rec.record_id, 'approval_step', rec.approval_step),
        array['director_admin','inventory_manager','sales_manager','finance_team']::text[]
      );
      seen_keys := array_append(seen_keys, key);
      if result->>'action' = 'created' then v_alerts_created := v_alerts_created + 1; else v_alerts_updated := v_alerts_updated + 1; end if;
    end loop;

    v_alerts_resolved := public.stage8_resolve_stale_alerts(generated_types, seen_keys, 'Automatically resolved because the latest alert check no longer found the condition.');

    update public.alert_automation_runs
    set completed_at = now(),
        status = 'succeeded',
        records_checked = v_records_checked,
        alerts_created = v_alerts_created,
        alerts_updated = v_alerts_updated,
        alerts_resolved = v_alerts_resolved
    where id = run_id;
  exception when others then
    update public.alert_automation_runs
    set completed_at = now(),
        status = 'failed',
        records_checked = v_records_checked,
        alerts_created = v_alerts_created,
        alerts_updated = v_alerts_updated,
        alerts_resolved = v_alerts_resolved,
        errors = jsonb_build_array(jsonb_build_object('message', sqlerrm, 'state', sqlstate))
    where id = run_id;
  end;

  return run_id;
end;
$$;

create or replace function public.mark_operational_alert_read(p_alert_id uuid, p_read boolean default true)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  alert_row public.operational_alerts;
  role_code text;
begin
  select * into alert_row from public.operational_alerts where id = p_alert_id;
  if alert_row.id is null then raise exception 'Alert not found'; end if;
  if not public.stage8_user_can_view_alert(alert_row.id, alert_row.alert_type, alert_row.assigned_user_id, alert_row.assigned_role) then
    raise exception 'You do not have permission to update this alert';
  end if;

  insert into public.operational_alert_recipients (alert_id, recipient_user_id, read_at)
  values (p_alert_id, auth.uid(), case when p_read then now() else null end)
  on conflict (alert_id, recipient_user_id) where recipient_user_id is not null
  do update set read_at = case when p_read then now() else null end, updated_at = now();

  for role_code in select unnest(public.stage8_current_user_roles()) loop
    update public.operational_alert_recipients
    set read_at = case when p_read then coalesce(read_at, now()) else null end,
        updated_at = now()
    where alert_id = p_alert_id and recipient_role_code = role_code;
  end loop;

  insert into public.operational_alert_events (alert_id, event_type, actor_user_id)
  values (p_alert_id, case when p_read then 'read' else 'unread' end, auth.uid());
  return p_alert_id;
end;
$$;

create or replace function public.acknowledge_operational_alert(p_alert_id uuid, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  alert_row public.operational_alerts;
begin
  select * into alert_row from public.operational_alerts where id = p_alert_id for update;
  if alert_row.id is null then raise exception 'Alert not found'; end if;
  if public.has_role('auditor_read_only') or not public.has_permission('alerts.acknowledge') or not public.stage8_user_can_view_alert(alert_row.id, alert_row.alert_type, alert_row.assigned_user_id, alert_row.assigned_role) then
    raise exception 'You do not have permission to acknowledge this alert';
  end if;
  if alert_row.status = 'resolved' then return p_alert_id; end if;

  update public.operational_alerts
  set status = 'acknowledged',
      acknowledged_by = auth.uid(),
      acknowledged_at = now(),
      updated_at = now()
  where id = p_alert_id;

  perform public.mark_operational_alert_read(p_alert_id, true);
  insert into public.operational_alert_events (alert_id, event_type, actor_user_id, reason)
  values (p_alert_id, 'acknowledged', auth.uid(), nullif(trim(p_reason), ''));
  return p_alert_id;
end;
$$;

create or replace function public.snooze_operational_alert(p_alert_id uuid, p_snoozed_until timestamptz, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  alert_row public.operational_alerts;
begin
  select * into alert_row from public.operational_alerts where id = p_alert_id for update;
  if alert_row.id is null then raise exception 'Alert not found'; end if;
  if public.has_role('auditor_read_only') or p_snoozed_until is null or p_snoozed_until <= now() then
    raise exception 'A future snooze time is required';
  end if;
  if not (public.stage8_can_manage_alert_type(alert_row.alert_type) or public.stage8_user_can_view_alert(alert_row.id, alert_row.alert_type, alert_row.assigned_user_id, alert_row.assigned_role)) then
    raise exception 'You do not have permission to snooze this alert';
  end if;

  insert into public.operational_alert_recipients (alert_id, recipient_user_id, snoozed_until, read_at)
  values (p_alert_id, auth.uid(), p_snoozed_until, now())
  on conflict (alert_id, recipient_user_id) where recipient_user_id is not null
  do update set snoozed_until = p_snoozed_until, read_at = coalesce(operational_alert_recipients.read_at, now()), updated_at = now();

  update public.operational_alerts
  set status = case when priority = 'critical' then status else 'snoozed' end,
      due_at = least(coalesce(due_at, p_snoozed_until), p_snoozed_until),
      updated_at = now()
  where id = p_alert_id and status <> 'resolved';

  insert into public.operational_alert_events (alert_id, event_type, actor_user_id, reason, after_snapshot)
  values (p_alert_id, 'snoozed', auth.uid(), nullif(trim(p_reason), ''), jsonb_build_object('snoozed_until', p_snoozed_until));
  return p_alert_id;
end;
$$;

create or replace function public.resolve_operational_alert(p_alert_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  alert_row public.operational_alerts;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'A resolution reason is required'; end if;
  select * into alert_row from public.operational_alerts where id = p_alert_id for update;
  if alert_row.id is null then raise exception 'Alert not found'; end if;
  if public.has_role('auditor_read_only') or not public.stage8_can_manage_alert_type(alert_row.alert_type) then
    raise exception 'You do not have permission to resolve this alert';
  end if;
  if alert_row.priority = 'critical' and not (public.has_role('director_admin') or public.stage8_can_manage_alert_type(alert_row.alert_type)) then
    raise exception 'Critical alerts require an authorized manager resolution';
  end if;

  update public.operational_alerts
  set status = 'resolved',
      resolved_by = auth.uid(),
      resolved_at = now(),
      resolution_reason = trim(p_reason),
      updated_at = now()
  where id = p_alert_id;

  insert into public.operational_alert_events (alert_id, event_type, actor_user_id, reason)
  values (p_alert_id, 'resolved', auth.uid(), trim(p_reason));
  return p_alert_id;
end;
$$;

create or replace function public.reopen_operational_alert(p_alert_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  alert_row public.operational_alerts;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'A reopen reason is required'; end if;
  select * into alert_row from public.operational_alerts where id = p_alert_id for update;
  if alert_row.id is null then raise exception 'Alert not found'; end if;
  if public.has_role('auditor_read_only') or not public.stage8_can_manage_alert_type(alert_row.alert_type) then
    raise exception 'You do not have permission to reopen this alert';
  end if;

  update public.operational_alerts
  set status = 'open',
      resolved_by = null,
      resolved_at = null,
      resolution_reason = null,
      updated_at = now()
  where id = p_alert_id;

  insert into public.operational_alert_events (alert_id, event_type, actor_user_id, reason)
  values (p_alert_id, 'reopened', auth.uid(), trim(p_reason));
  return p_alert_id;
end;
$$;

create or replace function public.assign_operational_alert(p_alert_id uuid, p_assigned_role text, p_assigned_user_id uuid default null, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  alert_row public.operational_alerts;
begin
  select * into alert_row from public.operational_alerts where id = p_alert_id for update;
  if alert_row.id is null then raise exception 'Alert not found'; end if;
  if public.has_role('auditor_read_only') or not public.stage8_can_manage_alert_type(alert_row.alert_type) then
    raise exception 'You do not have permission to assign this alert';
  end if;
  if p_assigned_role is not null and not exists (select 1 from public.roles where code = p_assigned_role and code <> 'retailer_user') then
    raise exception 'Assigned role must be an internal GoodLivin role';
  end if;

  update public.operational_alerts
  set assigned_role = p_assigned_role,
      assigned_user_id = p_assigned_user_id,
      updated_at = now()
  where id = p_alert_id;

  if p_assigned_role is not null then
    insert into public.operational_alert_recipients (alert_id, recipient_role_code)
    values (p_alert_id, p_assigned_role)
    on conflict do nothing;
  end if;
  if p_assigned_user_id is not null then
    insert into public.operational_alert_recipients (alert_id, recipient_user_id)
    values (p_alert_id, p_assigned_user_id)
    on conflict do nothing;
  end if;

  insert into public.operational_alert_events (alert_id, event_type, actor_user_id, reason, after_snapshot)
  values (p_alert_id, 'assigned', auth.uid(), nullif(trim(p_reason), ''), jsonb_build_object('assigned_role', p_assigned_role, 'assigned_user_id', p_assigned_user_id));
  return p_alert_id;
end;
$$;

create or replace function public.save_operational_alert_rule(
  p_rule_id uuid,
  p_enabled boolean,
  p_priority text,
  p_minimum_stock_level integer default null,
  p_target_stock_level integer default null,
  p_reorder_point integer default null,
  p_expiry_warning_days integer default null,
  p_minimum_shelf_life_days integer default null,
  p_retailer_sales_report_overdue_days integer default null,
  p_supplier_order_reminder_days integer default null,
  p_purchase_order_payment_reminder_days integer default null,
  p_recipient_roles text[] default array['director_admin']::text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  before_row jsonb;
  rule_id uuid;
begin
  if public.has_role('auditor_read_only') or not public.has_permission('alerts.rules.manage') then
    raise exception 'You do not have permission to manage alert rules';
  end if;
  if p_priority not in ('informational','low','medium','high','critical') then raise exception 'Invalid priority'; end if;
  perform public.stage8_assert_rule_roles(p_recipient_roles);

  select to_jsonb(r), r.id into before_row, rule_id
  from public.operational_alert_rules r
  where r.id = p_rule_id
  for update;
  if rule_id is null then raise exception 'Alert rule not found'; end if;

  update public.operational_alert_rules
  set enabled = p_enabled,
      priority = p_priority,
      minimum_stock_level = p_minimum_stock_level,
      target_stock_level = p_target_stock_level,
      reorder_point = p_reorder_point,
      expiry_warning_days = p_expiry_warning_days,
      minimum_shelf_life_days = p_minimum_shelf_life_days,
      retailer_sales_report_overdue_days = p_retailer_sales_report_overdue_days,
      supplier_order_reminder_days = p_supplier_order_reminder_days,
      purchase_order_payment_reminder_days = p_purchase_order_payment_reminder_days,
      recipient_roles = p_recipient_roles,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_rule_id;

  insert into public.operational_alert_events (alert_id, event_type, actor_user_id, reason, before_snapshot, after_snapshot)
  values (
    coalesce((select id from public.operational_alerts where alert_type = (select alert_type from public.operational_alert_rules where id = p_rule_id) order by created_at desc limit 1), null),
    'rule_updated',
    auth.uid(),
    'Alert rule updated',
    before_row,
    (select to_jsonb(r) from public.operational_alert_rules r where r.id = p_rule_id)
  );
  perform public.write_audit_log('operational_alert_rules', p_rule_id, 'rule_updated', before_row, (select to_jsonb(r) from public.operational_alert_rules r where r.id = p_rule_id), 'Alert rule updated');
  return p_rule_id;
end;
$$;

create or replace view public.operational_approval_inbox with (security_invoker = true) as
select
  ar.id,
  'approval_record'::text as request_type,
  ar.record_type,
  ar.record_id,
  ar.requested_by,
  ar.created_at as submitted_at,
  ar.status::text as approval_status,
  ('Step ' || ar.approval_step || ' approval pending')::text as reason,
  null::numeric as financial_impact,
  null::integer as stock_impact_quantity,
  ar.record_type as related_table,
  ar.record_id as related_record_id
from public.approval_records ar
where ar.status = 'pending'
union all
select
  po.id,
  'purchase_order_approval'::text as request_type,
  'purchase_orders'::text as record_type,
  po.id as record_id,
  po.created_by as requested_by,
  po.created_at as submitted_at,
  po.status::text as approval_status,
  ('Purchase order ' || po.po_number || ' awaiting Director/Admin approval')::text as reason,
  po.total_amount as financial_impact,
  null::integer as stock_impact_quantity,
  'purchase_orders'::text as related_table,
  po.id as related_record_id
from public.purchase_orders po
where po.status = 'pending_approval'
union all
select
  sa.id,
  'inventory_adjustment_review'::text as request_type,
  'stock_adjustments'::text as record_type,
  sa.id as record_id,
  sa.created_by as requested_by,
  sa.created_at as submitted_at,
  sa.status::text as approval_status,
  sa.reason,
  sa.total_cost as financial_impact,
  case when sa.direction = 'in' then sa.quantity else -sa.quantity end as stock_impact_quantity,
  'stock_adjustments'::text as related_table,
  sa.id as related_record_id
from public.stock_adjustments sa
where sa.status = 'pending'
union all
select
  st.id,
  'stock_transfer_review'::text as request_type,
  'stock_transfers'::text as record_type,
  st.id as record_id,
  st.created_by as requested_by,
  st.created_at as submitted_at,
  st.status::text as approval_status,
  coalesce(st.notes, 'Draft transfer awaiting dispatch review')::text as reason,
  null::numeric as financial_impact,
  st.quantity as stock_impact_quantity,
  'stock_transfers'::text as related_table,
  st.id as related_record_id
from public.stock_transfers st
where st.status = 'draft';

do $$
declare table_name text;
begin
  foreach table_name in array array['operational_alert_rules','operational_alerts','operational_alert_recipients'] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
  foreach table_name in array array['operational_alert_rules','operational_alerts','operational_alert_recipients','operational_alert_events','alert_automation_runs','notification_delivery_queue'] loop
    execute format('drop trigger if exists %I_audit on public.%I', table_name, table_name);
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row_change()', table_name, table_name);
  end loop;
end $$;

alter table public.operational_alert_rules enable row level security;
alter table public.operational_alerts enable row level security;
alter table public.operational_alert_recipients enable row level security;
alter table public.operational_alert_events enable row level security;
alter table public.alert_automation_runs enable row level security;
alter table public.notification_delivery_queue enable row level security;

revoke all on public.operational_alert_rules, public.operational_alerts, public.operational_alert_recipients, public.operational_alert_events, public.alert_automation_runs, public.notification_delivery_queue from anon, authenticated;
grant select on public.operational_alert_rules, public.operational_alerts, public.operational_alert_recipients, public.operational_alert_events, public.alert_automation_runs, public.notification_delivery_queue to authenticated;
grant select on public.approval_records to authenticated;
grant select on public.operational_approval_inbox to authenticated;

drop policy if exists operational_alert_rules_read on public.operational_alert_rules;
create policy operational_alert_rules_read on public.operational_alert_rules
for select to authenticated
using (public.has_permission('alerts.view') and not public.has_role('retailer_user'));

drop policy if exists operational_alerts_read on public.operational_alerts;
create policy operational_alerts_read on public.operational_alerts
for select to authenticated
using (public.stage8_user_can_view_alert(id, alert_type, assigned_user_id, assigned_role));

drop policy if exists operational_alert_recipients_read on public.operational_alert_recipients;
create policy operational_alert_recipients_read on public.operational_alert_recipients
for select to authenticated
using (
  public.has_permission('alerts.view')
  and not public.has_role('retailer_user')
  and (
    recipient_user_id = auth.uid()
    or recipient_role_code = any(public.stage8_current_user_roles())
    or public.has_role('director_admin')
    or public.has_role('auditor_read_only')
    or exists (
      select 1 from public.operational_alerts a
      where a.id = alert_id and public.stage8_can_manage_alert_type(a.alert_type)
    )
  )
);

drop policy if exists operational_alert_events_read on public.operational_alert_events;
create policy operational_alert_events_read on public.operational_alert_events
for select to authenticated
using (
  exists (
    select 1 from public.operational_alerts a
    where a.id = alert_id and public.stage8_user_can_view_alert(a.id, a.alert_type, a.assigned_user_id, a.assigned_role)
  )
);

drop policy if exists alert_automation_runs_read on public.alert_automation_runs;
create policy alert_automation_runs_read on public.alert_automation_runs
for select to authenticated
using (public.has_role('director_admin') or public.has_role('auditor_read_only') or public.has_permission('alerts.run'));

drop policy if exists notification_delivery_queue_read on public.notification_delivery_queue;
create policy notification_delivery_queue_read on public.notification_delivery_queue
for select to authenticated
using (
  public.has_role('director_admin')
  or public.has_role('auditor_read_only')
  or exists (
    select 1 from public.operational_alerts a
    where a.id = alert_id and public.stage8_user_can_view_alert(a.id, a.alert_type, a.assigned_user_id, a.assigned_role)
  )
);

grant execute on function public.stage8_run_operational_alert_check(text) to authenticated;
grant execute on function public.mark_operational_alert_read(uuid, boolean) to authenticated;
grant execute on function public.acknowledge_operational_alert(uuid, text) to authenticated;
grant execute on function public.snooze_operational_alert(uuid, timestamptz, text) to authenticated;
grant execute on function public.resolve_operational_alert(uuid, text) to authenticated;
grant execute on function public.reopen_operational_alert(uuid, text) to authenticated;
grant execute on function public.assign_operational_alert(uuid, text, uuid, text) to authenticated;
grant execute on function public.save_operational_alert_rule(uuid, boolean, text, integer, integer, integer, integer, integer, integer, integer, integer, text[]) to authenticated;

comment on table public.operational_alerts is 'Stage 8 operational alert centre. Alerts are advisory and never alter immutable ledger records.';
comment on table public.operational_alert_rules is 'Configurable Stage 8 alert thresholds and recipients. Rerunnable defaults do not overwrite existing rule settings.';
comment on table public.alert_automation_runs is 'Server-side alert evaluation history, including created, updated and resolved counts.';
comment on table public.notification_delivery_queue is 'Future external notification interface. Stage 8 uses in-app alerts only; external providers are intentionally deferred.';
comment on function public.stage8_run_operational_alert_check(text) is 'Idempotent Stage 8 alert evaluator. It creates, updates or resolves alerts only; it does not post stock, approve workflows, send orders or record payments.';

commit;

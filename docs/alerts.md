# Stage 8 alerts, notifications and automation

Stage 8 adds a central in-app alert centre for GoodLivin operational signals. Alerts are advisory workflow records: they never post stock, approve purchase orders, create transfers, record payments, dispose inventory, send supplier orders, or alter immutable ledger history.

## Manual migration

Run this migration in Supabase SQL Editor after all Stage 1–7 migrations:

```text
supabase/migrations/202608030011_stage8_alerts_notifications_automation.sql
```

The migration is safe to rerun. It creates default alert rules only when they do not already exist, so customized rule settings are preserved.

## What Stage 8 monitors

- Low and out-of-stock warehouse stock.
- Retailer replenishment targets from the existing replenishment calculations.
- Expiry, expired stock and FEFO-related quality action signals.
- Quarantined, rejected, recalled, damaged and expired stock requiring review.
- Retailer sales reports that are overdue based on GoodLivin-entered information.
- Purchase orders awaiting approval, approved but not sent, near delivery, overdue, partially received, or payment-due.
- Pending stock adjustments, draft transfer reviews, retailer reconciliation discrepancies and existing approval records.

## Permissions

- Director/Admin: full alert, rules, assignment, automation and approval-inbox access.
- Inventory Manager: inventory, batch, expiry, receiving, transfer and replenishment alerts.
- Sales Manager: retailer reporting, sales-facing and replenishment alerts.
- Finance Team: payment and financial alerts.
- Warehouse Staff: view and acknowledge assigned operational alerts.
- Auditor: read-only alert and automation visibility.
- Retailer accounts remain disabled for Stage 8 alert management.

Supabase Row Level Security enforces these scopes, and the UI mirrors them.

## Running alert checks

Authorized users can manually run checks from:

```text
/notifications/automation
```

Each run records:

- automation name;
- trigger source;
- start and completion times;
- result status;
- records checked;
- alerts created, updated and resolved;
- errors and retry count.

The evaluator is idempotent. Repeated runs update unresolved alerts instead of creating duplicates and auto-resolve alerts only when the underlying condition no longer appears.

## Scheduling after deployment

Stage 8 prepares a secure Vercel Cron-compatible endpoint:

```text
GET /api/alerts/evaluate
```

Required hosting environment variables:

```env
CRON_SECRET=replace-with-a-long-random-secret
SUPABASE_SERVICE_ROLE_KEY=keep-this-server-side-only
```

Vercel Cron sends the configured `CRON_SECRET` automatically as:

```text
Authorization: Bearer <CRON_SECRET>
```

The repository includes `vercel.json` with a production cron schedule that calls the endpoint every six hours:

```json
{
  "path": "/api/alerts/evaluate",
  "schedule": "0 */6 * * *"
}
```

The endpoint still accepts the older `POST /api/alerts/evaluate` plus `x-goodlivin-alert-secret` flow when `STAGE8_ALERT_JOB_SECRET` is configured, but Vercel production deployments should use `CRON_SECRET`. Do not expose the service-role key or cron secret in the browser or commit either value.

## External notifications

Stage 8 does not connect email, SMS, WhatsApp or third-party providers. The database includes a `notification_delivery_queue` table as a clean future interface, but all working notifications remain inside the application.

# Foundation architecture

## Inventory ledger

`public.stock_movements` is the source of truth. A movement has a product, batch, positive whole-unit quantity, and at least one location. Receipts write a destination; issues write a source; transfers write both source and destination in the same immutable transaction record.

`public.stock_balances` is a security-invoker view that calculates balances by unioning destination quantities as positive and source quantities as negative. It is not an editable balance table.

Posted movements are protected by a trigger. Corrections must be represented by a new reversal or adjustment row, preserving the original record and its audit history. The posting trigger validates that a batch belongs to the movement’s product and checks source availability. A Director/Admin override is accepted only with a written reason.

## Stage 3 batch and expiry tracking

`product_batches` is linked to one product and one sellable SKU, with manufacturer/supplier references, receipt/manufacturing/expiry dates, initial quantity, cost, quality status, supporting attachment, and archive-only status. The Stage 3 migration adds relationship triggers, validation constraints, traceability correction protection, and indexes ordered for expiry review.

`src/lib/batches.ts` is the batch/expiry read service. It calculates expiry buckets, shelf-life checks, and FEFO-ready ranking without posting stock. `src/app/(app)/batch-actions.ts` validates server mutations and revalidates batch, notification, and dashboard routes. Expiry alerts are derived in-app from configurable `expiry_notification_settings`; no external notification integration is enabled.

Future allocation services should query active, approved, non-expired batches ordered by `expires_on asc, created_at asc`, while respecting the stock balance view. Stock receiving, movement posting, transfers, allocations, and retailer stock calculations remain Stage 4.

## Authentication and authorization

Supabase Auth owns credentials and sessions. `profiles` stores application identity and retailer scope. `user_roles` assigns one or more catalog roles. Permissions are data-driven through `role_permissions` and checked in RLS helper functions.

The application uses server-side session checks for route protection and server actions. RLS remains authoritative for direct data access. No browser code receives the service-role key.

## Auditability

Important foundation tables have an audit trigger that records actor, action, record, snapshots, and timestamp. Role assignment uses the same audit writer. Sensitive reasons are stored on the originating record or audit log rather than inferred from UI state.

## Data lifecycle

Transactional records are not hard-deleted. Posted ledger records and finalized approvals are immutable. Master records support `archived` status and `archived_at`, allowing historical references to remain valid.

## Service boundaries

UI components handle presentation and interaction. `src/lib` handles configuration, session resolution, formatting, and read queries. Server actions validate inputs with Zod and call database functions or RLS-protected queries. Later modules should add domain services under `src/lib/services` rather than embedding workflows inside pages.

## Stage 2 master data

`src/lib/master-data.ts` is the read service for products, sellable SKUs, manufacturers, suppliers, locations, retailers, branches, and commercial agreements. The corresponding server actions validate input with Zod, enforce the role boundary before writing, and use the authenticated Supabase session so RLS remains authoritative. Master records are never hard-deleted: archive actions set `status = 'archived'` and `archived_at`, which is captured by the existing audit triggers.

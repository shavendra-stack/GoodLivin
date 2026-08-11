# Roadmap

## Stage 1 — completed foundation

- Application shell and responsive navigation
- Supabase Auth integration and protected routes
- Role catalog, permission matrix, user management, and role assignment
- Foundation schema, RLS, audit triggers, immutable ledger rules, and demo seed data
- Reusable UI primitives and verification scripts

## Stage 2 — master data (completed)

- Product/SKU master data screens
- Manufacturer and supplier reference data screens
- Inventory-location master data, including retailer-branch relationships
- Retailer and branch management
- Internal wholesale and consignment commercial agreements
- Archive-only lifecycle for master records, with audit logging and RLS

## Stage 3 — batches and expiry (completed)

- Batch creation and expiry monitoring
- Product/SKU-linked batch traceability, quality status, and archive-only lifecycle
- Expiry thresholds, in-app notifications, and batch detail history
- Shelf-life checks and FEFO-ready ranking for later allocation
- Audit logging and role-aware batch access through RLS

## Stage 4 — inventory operations

- Stock receiving and ledger entry workflow
- Transfers, FEFO allocation posting, and stock balances
- Warehouse and retailer branch stock views
- Stock-count sessions and controlled variance posting

## Stage 5 — approvals and replenishment

- Free-product request workflows and approval chains
- Replenishment plans and retailer requests
- Returns, damages, and wastage workflows
- Notifications and exception alerts

## Stage 6 — production and finance

- Production orders and material consumption
- Commercial agreement management
- Cost and margin reporting
- Exportable operational and financial reports

Stage 2 or later must be separately approved before implementation begins.

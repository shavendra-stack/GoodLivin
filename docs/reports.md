# GoodLivin Stage 7 reporting definitions

Stage 7 reports are read-only and derive figures from the authenticated user’s visible Stage 1–6 records. Supabase RLS remains authoritative.

## Shared definitions

- Physical stock: posted immutable ledger movements, summed into current on-hand stock.
- Available stock: physical stock where the batch is approved, non-expired, and not stored as damaged, quarantined, rejected or expired stock.
- Incoming stock: outstanding quantities on approved/open purchase orders. Incoming stock is not available stock.
- Projected stock: physical stock plus incoming stock, labelled for planning only.
- Net sales: fulfilled sales value minus refunded sales value. Pending and cancelled sales are excluded.
- Retailer sell-through: posted retailer-reported units sold divided by delivered retailer branch stock.
- Average sales rate: Stage 5 replenishment view average daily sales where available.
- Reorder quantity: target stock minus current branch stock from the replenishment model.
- Stock valuation: batch unit cost, then batch purchase cost, then weighted movement cost, then SKU cost per unit. Missing costs stay missing and are not treated as zero.
- Wastage value: affected stock quantity multiplied by the available cost basis. Missing cost rows are warned.

## Security notes

- Financial values are visible to Director/Admin, Finance Team and Auditor roles only.
- Warehouse Staff can view operational stock, expiry, traceability and purchasing status without restricted financial values.
- Sales Manager can view sales, retailer performance and related traceability without stock valuation or supplier payment details.
- CSV exports are generated through the authenticated server session and use CSV formula-injection protection.
- The Stage 7 SQL migration adds a report-export audit helper; it does not alter historical inventory, sales or procurement records.

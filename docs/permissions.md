# Role and permissions matrix

The UI hides navigation that is irrelevant to a role, but this is only a usability feature. Every read/write boundary is also protected by Supabase RLS and database triggers.

| Area | Director/Admin | Inventory Manager | Warehouse Staff | Finance Team | Sales Manager | Retailer User | Auditor |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard | View | View | View | View | View | View | View |
| Products/SKUs | View, create, edit, archive | View, manage | View | View | View | View | View |
| Batches/expiry | Full | Full | Enter permitted fields | View | Approved quality only | — | View |
| Inventory ledger | View, create, post, override | View, create, post | View, create drafts | — | — | Scoped view | Read-only view |
| Retailers/branches | Full | — | — | — | View, manage | Assigned retailer | Read-only view |
| Commercial agreements | Full | — | — | View, manage | View, manage | Assigned scope only | Read-only view |
| Free-product requests | Full, approve | — | — | — | View, create | View, create in scope | Read-only view |
| Replenishment | Full | View, manage | — | — | View | Scoped view | Read-only view |
| Production | Full | — | — | — | — | — | Read-only view |
| Stock counts | Full, post | View, create, post | View, create | — | — | Scoped view | Read-only view |
| Reports/exports | Full | View | — | View, export | — | — | View, export |
| Notifications | View | View | View | View | View | View | View |
| Users and roles | Full | — | — | — | — | — | — |
| Audit logs | Full | — | — | — | — | — | View |

## Security notes

- Retailer users are scoped through `profiles.retailer_id`; branch access is derived from the branch’s retailer.
- Retailer and branch master data is managed internally; Stage 2 does not create retailer logins.
- Products, SKUs, manufacturers, suppliers, locations, retailers, branches, and agreements are archive-only master data. Authenticated users have no delete privilege or delete RLS policy for these tables.
- Retailer-branch inventory locations are validated by a database trigger against the selected retailer and branch.
- Warehouse Staff has no financial permissions.
- Batch creation and updates are role-aware: Director/Admin and Inventory Manager manage all batch fields; Warehouse Staff can enter only permitted operational fields; Finance Team can view batch cost data; Sales Manager can read approved batches only; Auditor is read-only.
- Batch product/SKU relationships, active-reference rules, date/quantity/cost/quality validation, and correction reasons after movements are enforced by database triggers and constraints.
- Expiry thresholds are stored in `expiry_notification_settings`; the application derives in-app expiry alerts and does not send external notifications.
- Auditor permissions are read-only; there are no write policies for that role.
- Posted stock movements cannot be updated or deleted by any role.
- Final approval records cannot be modified after approval or rejection.
- Negative stock requires the Director/Admin role and a written `override_reason`.
- Role changes go through `public.set_user_role`, which replaces the existing assignment and creates an audit record.

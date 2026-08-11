# GoodLivin Inventory

GoodLivin’s inventory, batch-management, operational reporting and alerting workspace.

The application includes Supabase authentication, role-based navigation, user and role administration, master-data management, batch and expiry tracking, stock receiving/movements/transfers/adjustments, sales and retailer sell-through workflows, purchase orders/inbound planning, Stage 7 dashboards/reports, and Stage 8 in-app alerts/automation history. The immutable stock-ledger foundation, Row Level Security policies, and audit logging remain in place.

## Stack

- Next.js App Router and TypeScript
- Tailwind CSS with accessible, reusable UI primitives
- Supabase PostgreSQL, Auth, Row Level Security, and Storage-ready attachments
- Zod-backed server-action validation
- Vitest for lightweight unit checks

## Local setup

1. Use Node.js 20.9+ and pnpm 11 (or the package manager available in your environment).
2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Copy `.env.example` to `.env.local`.
4. For a local UI walkthrough without Supabase credentials, set:

   ```env
   NEXT_PUBLIC_DEMO_MODE=true
   ```

   Demo mode is intentionally labelled and read-only. It is not an authentication substitute.

5. Start the app:

   ```bash
   pnpm dev
   ```

6. Open [http://localhost:3000](http://localhost:3000).

## Supabase setup

See [`docs/supabase-setup.md`](docs/supabase-setup.md) for project configuration, migration, seed, Auth user creation, Storage, and verification steps.

Apply migrations in filename order. The latest Stage 8 migration is [`supabase/migrations/202608030011_stage8_alerts_notifications_automation.sql`](supabase/migrations/202608030011_stage8_alerts_notifications_automation.sql). The demo data is [`supabase/seed.sql`](supabase/seed.sql).

Do not commit `.env.local`, Supabase service-role keys, database passwords, or any other private credentials.

## Deployment guide

See [`docs/deployment.md`](docs/deployment.md) for:

- Connecting the Git repository to Vercel
- Vercel build and framework settings
- Required environment variables
- Adding the Vercel production URL to Supabase authentication redirect URLs
- Custom domain and SSL
- Vercel Cron configuration for Stage 8 alerts
- Post-deployment testing

## Useful commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Architecture

The application uses a small service boundary under `src/lib`:

- `src/lib/supabase` owns browser and server Supabase clients.
- `src/lib/auth.ts` resolves the current session and profile/role context.
- `src/lib/data.ts` owns read queries used by Stage 1 admin pages and provides the explicit demo dataset.
- `src/lib/reports.ts` owns the Stage 7 report calculations, permission masks and CSV export formatting.
- `src/lib/alerts.ts` owns the Stage 8 alert workspace, unread-count calculation, permission helpers and approval-inbox mapping.
- Server actions validate input and call security-definer database functions rather than using a service-role key in the browser.
- UI components are kept in `src/components` and do not contain database business logic.

The stock movement ledger is the source of truth. Posted movements are immutable; corrections are represented by new reversal or adjustment records. The balance view derives quantity by adding destination entries and subtracting source entries. Stage 7 reports read from these authoritative records and never make incoming purchase-order quantities available stock.

Read [`docs/permissions.md`](docs/permissions.md) for the role matrix, [`docs/architecture.md`](docs/architecture.md) for database rules and security decisions, [`docs/reports.md`](docs/reports.md) for Stage 7 report definitions, and [`docs/alerts.md`](docs/alerts.md) for Stage 8 alert automation and scheduling notes.

## Stage 8 boundaries

Stage 8 alert automation is advisory-only. It does not modify historical ledger entries, auto-create purchase orders or transfers, approve workflows, send supplier orders, record payments, connect paid external notification providers, deploy the application, or create retailer logins.

## Roadmap

See [`docs/roadmap.md`](docs/roadmap.md). Stage 9 must be explicitly approved before implementation begins.

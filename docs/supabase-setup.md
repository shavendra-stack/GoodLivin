# Supabase setup

## 1. Create the project

Create a Supabase project in the Sri Lankan/nearest available region and copy the project URL and anonymous key into `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
NEXT_PUBLIC_DEMO_MODE=false
```

For older Supabase projects, the application also accepts
`NEXT_PUBLIC_SUPABASE_ANON_KEY` as a legacy fallback.

The service-role key is optional and server-only. Normal sign-in and role assignment do not require it; the Admin → User management invite form does require it so the server can call Supabase’s Auth Admin invite API. Never expose this key to the browser.

## 2. Apply the database foundation

Run the migration in the Supabase SQL Editor or through the Supabase CLI:

```bash
supabase db push
```

The migration creates the foundation tables, role and permission catalog, constraints, triggers, audit logging, stock balance view, RLS policies, and the admin-only `set_user_role` function.

For Stage 2, apply [`supabase/migrations/202608020005_stage2_master_data.sql`](../supabase/migrations/202608020005_stage2_master_data.sql) after the foundation and corrective migrations. It adds product/SKU fields, retailer addresses, commercial agreement terms, the full location-type vocabulary, archive-only write boundaries, authenticated table grants, and retailer-branch relationship validation. The migration is safe to re-run.

For Stage 3, apply [`supabase/migrations/202608020007_stage3_batches_expiry.sql`](../supabase/migrations/202608020007_stage3_batches_expiry.sql) after the Stage 2 corrective migration. It links every batch to a sellable SKU, adds traceability, quality, expiry, shelf-life and archive protections, configures expiry thresholds, and adds role-aware RLS. The migration is safe to re-run, but existing batches with no SKU must be linked before the `sku_id` requirement can be applied.

If the Supabase CLI is not connected, copy the complete contents of the Stage 3 migration file into a new SQL Editor query and run it. Then paste [`supabase/seed.sql`](../supabase/seed.sql) to load the deterministic demo batch rows. No credentials are required.

## 3. Seed demo master data

Run:

```bash
supabase db seed
```

Or paste [`supabase/seed.sql`](../supabase/seed.sql) into the SQL Editor. The seed is safe to re-run because records use stable demo UUIDs and conflict-safe inserts.

## 4. Create the first user

Create a user in Supabase Authentication, then run the following SQL with the real Auth user UUID and email. Do not put the UUID in source control if it identifies a real person.

```sql
insert into public.profiles (user_id, email, display_name)
values ('AUTH-USER-UUID', 'director@goodlivin.lk', 'GoodLivin Director')
on conflict (user_id) do update set email = excluded.email, display_name = excluded.display_name;

insert into public.user_roles (user_id, role_code)
values ('AUTH-USER-UUID', 'director_admin')
on conflict (user_id, role_code) do nothing;
```

The role catalog is seeded by the migration. A Director/Admin can then assign one role to another user from Settings → User management. The role assignment calls an audited security-definer function and does not expose the service-role key.

## 5. Storage

Create a private Storage bucket named `goodlivin-attachments`. Attachment metadata is stored in `public.attachments`; access policies should be added to Storage objects before the attachment upload workflow is enabled in a later stage.

## 6. Time and money conventions

- Store timestamps as `timestamptz` in UTC.
- Display timestamps in `Asia/Colombo`.
- Store monetary values as `numeric(14,2)` with `LKR` currency checks.
- Store quantities as positive whole integers; movement direction is represented by source and destination locations.

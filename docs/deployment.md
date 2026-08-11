# Production deployment guide

This guide prepares the existing GoodLivin Inventory application for Vercel while continuing to use the current Supabase project as the backend. Do not commit real credentials. Keep `.env.local`, service-role keys and cron secrets out of source control.

## 1. Connect the Git repository to Vercel

1. Push the application source to a private GitHub, GitLab or Bitbucket repository.
2. In Vercel, choose **Add New → Project** and import that repository.
3. Keep the project root set to the repository root unless the repository is later converted into a monorepo.
4. Deploy from the production branch you intend to use for GoodLivin.

## 2. Vercel build and framework settings

Use the checked-in `vercel.json` settings:

```json
{
  "framework": "nextjs",
  "installCommand": "pnpm install --frozen-lockfile",
  "buildCommand": "pnpm build"
}
```

In Vercel project settings, confirm:

- Framework preset: **Next.js**
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build`
- Output directory: leave as Vercel’s Next.js default
- Node.js version: 20.x or newer
- Root directory: repository root

## 3. Required environment variables

Add these in Vercel **Project Settings → Environment Variables** for Production. Add the same values to Preview only if preview deployments should connect to the live Supabase backend.

Client-safe public variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
NEXT_PUBLIC_SITE_URL=https://your-production-domain.example
NEXT_PUBLIC_DEMO_MODE=false
```

Server-only variables:

```env
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
CRON_SECRET=your-long-random-cron-secret
```

Notes:

- Never prefix service-role keys or cron secrets with `NEXT_PUBLIC_`.
- `SUPABASE_SERVICE_ROLE_KEY` is required for the Stage 8 scheduled evaluator and Director/Admin invite flow.
- `CRON_SECRET` is required for Vercel Cron to call `/api/alerts/evaluate`.
- `NEXT_PUBLIC_SITE_URL` should be the final production URL, including `https://`.

## 4. Add the Vercel production URL to Supabase authentication redirect URLs

In Supabase, open **Authentication → URL Configuration**.

Set:

```text
Site URL: https://your-production-domain.example
```

Add redirect URLs:

```text
https://your-production-domain.example/**
https://your-vercel-project.vercel.app/**
http://localhost:3000/**
```

For Vercel preview deployments, add the preview wildcard only if previews need Auth:

```text
https://*-<team-or-account-slug>.vercel.app/**
```

Use exact production URLs where possible.

## 5. Custom domain and SSL

1. In Vercel, open **Project → Settings → Domains**.
2. Add the production custom domain.
3. Follow Vercel’s DNS instructions for the domain registrar.
4. Wait for Vercel to issue SSL.
5. After SSL is active, update `NEXT_PUBLIC_SITE_URL` and the Supabase Site URL/redirect URLs to the custom `https://` domain.

## 6. Vercel Cron configuration for Stage 8 alerts

The repository includes this cron configuration in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/alerts/evaluate",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

This runs the Stage 8 alert evaluator every six hours on the production deployment. Vercel invokes the endpoint with:

```text
GET /api/alerts/evaluate
Authorization: Bearer <CRON_SECRET>
```

The endpoint verifies the secret server-side, uses the Supabase service-role key only on the server, calls `stage8_run_operational_alert_check('scheduled')`, and returns a non-2xx response if the evaluator records a failed automation run.

## 7. Post-deployment testing

After the first production deployment:

1. Open the production URL and confirm unauthenticated users are sent to `/login`.
2. Sign in as a Director/Admin user.
3. Confirm `/dashboard`, `/inventory`, `/reports/inventory`, `/notifications`, `/notifications/rules`, `/notifications/automation` and `/notifications/approvals` load.
4. Confirm Settings → User Management remains restricted to Director/Admin users.
5. Run a manual alert check from `/notifications/automation`.
6. Confirm the automation history records a successful manual run.
7. In Vercel, open **Project → Settings → Cron Jobs** and confirm `/api/alerts/evaluate` is listed.
8. After the first scheduled run, confirm the automation history shows a `scheduled` run.
9. Check Vercel function logs for `/api/alerts/evaluate`; there should be no unauthorized or Supabase service-role configuration errors.
10. Re-check the main workflows from Stage 1–8 against production Supabase data before handing the system to operational users.

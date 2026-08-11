import Link from "next/link";
import { Bot, Clock3, Play } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getAlertWorkspace } from "@/lib/alerts";
import { formatDateTime } from "@/lib/utils";
import { runAlertCheck } from "@/app/(app)/notifications/actions";
import { DataTable } from "@/components/data-table";
import { EmptyState, InlineMessage } from "@/components/master-data-ui";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SearchParams = Promise<{ saved?: string; error?: string; demo?: string }>;

const tabs = [
  { href: "/notifications", label: "Alert centre" },
  { href: "/notifications/rules", label: "Alert rules" },
  { href: "/notifications/automation", label: "Automation history" },
  { href: "/notifications/approvals", label: "Approval inbox" },
] as const;

function AlertTabs() {
  return (
    <div className="flex gap-2 overflow-x-auto rounded-2xl border border-forest-100/80 bg-white p-1 shadow-soft dark:bg-charcoal-800">
      {tabs.map((tab) => <Link key={tab.href} href={tab.href} className={tab.href === "/notifications/automation" ? "whitespace-nowrap rounded-xl bg-forest-700 px-3 py-2 text-sm font-semibold text-white" : "whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-forest-50 hover:text-forest-800 dark:hover:bg-charcoal-700"}>{tab.label}</Link>)}
    </div>
  );
}

function formatRunErrors(errors: unknown[]) {
  const messages = errors
    .map((error) => {
      if (typeof error === "string") return error;
      if (typeof error === "object" && error && "message" in error) return String((error as { message?: unknown }).message ?? "");
      return "";
    })
    .map((message) => message.trim())
    .filter(Boolean);
  return messages.length > 0 ? messages.join(" ") : "The latest alert check was recorded as failed.";
}

export default async function AlertAutomationPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const workspace = await getAlertWorkspace(user, { status: "all" });
  const canRun = user.roles.some((role) => ["director_admin", "inventory_manager", "sales_manager"].includes(role));
  const latest = workspace.automationRuns[0] ?? null;
  const notice = params.error ? <InlineMessage kind="error">{decodeURIComponent(params.error)}</InlineMessage>
    : params.demo ? <InlineMessage kind="info">Demo mode is read-only; this screen is a preview.</InlineMessage>
      : params.saved ? <InlineMessage>{decodeURIComponent(params.saved)}</InlineMessage>
        : null;

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-forest-600">Stage 8 · Automation</p>
          <h1 className="mt-2 flex items-center gap-3 font-display text-3xl font-bold tracking-tight text-ink"><Bot className="h-8 w-8 text-forest-700" />Automation history</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Run and review idempotent alert checks. Automation can create, update or resolve alerts; it cannot post stock, approve purchase orders, record payments or send external messages.</p>
        </div>
        <form action={runAlertCheck}>
          <Button type="submit" disabled={!canRun}><Play className="h-4 w-4" />Run alert check</Button>
        </form>
      </div>

      <AlertTabs />
      {notice}
      {workspace.error ? <InlineMessage kind="error">{workspace.error}</InlineMessage> : null}
      {latest?.status === "failed" ? <InlineMessage kind="error">Latest alert check failed: {formatRunErrors(latest.errors)}</InlineMessage> : null}
      {!canRun ? <InlineMessage kind="info">Your role can view automation history, but cannot manually run alert checks.</InlineMessage> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card><CardContent className="p-5"><p className="text-sm text-slate-500">Latest status</p><p className="mt-2 font-display text-2xl font-bold text-ink">{latest?.status ?? "—"}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-slate-500">Records checked</p><p className="mt-2 font-display text-3xl font-bold text-ink">{latest?.recordsChecked.toLocaleString() ?? "0"}</p></CardContent></Card>
        <Card className="border-forest-100"><CardContent className="p-5"><p className="text-sm text-slate-500">Created</p><p className="mt-2 font-display text-3xl font-bold text-forest-700">{latest?.alertsCreated.toLocaleString() ?? "0"}</p></CardContent></Card>
        <Card className="border-sky-100"><CardContent className="p-5"><p className="text-sm text-slate-500">Updated</p><p className="mt-2 font-display text-3xl font-bold text-sky-700">{latest?.alertsUpdated.toLocaleString() ?? "0"}</p></CardContent></Card>
        <Card className="border-slate-100"><CardContent className="p-5"><p className="text-sm text-slate-500">Resolved</p><p className="mt-2 font-display text-3xl font-bold text-slate-700 dark:text-slate-200">{latest?.alertsResolved.toLocaleString() ?? "0"}</p></CardContent></Card>
      </div>

      {workspace.automationRuns.length === 0 ? (
        <EmptyState title="No automation runs yet" description="Run the first manual Stage 8 alert check after applying the migration." />
      ) : (
        <DataTable rows={workspace.automationRuns} rowKey={(row) => row.id} columns={[
          { key: "run", header: "Run", render: (row) => <div><p className="font-semibold">{row.automationName}</p><p className="mt-1 text-xs text-slate-500">{formatDateTime(row.startedAt)}</p></div> },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
          { key: "source", header: "Source", render: (row) => <Badge tone="neutral">{row.triggerSource}</Badge> },
          { key: "counts", header: "Counts", render: (row) => <div className="text-xs text-slate-500"><p>{row.recordsChecked.toLocaleString()} checked</p><p className="mt-1">{row.alertsCreated} created · {row.alertsUpdated} updated · {row.alertsResolved} resolved</p></div> },
          { key: "completed", header: "Completed", render: (row) => <span>{formatDateTime(row.completedAt)}</span> },
          { key: "errors", header: "Errors", render: (row) => row.errors.length > 0 ? <Badge tone="danger">{row.errors.length} error(s)</Badge> : <Badge tone="success">None</Badge> },
        ]} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-forest-700" />Scheduling preparation</CardTitle>
          <CardDescription>The app includes a secure scheduled endpoint for future hosting. It requires a job secret and service-role key in the hosting environment; no external provider is connected in Stage 8.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-forest-100 bg-forest-50 p-4 dark:bg-charcoal-700">
            <p className="font-semibold text-ink">Vercel</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">Use Vercel Cron to GET `/api/alerts/evaluate`; Vercel sends `Authorization: Bearer &lt;CRON_SECRET&gt;` when the server-only secret is configured.</p>
          </div>
          <div className="rounded-2xl border border-forest-100 bg-forest-50 p-4 dark:bg-charcoal-700">
            <p className="font-semibold text-ink">Netlify</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">Use Netlify Scheduled Functions or an external scheduler to call the same endpoint with the configured secret.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

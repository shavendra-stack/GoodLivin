import Link from "next/link";
import { Bell, Check, Clock3, ExternalLink, Play, RotateCcw, Settings2, ShieldCheck, UserCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { alertTypeLabel, getAlertWorkspace, type OperationalAlert } from "@/lib/alerts";
import { ROLE_CODES, ROLE_LABELS } from "@/lib/roles";
import { cn, formatDateTime } from "@/lib/utils";
import { acknowledgeAlert, assignAlert, markAlertRead, reopenAlert, resolveAlert, runAlertCheck, snoozeAlert } from "@/app/(app)/notifications/actions";
import { EmptyState, FormField, InlineMessage } from "@/components/master-data-ui";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type SearchParams = Promise<{ q?: string; status?: string; priority?: string; type?: string; assigned?: string; saved?: string; error?: string; demo?: string }>;

const tabs = [
  { href: "/notifications", label: "Alert centre" },
  { href: "/notifications/rules", label: "Alert rules" },
  { href: "/notifications/automation", label: "Automation history" },
  { href: "/notifications/approvals", label: "Approval inbox" },
] as const;

function AlertTabs() {
  return (
    <div className="flex gap-2 overflow-x-auto rounded-2xl border border-forest-100/80 bg-white p-1 shadow-soft dark:bg-charcoal-800">
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} className={cn("whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition", tab.href === "/notifications" ? "bg-forest-700 text-white" : "text-slate-500 hover:bg-forest-50 hover:text-forest-800 dark:hover:bg-charcoal-700")}>{tab.label}</Link>
      ))}
    </div>
  );
}

function FilterPanel({ params, alertTypes }: { params: Awaited<SearchParams>; alertTypes: string[] }) {
  return (
    <form action="/notifications" method="get" className="grid gap-3 rounded-[1.35rem] border border-forest-100/80 bg-white p-4 shadow-soft md:grid-cols-[minmax(0,1fr)_repeat(4,auto)] md:items-center dark:bg-charcoal-800">
      <Input name="q" defaultValue={params.q ?? ""} placeholder="Search alerts, records or recommended actions" />
      <Select name="status" defaultValue={params.status ?? "active"}>
        <option value="active">Active alerts</option>
        <option value="open">Open only</option>
        <option value="acknowledged">Acknowledged</option>
        <option value="snoozed">Snoozed</option>
        <option value="resolved">Resolved</option>
        <option value="all">All statuses</option>
      </Select>
      <Select name="priority" defaultValue={params.priority ?? "all"}>
        <option value="all">All priorities</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
        <option value="informational">Informational</option>
      </Select>
      <Select name="type" defaultValue={params.type ?? "all"}>
        <option value="all">All alert types</option>
        {alertTypes.map((type) => <option key={type} value={type}>{alertTypeLabel(type)}</option>)}
      </Select>
      <Button type="submit" variant="secondary" size="sm">Apply</Button>
    </form>
  );
}

function metadataValue(alert: OperationalAlert, key: string) {
  const value = alert.metadata[key];
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "number" ? value.toLocaleString() : String(value);
}

function AlertActions({ alert }: { alert: OperationalAlert }) {
  const futureDefault = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <form action={markAlertRead} className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 p-3 dark:border-charcoal-700">
        <input type="hidden" name="id" value={alert.id} />
        <input type="hidden" name="read" value={alert.isUnread ? "true" : "false"} />
        <Button type="submit" variant="secondary" size="sm"><Check className="h-4 w-4" />{alert.isUnread ? "Mark read" : "Mark unread"}</Button>
        <span className="text-xs text-slate-500">Reading does not resolve the alert.</span>
      </form>

      {alert.status !== "resolved" && alert.canAcknowledge ? (
        <form action={acknowledgeAlert} className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 p-3 dark:border-charcoal-700">
          <input type="hidden" name="id" value={alert.id} />
          <Input name="reason" placeholder="Optional acknowledgement note" className="min-w-[220px] flex-1" />
          <Button type="submit" variant="secondary" size="sm"><UserCheck className="h-4 w-4" />Acknowledge</Button>
        </form>
      ) : null}

      {alert.status !== "resolved" && alert.canManage ? (
        <>
          <form action={snoozeAlert} className="grid gap-2 rounded-2xl border border-slate-100 p-3 dark:border-charcoal-700 sm:grid-cols-[1fr_auto] sm:items-end">
            <input type="hidden" name="id" value={alert.id} />
            <FormField label="Snooze until" hint={alert.priority === "critical" ? "Critical alerts remain visible even when snoozed." : undefined}>
              <Input name="snoozedUntil" type="datetime-local" defaultValue={futureDefault} />
            </FormField>
            <Button type="submit" variant="secondary" size="sm"><Clock3 className="h-4 w-4" />Snooze</Button>
          </form>
          <form action={resolveAlert} className="grid gap-2 rounded-2xl border border-slate-100 p-3 dark:border-charcoal-700 sm:grid-cols-[1fr_auto] sm:items-end">
            <input type="hidden" name="id" value={alert.id} />
            <FormField label="Resolution reason" required>
              <Input name="reason" required placeholder="Describe why this alert is resolved" />
            </FormField>
            <Button type="submit" variant="secondary" size="sm">Resolve</Button>
          </form>
          <form action={assignAlert} className="grid gap-2 rounded-2xl border border-slate-100 p-3 dark:border-charcoal-700 sm:grid-cols-[1fr_auto] sm:items-end">
            <input type="hidden" name="id" value={alert.id} />
            <FormField label="Assign role">
              <Select name="assignedRole" defaultValue={alert.assignedRole ?? "director_admin"}>
                {ROLE_CODES.filter((role) => role !== "retailer_user").map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
              </Select>
            </FormField>
            <Button type="submit" variant="secondary" size="sm">Assign</Button>
          </form>
        </>
      ) : null}

      {alert.status === "resolved" && alert.canManage ? (
        <form action={reopenAlert} className="grid gap-2 rounded-2xl border border-slate-100 p-3 dark:border-charcoal-700 sm:grid-cols-[1fr_auto] sm:items-end">
          <input type="hidden" name="id" value={alert.id} />
          <FormField label="Reopen reason" required>
            <Input name="reason" required placeholder="Why should this alert be reopened?" />
          </FormField>
          <Button type="submit" variant="secondary" size="sm"><RotateCcw className="h-4 w-4" />Reopen</Button>
        </form>
      ) : null}
    </div>
  );
}

function AlertCard({ alert }: { alert: OperationalAlert }) {
  const metrics = [
    ["Physical", metadataValue(alert, "physical_stock")],
    ["Available", metadataValue(alert, "available_stock")],
    ["Incoming", metadataValue(alert, "incoming_stock")],
    ["Projected", metadataValue(alert, "projected_stock")],
    ["Recommended", metadataValue(alert, "recommended_reorder_quantity")],
  ];
  return (
    <Card className={cn(alert.priority === "critical" ? "border-red-200" : alert.priority === "high" ? "border-amber-200" : undefined, alert.isUnread ? "ring-1 ring-forest-300" : "")}>
      <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={alert.priority === "critical" ? "danger" : alert.priority === "high" ? "warning" : "info"}>{alert.priority}</Badge>
            <StatusBadge status={alert.status} />
            {alert.isUnread ? <Badge tone="success">Unread</Badge> : <Badge tone="neutral">Read</Badge>}
            {alert.isSnoozedForUser ? <Badge tone="neutral">Snoozed until {formatDateTime(alert.snoozedUntil)}</Badge> : null}
          </div>
          <CardTitle className="mt-3 break-words text-xl">{alert.title}</CardTitle>
          <CardDescription className="mt-2">{alertTypeLabel(alert.alertType)} · Created {formatDateTime(alert.createdAt)}</CardDescription>
        </div>
        <Link href={alert.href} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-forest-200 px-3 text-sm font-semibold text-forest-800 transition hover:bg-forest-50 dark:border-forest-700 dark:text-forest-200 dark:hover:bg-charcoal-700">
          <ExternalLink className="h-4 w-4" />Open record
        </Link>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-charcoal-700">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Explanation</p>
              <p className="mt-2 text-sm leading-6 text-ink">{alert.explanation}</p>
            </div>
            <div className="rounded-2xl bg-forest-50 p-4 dark:bg-charcoal-700">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-forest-700 dark:text-forest-300">Recommended action</p>
              <p className="mt-2 text-sm leading-6 text-forest-900 dark:text-slate-100">{alert.recommendedAction}</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {metrics.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-100 p-3 dark:border-charcoal-700">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
                <p className="mt-1 break-words font-display text-lg font-bold text-ink">{value}</p>
              </div>
            ))}
            <div className="rounded-2xl border border-slate-100 p-3 dark:border-charcoal-700">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Assigned</p>
              <p className="mt-1 text-sm font-semibold text-ink">{alert.assignedUserName ?? (alert.assignedRole ? ROLE_LABELS[alert.assignedRole] : "Unassigned")}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 p-3 dark:border-charcoal-700">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Due</p>
              <p className="mt-1 text-sm font-semibold text-ink">{formatDateTime(alert.dueAt)}</p>
            </div>
          </div>
        </div>
        {alert.resolutionReason ? <InlineMessage kind="info">Resolution note: {alert.resolutionReason}</InlineMessage> : null}
        <AlertActions alert={alert} />
      </CardContent>
    </Card>
  );
}

export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const workspace = await getAlertWorkspace(user, params);
  const alertTypes = Array.from(new Set([...workspace.rules.map((rule) => rule.alertType), ...workspace.alerts.map((alert) => alert.alertType)])).sort();
  const notice = params.error ? <InlineMessage kind="error">{decodeURIComponent(params.error)}</InlineMessage>
    : params.demo ? <InlineMessage kind="info">Demo mode is read-only; this screen is a preview.</InlineMessage>
      : params.saved ? <InlineMessage>{decodeURIComponent(params.saved)}</InlineMessage>
        : null;

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-forest-600">Stage 8 · Alerts and notifications</p>
          <h1 className="mt-2 flex items-center gap-3 font-display text-3xl font-bold tracking-tight text-ink"><Bell className="h-8 w-8 text-forest-700" />Alert centre</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Central in-app notifications for stock, expiry, retailer, purchase-order, payment, approval and operational review signals. Alerts suggest action only; they never post inventory or bypass workflows.</p>
        </div>
        <form action={runAlertCheck}>
          <Button type="submit"><Play className="h-4 w-4" />Run alert check</Button>
        </form>
      </div>

      <AlertTabs />
      {notice}
      {workspace.error ? <InlineMessage kind="error">{workspace.error}</InlineMessage> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card><CardContent className="p-5"><p className="text-sm text-slate-500">Active alerts</p><p className="mt-2 font-display text-3xl font-bold text-ink">{workspace.summary.open}</p></CardContent></Card>
        <Card className="border-red-100"><CardContent className="p-5"><p className="text-sm text-slate-500">Critical</p><p className="mt-2 font-display text-3xl font-bold text-red-700">{workspace.summary.critical}</p></CardContent></Card>
        <Card className="border-forest-100"><CardContent className="p-5"><p className="text-sm text-slate-500">Unread</p><p className="mt-2 font-display text-3xl font-bold text-forest-700">{workspace.summary.unread}</p></CardContent></Card>
        <Card className="border-amber-100"><CardContent className="p-5"><p className="text-sm text-slate-500">Due soon</p><p className="mt-2 font-display text-3xl font-bold text-amber-700">{workspace.summary.dueSoon}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-slate-500">Resolved in view</p><p className="mt-2 font-display text-3xl font-bold text-ink">{workspace.summary.resolved}</p></CardContent></Card>
      </div>

      <FilterPanel params={params} alertTypes={alertTypes} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Operational alert list</h2>
          <p className="mt-1 text-sm text-slate-500">{workspace.alerts.length} alert{workspace.alerts.length === 1 ? "" : "s"} shown under your current role permissions.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/notifications/rules" className="inline-flex h-9 items-center gap-2 rounded-xl border border-forest-200 px-3 text-xs font-semibold text-forest-800 hover:bg-forest-50"><Settings2 className="h-3.5 w-3.5" />Rules</Link>
          <Link href="/notifications/approvals" className="inline-flex h-9 items-center gap-2 rounded-xl border border-forest-200 px-3 text-xs font-semibold text-forest-800 hover:bg-forest-50"><ShieldCheck className="h-3.5 w-3.5" />Approvals</Link>
        </div>
      </div>

      {workspace.alerts.length === 0 ? (
        <EmptyState title="No alerts match this view" description="Run an alert check or adjust the filters. Resolved alerts remain available when you choose All or Resolved status." />
      ) : (
        <div className="space-y-4">
          {workspace.alerts.map((alert) => <AlertCard key={alert.id} alert={alert} />)}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Stage 8 safety boundary</CardTitle>
          <CardDescription>Automation remains advisory. It never creates, approves or posts stock movements, purchase orders, transfers, payments, returns or adjustments.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea readOnly value="External email, SMS, WhatsApp and webhook providers are intentionally not connected in Stage 8. The notification_delivery_queue table and scheduled endpoint prepare the interface for a future provider without changing today’s in-app behaviour." />
        </CardContent>
      </Card>
    </div>
  );
}

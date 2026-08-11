import Link from "next/link";
import { ClipboardCheck, ExternalLink, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getApprovalInbox } from "@/lib/alerts";
import { formatDateTime, formatLkr } from "@/lib/utils";
import { DataTable } from "@/components/data-table";
import { EmptyState, InlineMessage } from "@/components/master-data-ui";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const tabs = [
  { href: "/notifications", label: "Alert centre" },
  { href: "/notifications/rules", label: "Alert rules" },
  { href: "/notifications/automation", label: "Automation history" },
  { href: "/notifications/approvals", label: "Approval inbox" },
] as const;

function AlertTabs() {
  return (
    <div className="flex gap-2 overflow-x-auto rounded-2xl border border-forest-100/80 bg-white p-1 shadow-soft dark:bg-charcoal-800">
      {tabs.map((tab) => <Link key={tab.href} href={tab.href} className={tab.href === "/notifications/approvals" ? "whitespace-nowrap rounded-xl bg-forest-700 px-3 py-2 text-sm font-semibold text-white" : "whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-forest-50 hover:text-forest-800 dark:hover:bg-charcoal-700"}>{tab.label}</Link>)}
    </div>
  );
}

function requestTypeLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function ApprovalInboxPage() {
  const user = await requireUser();
  const { rows, error } = await getApprovalInbox(user);
  const financialItems = rows.filter((row) => row.financialImpact !== null).length;
  const stockItems = rows.filter((row) => row.stockImpactQuantity !== null).length;

  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-forest-600">Stage 8 · Approval inbox</p>
        <h1 className="mt-2 flex items-center gap-3 font-display text-3xl font-bold tracking-tight text-ink"><ShieldCheck className="h-8 w-8 text-forest-700" />Approval inbox</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">A central view of pending controlled workflow reviews. Final decisions still happen inside the existing purchase-order, transfer, adjustment, reconciliation or approval workflow.</p>
      </div>

      <AlertTabs />
      {error ? <InlineMessage kind="error">{error}</InlineMessage> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5"><p className="text-sm text-slate-500">Pending items</p><p className="mt-2 font-display text-3xl font-bold text-ink">{rows.length}</p></CardContent></Card>
        <Card className="border-amber-100"><CardContent className="p-5"><p className="text-sm text-slate-500">Stock impact</p><p className="mt-2 font-display text-3xl font-bold text-amber-700">{stockItems}</p></CardContent></Card>
        <Card className="border-forest-100"><CardContent className="p-5"><p className="text-sm text-slate-500">Financial visibility</p><p className="mt-2 font-display text-3xl font-bold text-forest-700">{financialItems}</p></CardContent></Card>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No pending approvals" description="There are no purchase-order approvals, controlled adjustments, stock-transfer reviews or generic approval records visible to your role." />
      ) : (
        <DataTable rows={rows} rowKey={(row) => `${row.requestType}-${row.id}`} columns={[
          { key: "request", header: "Request", render: (row) => <div><p className="font-semibold">{requestTypeLabel(row.requestType)}</p><p className="mt-1 text-xs text-slate-500">{row.recordType}</p></div> },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.approvalStatus} /> },
          { key: "requester", header: "Requester", render: (row) => <div><p>{row.requesterName ?? "Team member"}</p><p className="mt-1 text-xs text-slate-500">{formatDateTime(row.submittedAt)}</p></div> },
          { key: "impact", header: "Impact", render: (row) => <div className="space-y-1 text-xs text-slate-500">{row.stockImpactQuantity !== null ? <p><Badge tone="warning">{row.stockImpactQuantity > 0 ? "+" : ""}{row.stockImpactQuantity.toLocaleString()} units</Badge></p> : null}{row.financialImpact !== null ? <p>{formatLkr(row.financialImpact)}</p> : <p>Financial data restricted or not applicable</p>}</div> },
          { key: "reason", header: "Reason", render: (row) => <p className="max-w-[28rem] text-sm leading-6 text-slate-500">{row.reason ?? "Review requested."}</p> },
          { key: "action", header: "Action", className: "text-right", render: (row) => <Link href={row.href} className="inline-flex h-9 items-center gap-1 rounded-xl border border-forest-200 px-3 text-xs font-semibold text-forest-800 hover:bg-forest-50"><ExternalLink className="h-3.5 w-3.5" />Open</Link> },
        ]} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-forest-700" />Controlled workflow boundary</CardTitle>
          <CardDescription>This inbox does not approve, reject, post, receive, dispatch or reverse anything by itself. It points authorized users to the existing audited workflow where the action belongs.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { AlertTriangle, ArrowRight, ArrowUpRight, Boxes, CalendarClock, ClipboardList, FileBarChart, PackageCheck, ShoppingCart, Truck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { firstName, formatDate, formatLkr } from "@/lib/utils";
import { getReportModel, type ReportFilters } from "@/lib/reports";
import { AuditInfo } from "@/components/audit-info";
import { DataTable } from "@/components/data-table";
import { EmptyState, InlineMessage } from "@/components/master-data-ui";
import { CalculationNote, MetricCard, SimpleBarList } from "@/components/reports-ui";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type SearchParams = Promise<{ from?: string; to?: string }>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const filters: ReportFilters = { from: params.from, to: params.to };
  const model = await getReportModel(user, filters);
  const attentionCount = model.inventory.lowStock.length + model.expiry.rows.length + model.purchasing.overdueLines + (model.access.financial ? model.valuation.missingCostRows : 0);
  const recentMovements = model.inventory.movements.slice(0, 8);

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-forest-600">{formatDate(model.today)} · Stage 7 dashboard</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">Good morning, {firstName(user.displayName)}.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">A live executive view of stock, sell-through, purchasing and actions needing attention. Physical stock and incoming stock are intentionally separated.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/reports" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-forest-200 bg-white px-4 text-sm font-semibold text-forest-800"><FileBarChart className="h-4 w-4" />Reports</Link>
          <Link href="/inventory" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-forest-700 px-4 text-sm font-semibold text-white shadow-sm shadow-forest-900/10 transition hover:bg-forest-800">Open live inventory <ArrowUpRight className="h-4 w-4" /></Link>
        </div>
      </div>

      {model.error ? <InlineMessage kind="error">{model.error}</InlineMessage> : null}

      <form action="/dashboard" method="get" className="grid gap-3 rounded-2xl border border-forest-100/80 bg-white p-4 shadow-soft sm:grid-cols-[1fr_1fr_auto]">
        <Input type="date" name="from" defaultValue={model.range.from} aria-label="Dashboard start date" />
        <Input type="date" name="to" defaultValue={model.range.to} aria-label="Dashboard end date" />
        <Button type="submit" variant="secondary">Update range</Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Physical stock" value={model.inventory.physicalStock.toLocaleString()} detail={`${model.inventory.availableStock.toLocaleString()} units available for sellable allocation.`} tone="success" />
        <MetricCard label="Incoming stock" value={model.inventory.incomingStock.toLocaleString()} detail="Approved/open PO quantities only; not included in available stock." tone="info" />
        <MetricCard label="Net sales" value={model.access.sales || model.access.financial ? formatLkr(model.sales.netSales) : "Restricted"} detail={`${model.sales.completedUnits.toLocaleString()} direct/online/event units; ${model.sales.retailerReportedUnits.toLocaleString()} retailer-reported units.`} />
        <MetricCard label="Actions to review" value={attentionCount.toLocaleString()} detail="Low stock, expiry, overdue purchasing and missing valuation costs." tone={attentionCount > 0 ? "warning" : "success"} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Sales today" value={model.access.sales || model.access.financial ? formatLkr(model.sales.todayGross) : "Restricted"} detail="Fulfilled less refunded only." />
        <MetricCard label="Sales this week" value={model.access.sales || model.access.financial ? formatLkr(model.sales.weekGross) : "Restricted"} detail="Week starts Monday in Asia/Colombo." />
        <MetricCard label="Sales this month" value={model.access.sales || model.access.financial ? formatLkr(model.sales.monthGross) : "Restricted"} detail="Pending/cancelled orders excluded." />
        <MetricCard label="Open purchase orders" value={model.purchasing.openOrders.toLocaleString()} detail={`${model.purchasing.overdueLines.toLocaleString()} overdue line${model.purchasing.overdueLines === 1 ? "" : "s"}.`} tone={model.purchasing.overdueLines > 0 ? "danger" : "info"} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><PackageCheck className="h-5 w-5 text-forest-700" />Stock by product and SKU</CardTitle>
              <CardDescription>Physical stock is on hand. Projected stock is planning-only physical + approved incoming.</CardDescription>
            </div>
            <Link href="/reports/inventory" className="text-sm font-semibold text-forest-700 hover:text-forest-900">Open report</Link>
          </CardHeader>
          <CardContent>
            <SimpleBarList rows={model.inventory.byProductSku.map((row) => ({ id: row.id, label: row.productName, detail: `${row.skuCode} · ${row.available.toLocaleString()} available · ${row.incoming.toLocaleString()} incoming`, value: row.quantity }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Boxes className="h-5 w-5 text-forest-700" />Condition split</CardTitle>
            <CardDescription>Sellable, damaged, quarantined, rejected, expired and pending quantities.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {Object.entries(model.inventory.conditionTotals).map(([condition, quantity]) => (
              <div key={condition} className="flex items-center justify-between rounded-xl border border-forest-100 p-3">
                <StatusBadge status={condition} />
                <span className="text-sm font-semibold text-ink">{quantity.toLocaleString()} units</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-700" />Important actions</CardTitle>
            <CardDescription>Operational items that need human review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Low-stock products and locations", value: model.inventory.lowStock.length, href: "/reports/inventory", icon: PackageCheck },
              { label: "Products approaching expiry", value: model.expiry.rows.length, href: "/reports/expiry", icon: CalendarClock },
              { label: "Overdue supplier order lines", value: model.purchasing.overdueLines, href: "/reports/purchasing", icon: ClipboardList },
              { label: "Outstanding PO payments", value: model.access.financial && model.purchasing.outstandingPayments !== null ? formatLkr(model.purchasing.outstandingPayments) : "Restricted", href: "/reports/purchasing", icon: Truck },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.label} href={item.href} className="flex items-center justify-between gap-3 rounded-xl border border-forest-100 p-4 transition hover:bg-forest-50">
                  <span className="flex items-center gap-2 text-sm font-semibold text-ink"><Icon className="h-4 w-4 text-forest-700" />{item.label}</span>
                  <span className="text-sm font-bold text-forest-700">{typeof item.value === "number" ? item.value.toLocaleString() : item.value}</span>
                </Link>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-forest-700" />Sales by channel</CardTitle>
              <CardDescription>Fulfilled and refunded orders reconcile with Stage 5. Retailer reports show units only unless revenue was separately recorded.</CardDescription>
            </div>
            <Link href="/reports/sales" className="text-sm font-semibold text-forest-700 hover:text-forest-900">Open sales</Link>
          </CardHeader>
          <CardContent>
            <SimpleBarList rows={model.sales.channelTotals.map((row) => ({ id: row.channel, label: row.channel.replaceAll("_", " "), detail: row.netValue === null ? "Units-only report" : `${formatLkr(row.netValue)} net`, value: row.units }))} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle>Recent stock movements</CardTitle>
            <CardDescription>Latest posted ledger movements. Completed entries remain immutable.</CardDescription>
          </div>
          <Link href="/movements" className="hidden items-center gap-1 text-sm font-semibold text-forest-700 sm:flex">View ledger <ArrowRight className="h-4 w-4" /></Link>
        </CardHeader>
        <CardContent>
          {recentMovements.length === 0 ? <EmptyState title="No recent movements" description="Posted receipts, transfers, sales deductions and returns will appear here." /> : (
            <DataTable rows={recentMovements} rowKey={(row) => row.id} columns={[
              { key: "movement", header: "Movement", render: (row) => <div><p className="font-semibold">#{row.movementNumber} · {row.movementType.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-slate-500">{row.createdAt ? formatDate(row.createdAt) : "—"}</p></div> },
              { key: "stock", header: "Stock", render: (row) => <div><p>{row.productName}</p><p className="mt-1 text-xs text-slate-500">{row.skuCode} · {row.batchNumber}</p></div> },
              { key: "flow", header: "Flow", render: (row) => <span className="text-sm">{[row.sourceLocationName, row.destinationLocationName].filter(Boolean).join(" → ") || "—"}</span> },
              { key: "qty", header: "Quantity", render: (row) => `${row.quantity.toLocaleString()} units` },
              { key: "status", header: "Status", render: (row) => <Badge tone="success">{row.status}</Badge> },
            ]} />
          )}
        </CardContent>
      </Card>

      <CalculationNote>
        Available stock excludes incoming purchase orders, expired batches and stock in damaged, quarantine, rejected or expired conditions. Incoming quantities are shown separately as planning visibility only.
      </CalculationNote>

      <AuditInfo actor={user.displayName} reason={user.isDemo ? "Seeded demo workspace; no live records are being changed." : "Authenticated report/dashboard session."} />
    </div>
  );
}

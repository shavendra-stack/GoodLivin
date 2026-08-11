import Link from "next/link";
import { BarChart3, Boxes, FileBarChart, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getReportModel } from "@/lib/reports";
import { formatLkr } from "@/lib/utils";
import { CalculationNote, MetricCard, ReportNav, ReportPageHeader } from "@/components/reports-ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InlineMessage } from "@/components/master-data-ui";

export default async function ReportsPage() {
  const user = await requireUser();
  const model = await getReportModel(user);
  const attentionItems = [
    { label: "Low-stock rows", value: model.inventory.lowStock.length, href: "/reports/inventory", tone: "warning" },
    { label: "Expiry/watch rows", value: model.expiry.rows.length, href: "/reports/expiry", tone: "warning" },
    { label: "Overdue PO lines", value: model.purchasing.overdueLines, href: "/reports/purchasing", tone: "danger" },
    { label: "Missing cost rows", value: model.access.financial ? model.valuation.missingCostRows : 0, href: "/reports/valuation", tone: "info" },
  ] as const;

  return (
    <div className="space-y-7">
      <ReportPageHeader
        eyebrow="Stage 7 · Reports and business insights"
        title="Reports"
        description="Simple, live, read-only reporting for GoodLivin’s current operating model, built from the existing inventory ledger, sales records, retailer reports and purchase orders."
        icon={FileBarChart}
        generatedAt={model.generatedAt}
        actions={<Link href="/dashboard" className="inline-flex h-10 items-center justify-center rounded-xl bg-forest-700 px-4 text-sm font-semibold text-white">Open dashboard</Link>}
      />

      {model.error ? <InlineMessage kind="error">{model.error}</InlineMessage> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Physical stock" value={model.inventory.physicalStock.toLocaleString()} detail="Actual on-hand units only; incoming PO quantities are excluded." />
        <MetricCard label="Incoming stock" value={model.inventory.incomingStock.toLocaleString()} detail="Approved/open purchase-order quantities not yet received." tone="info" />
        <MetricCard label="Net sales in range" value={model.access.sales || model.access.financial ? formatLkr(model.sales.netSales) : "Restricted"} detail={model.range.label} tone="success" />
        <MetricCard label="Open purchase orders" value={model.purchasing.openOrders.toLocaleString()} detail={`${model.purchasing.incomingUnits.toLocaleString()} units still incoming.`} tone="warning" />
      </div>

      <ReportNav access={model.access} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-forest-700" />Report definitions</CardTitle>
          <CardDescription>These definitions are reused across the Stage 7 pages to keep calculations consistent.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            ["Physical stock", "Current on-hand stock from posted ledger movements only."],
            ["Available stock", "Physical stock that is approved, non-expired and not in damaged, quarantine, rejected or expired stock locations."],
            ["Incoming stock", "Outstanding quantities on approved/open purchase orders. Never included in available stock."],
            ["Projected stock", "Physical stock plus incoming stock, labelled as planning only."],
            ["Net sales", "Fulfilled sales less refunded sales. Pending and cancelled orders are excluded."],
            ["Sell-through %", "Reported units sold divided by delivered retailer stock, based on latest internal retailer reporting."],
            ["Valuation", "Batch unit cost, then batch purchase cost, weighted movement cost or SKU cost when available. Missing costs are warned, not treated as zero."],
            ["Wastage value", "Affected quantity multiplied by available cost basis; missing cost rows remain missing."],
            ["Reorder quantity", "Stage 5 target stock minus current branch stock, advisory only."],
          ].map(([label, description]) => (
            <div key={label} className="rounded-2xl border border-forest-100 bg-forest-50/50 p-4">
              <p className="font-semibold text-ink">{label}</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Boxes className="h-5 w-5 text-forest-700" />Attention queue</CardTitle>
            <CardDescription>Practical next reviews before GoodLivin scales beyond the initial setup.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {attentionItems.map((item) => (
              <Link key={item.label} href={item.href} className="flex items-center justify-between rounded-xl border border-forest-100 p-4 transition hover:bg-forest-50">
                <span className="text-sm font-semibold text-ink">{item.label}</span>
                <Badge tone={item.tone}>{item.value.toLocaleString()}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-forest-700" />Fast links</CardTitle>
            <CardDescription>Operational reports remain read-only. Use the original modules to create or correct records.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Link href="/reports/sales" className="rounded-xl border border-forest-100 p-4 text-sm font-semibold text-forest-800 hover:bg-forest-50">Sales trend and channels</Link>
            <Link href="/reports/retailers" className="rounded-xl border border-forest-100 p-4 text-sm font-semibold text-forest-800 hover:bg-forest-50">Retailer sell-through</Link>
            <Link href="/reports/purchasing" className="rounded-xl border border-forest-100 p-4 text-sm font-semibold text-forest-800 hover:bg-forest-50">Incoming purchase orders</Link>
            <Link href="/reports/traceability" className="rounded-xl border border-forest-100 p-4 text-sm font-semibold text-forest-800 hover:bg-forest-50">Batch traceability</Link>
          </CardContent>
        </Card>
      </div>

      <CalculationNote>
        Stage 7 does not change workflows or stock. It reads from existing Stage 1–6 records under the current user session, so Supabase RLS still decides what each role can see.
      </CalculationNote>
    </div>
  );
}

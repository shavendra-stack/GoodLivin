import Link from "next/link";
import { Store } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { getReportModel, type ReportFilters } from "@/lib/reports";
import { AccessDenied, CalculationNote, ExportLink, MetricCard, ReportLimitNote, ReportPageHeader, SimpleBarList } from "@/components/reports-ui";
import { DataTable } from "@/components/data-table";
import { EmptyState, InlineMessage } from "@/components/master-data-ui";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type SearchParams = Promise<ReportFilters>;

export default async function RetailerPerformanceReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const filters = await searchParams;
  const model = await getReportModel(user, filters);

  if (!model.access.retailers) return <AccessDenied description="Your role does not include retailer performance reporting access." />;

  return (
    <div className="space-y-7">
      <ReportPageHeader
        eyebrow="Stage 7 · Retailer performance"
        title="Retailer performance"
        description="Branch-level holdings, deliveries, sell-through, average sales rate and replenishment suggestions. Retailer stock is calculated from GoodLivin’s latest internal records."
        icon={Store}
        generatedAt={model.generatedAt}
        actions={<><ExportLink kind="retailers" filters={filters} enabled={model.access.export} /><Link href="/sell-through" className="inline-flex h-10 items-center justify-center rounded-xl border border-forest-200 bg-white px-4 text-sm font-semibold text-forest-800">Sell-through module</Link></>}
      />

      {model.error ? <InlineMessage kind="error">{model.error}</InlineMessage> : null}

      <form action="/reports/retailers" method="get" className="grid gap-3 rounded-2xl border border-forest-100/80 bg-white p-4 shadow-soft md:grid-cols-2 xl:grid-cols-6">
        <Input name="q" defaultValue={filters.q} placeholder="Search retailer, branch, SKU" />
        <Select name="retailerId" defaultValue={filters.retailerId ?? "all"}><option value="all">All retailers</option>{model.refs.retailers.map((row) => <option key={row.id} value={row.id}>{row.label} · {row.code}</option>)}</Select>
        <Select name="branchId" defaultValue={filters.branchId ?? "all"}><option value="all">All branches</option>{model.refs.branches.map((row) => <option key={row.id} value={row.id}>{row.label} · {row.code}</option>)}</Select>
        <Select name="productId" defaultValue={filters.productId ?? "all"}><option value="all">All products</option>{model.refs.products.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</Select>
        <Select name="skuId" defaultValue={filters.skuId ?? "all"}><option value="all">All SKUs</option>{model.refs.skus.map((row) => <option key={row.id} value={row.id}>{row.label} · {row.code}</option>)}</Select>
        <Button type="submit" variant="secondary">Apply filters</Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Deliveries received" value={model.retailers.totalDeliveries.toLocaleString()} detail="Posted stock delivered to retailer branch locations." />
        <MetricCard label="Units sold" value={model.retailers.totalSold.toLocaleString()} detail="Posted retailer sell-through reports." tone="success" />
        <MetricCard label="Average sell-through" value={`${model.retailers.averageSellThroughPercent.toFixed(1)}%`} detail="Average across visible branch/SKU rows." />
        <MetricCard label="Low-stock rows" value={model.retailers.lowStockRows.toLocaleString()} detail="Rows with replenishment suggested or zero stock." tone={model.retailers.lowStockRows ? "warning" : "success"} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader><CardTitle>Suggested replenishment</CardTitle><CardDescription>Planning suggestions only; transfers are still created in the Stage 4 workflow.</CardDescription></CardHeader>
          <CardContent><SimpleBarList rows={model.retailers.rows.filter((row) => row.suggestedReplenishmentQuantity > 0).map((row) => ({ id: row.id, label: `${row.branchName} · ${row.skuCode}`, detail: `${row.productName} · ${row.currentStock.toLocaleString()} current · ${row.averageDailySales.toFixed(2)} avg/day`, value: row.suggestedReplenishmentQuantity }))} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Stale reporting watch</CardTitle><CardDescription>Days since the latest GoodLivin-entered branch sales report.</CardDescription></CardHeader>
          <CardContent><SimpleBarList rows={model.retailers.rows.map((row) => ({ id: row.id, label: `${row.branchName} · ${row.skuCode}`, detail: row.lastReportDate ? `Last report ${formatDate(row.lastReportDate)}` : "No report yet", value: row.daysSinceLastReport }))} valueLabel="days" /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Retailer branch performance detail</CardTitle><CardDescription>Current calculated stock = latest ledger balance at the branch. Opening stock remains zero until a formal opening balance workflow exists.</CardDescription></CardHeader>
        <CardContent>
          {model.retailers.rows.length === 0 ? <EmptyState title="No retailer performance rows" description="Active retailer branches and posted reports will appear here." /> : (
            <DataTable rows={model.retailers.rows} rowKey={(row) => row.id} columns={[
              { key: "branch", header: "Retailer / branch", render: (row) => <div><p className="font-semibold">{row.retailerName}</p><p className="mt-1 text-xs text-slate-500">{row.branchName} · {row.branchCode}</p></div> },
              { key: "sku", header: "Product / SKU", render: (row) => <div><p>{row.productName}</p><p className="mt-1 text-xs text-slate-500">{row.productCode} · {row.skuCode}</p></div> },
              { key: "flow", header: "Flow", render: (row) => <div><p>Opening {row.openingStock.toLocaleString()} · delivered {row.deliveries.toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">Sold {row.unitsSold.toLocaleString()} · returns {row.returns.toLocaleString()} · damage {row.damaged.toLocaleString()} · expired {row.expired.toLocaleString()}</p></div> },
              { key: "stock", header: "Current stock", render: (row) => <span className={row.currentStock <= 0 ? "font-bold text-amber-700" : "font-semibold text-ink"}>{row.currentStock.toLocaleString()} units</span> },
              { key: "sell", header: "Sell-through", render: (row) => <div><p className="font-semibold">{row.sellThroughPercent.toFixed(1)}%</p><p className="mt-1 text-xs text-slate-500">{row.averageDailySales.toFixed(2)} avg/day</p></div> },
              { key: "last", header: "Latest report", render: (row) => <div><p>{formatDate(row.lastReportDate)}</p><p className="mt-1 text-xs text-slate-500">{row.daysSinceLastReport.toLocaleString()} days ago</p></div> },
              { key: "replenish", header: "Suggested replenishment", render: (row) => <div><p className="font-semibold">{row.suggestedReplenishmentQuantity.toLocaleString()} units</p><StatusBadge status={row.lowStockStatus} /></div> },
            ]} />
          )}
        </CardContent>
      </Card>

      <CalculationNote>
        Retailer stock is labelled as calculated because it depends on GoodLivin-entered deliveries, reports, returns, damages, expiries and reconciliations. It is not a retailer login or external live feed.
      </CalculationNote>
      <ReportLimitNote />
    </div>
  );
}

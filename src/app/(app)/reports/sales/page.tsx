import Link from "next/link";
import { LineChart, ShoppingCart } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { formatDate, formatLkr } from "@/lib/utils";
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

const salesChannels = ["online_store", "direct_sale", "event_pop_up", "retailer_branch", "retailer_sell_through"];

export default async function SalesReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const filters = await searchParams;
  const model = await getReportModel(user, filters);

  if (!model.access.sales) return <AccessDenied description="Your role does not include sales or retailer performance reporting access." />;

  return (
    <div className="space-y-7">
      <ReportPageHeader
        eyebrow="Stage 7 · Sales reports"
        title="Sales reports"
        description="Sales by date range, product, SKU and channel. Completed revenue reconciles to fulfilled Stage 5 sales orders; pending and cancelled orders are excluded."
        icon={ShoppingCart}
        generatedAt={model.generatedAt}
        actions={<><ExportLink kind="sales" filters={filters} enabled={model.access.export} /><Link href="/sales" className="inline-flex h-10 items-center justify-center rounded-xl border border-forest-200 bg-white px-4 text-sm font-semibold text-forest-800">Sales module</Link></>}
      />

      {model.error ? <InlineMessage kind="error">{model.error}</InlineMessage> : null}

      <form action="/reports/sales" method="get" className="grid gap-3 rounded-2xl border border-forest-100/80 bg-white p-4 shadow-soft md:grid-cols-2 xl:grid-cols-7">
        <Input type="date" name="from" defaultValue={model.range.from} aria-label="Sales report start date" />
        <Input type="date" name="to" defaultValue={model.range.to} aria-label="Sales report end date" />
        <Input name="q" defaultValue={filters.q} placeholder="Search sale, product, retailer" />
        <Select name="channel" defaultValue={filters.channel ?? "all"}><option value="all">All channels</option>{salesChannels.map((channel) => <option key={channel} value={channel}>{channel.replaceAll("_", " ")}</option>)}</Select>
        <Select name="productId" defaultValue={filters.productId ?? "all"}><option value="all">All products</option>{model.refs.products.map((row) => <option key={row.id} value={row.id}>{row.label} · {row.code}</option>)}</Select>
        <Select name="retailerId" defaultValue={filters.retailerId ?? "all"}><option value="all">All retailers</option>{model.refs.retailers.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</Select>
        <Button type="submit" variant="secondary">Apply</Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Gross sales value" value={formatLkr(model.sales.grossSales)} detail="Fulfilled and refunded sales before refund subtraction." />
        <MetricCard label="Discounts" value={formatLkr(model.sales.discounts)} detail="Recorded discounts on completed orders." />
        <MetricCard label="Refunds" value={formatLkr(model.sales.refunds)} detail="Refunded orders shown as reversing value." tone={model.sales.refunds > 0 ? "warning" : "success"} />
        <MetricCard label="Net sales value" value={formatLkr(model.sales.netSales)} detail={model.range.label} tone="success" />
        <MetricCard label="Retailer reported units" value={model.sales.retailerReportedUnits.toLocaleString()} detail="Units-only retailer sell-through records." />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader><CardTitle>Sales by channel</CardTitle><CardDescription>Exact values are shown where Stage 5 stores value. Retailer reports stay units-only.</CardDescription></CardHeader>
          <CardContent><SimpleBarList rows={model.sales.channelTotals.map((row) => ({ id: row.channel, label: row.channel.replaceAll("_", " "), detail: row.netValue === null ? "Units only · no revenue invented" : `${formatLkr(row.netValue)} net`, value: row.units }))} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><LineChart className="h-5 w-5 text-forest-700" />Sales trend</CardTitle><CardDescription>Daily completed units and net value in the selected range.</CardDescription></CardHeader>
          <CardContent><SimpleBarList rows={model.sales.trend.map((row) => ({ id: row.date, label: formatDate(row.date), detail: `${formatLkr(row.netValue)} net`, value: row.units }))} valueLabel="units" maxRows={10} /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Best-selling and slow-moving products</CardTitle><CardDescription>Sorted by units sold. Average selling price is calculated only when a monetary sale value exists.</CardDescription></CardHeader>
        <CardContent>
          {model.sales.productTotals.length === 0 ? <EmptyState title="No sales totals" description="Fulfilled sales and posted retailer reports will appear here." /> : (
            <DataTable rows={model.sales.productTotals} rowKey={(row) => row.id} columns={[
              { key: "product", header: "Product / SKU", render: (row) => <div><p className="font-semibold">{row.productName}</p><p className="mt-1 text-xs text-slate-500">{row.skuCode}</p></div> },
              { key: "units", header: "Units", render: (row) => `${row.units.toLocaleString()} units` },
              { key: "net", header: "Net value", render: (row) => row.netValue === null ? "Units only" : formatLkr(row.netValue) },
              { key: "asp", header: "Average selling price", render: (row) => row.averageSellingPrice === null ? "—" : formatLkr(row.averageSellingPrice) },
              { key: "pace", header: "Pace", render: (row) => <StatusBadge status={row.units > 0 ? "active" : "pending"} /> },
            ]} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sales and retailer-report detail</CardTitle><CardDescription>Pending/cancelled records are retained for audit visibility but do not contribute completed revenue or completed sell-through units.</CardDescription></CardHeader>
        <CardContent>
          {model.sales.rows.length === 0 ? <EmptyState title="No sales rows match" description="Adjust the date range or filters." /> : (
            <DataTable rows={model.sales.rows} rowKey={(row) => `${row.recordType}-${row.id}`} columns={[
              { key: "ref", header: "Reference", render: (row) => <div><p className="font-semibold">{row.reference}</p><p className="mt-1 text-xs text-slate-500">{formatDate(row.date)} · {row.recordType.replaceAll("_", " ")}</p></div> },
              { key: "channel", header: "Channel", render: (row) => <StatusBadge status={row.channel} /> },
              { key: "stock", header: "Product / SKU", render: (row) => <div><p>{row.productName}</p><p className="mt-1 text-xs text-slate-500">{row.skuCode}</p></div> },
              { key: "retailer", header: "Retailer / branch", render: (row) => row.branchName ?? row.retailerName ?? "—" },
              { key: "qty", header: "Units", render: (row) => <div><p>{row.unitsSold.toLocaleString()} sold</p><p className="mt-1 text-xs text-slate-500">{row.returnedUnits.toLocaleString()} returns · {row.damagedUnits.toLocaleString()} damaged · {row.expiredUnits.toLocaleString()} expired</p></div> },
              { key: "value", header: "Value", render: (row) => row.netValue === null ? <span className="text-xs text-slate-400">Units only</span> : <div><p>{formatLkr(row.netValue)}</p><p className="mt-1 text-xs text-slate-500">Gross {formatLkr(row.grossValue)} · refund {formatLkr(row.refunds)}</p></div> },
              { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
            ]} />
          )}
        </CardContent>
      </Card>

      <CalculationNote>
        Fulfilled orders deduct stock once and count as gross/net sales. Refunded orders keep the original gross sale and add an equal refund, so net sales becomes zero. Retailer sell-through reports reduce branch stock and report units only; Stage 7 does not invent revenue where Stage 5 did not record it.
      </CalculationNote>
      <ReportLimitNote />
    </div>
  );
}

import Link from "next/link";
import { Banknote } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { formatDate, formatLkr } from "@/lib/utils";
import { getReportModel, type InventoryCondition, type ReportFilters } from "@/lib/reports";
import { AccessDenied, CalculationNote, ExportLink, MetricCard, ReportLimitNote, ReportPageHeader, SimpleBarList } from "@/components/reports-ui";
import { DataTable } from "@/components/data-table";
import { EmptyState, InlineMessage } from "@/components/master-data-ui";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type SearchParams = Promise<ReportFilters>;
const conditions: InventoryCondition[] = ["sellable", "damaged", "quarantined", "rejected", "expired", "pending"];

export default async function StockValuationReportPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const filters = await searchParams;
  const model = await getReportModel(user, filters);

  if (!model.access.valuation) return <AccessDenied description={model.access.restrictedFinancialReason} />;

  return (
    <div className="space-y-7">
      <ReportPageHeader
        eyebrow="Stage 7 · Stock valuation"
        title="Stock valuation"
        description="On-hand value by product, SKU, location, batch and condition using the best available recorded cost basis. Missing costs are shown explicitly and are not treated as zero."
        icon={Banknote}
        generatedAt={model.generatedAt}
        actions={<><ExportLink kind="valuation" filters={filters} enabled={model.access.export} /><Link href="/reports" className="inline-flex h-10 items-center justify-center rounded-xl border border-forest-200 bg-white px-4 text-sm font-semibold text-forest-800">Reports hub</Link></>}
      />

      {model.error ? <InlineMessage kind="error">{model.error}</InlineMessage> : null}
      {model.valuation.missingCostRows > 0 ? <InlineMessage kind="info">{model.valuation.missingCostRows.toLocaleString()} valuation row{model.valuation.missingCostRows === 1 ? "" : "s"} have missing cost data and are excluded from complete valuation totals.</InlineMessage> : null}

      <form action="/reports/valuation" method="get" className="grid gap-3 rounded-2xl border border-forest-100/80 bg-white p-4 shadow-soft md:grid-cols-2 xl:grid-cols-6">
        <Input name="q" defaultValue={filters.q} placeholder="Search product, batch, location" />
        <Select name="productId" defaultValue={filters.productId ?? "all"}><option value="all">All products</option>{model.refs.products.map((row) => <option key={row.id} value={row.id}>{row.label} · {row.code}</option>)}</Select>
        <Select name="skuId" defaultValue={filters.skuId ?? "all"}><option value="all">All SKUs</option>{model.refs.skus.map((row) => <option key={row.id} value={row.id}>{row.label} · {row.code}</option>)}</Select>
        <Select name="locationId" defaultValue={filters.locationId ?? "all"}><option value="all">All locations</option>{model.refs.locations.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</Select>
        <Select name="condition" defaultValue={filters.condition ?? "all"}><option value="all">All conditions</option>{conditions.map((condition) => <option key={condition} value={condition}>{condition}</option>)}</Select>
        <Button type="submit" variant="secondary">Apply filters</Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total stock value" value={formatLkr(model.valuation.totalValue)} detail="Rows with missing cost prevent a complete total." />
        <MetricCard label="Sellable stock value" value={formatLkr(model.valuation.sellableValue)} detail="Approved, non-expired and unrestricted stock." tone="success" />
        <MetricCard label="Restricted-condition value" value={formatLkr(model.valuation.restrictedValue)} detail="Damaged, quarantined, rejected, expired or pending stock." tone="warning" />
        <MetricCard label="Missing cost rows" value={model.valuation.missingCostRows.toLocaleString()} detail="Shown as missing, never zero." tone={model.valuation.missingCostRows ? "danger" : "success"} />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Value by product/SKU</CardTitle><CardDescription>Uses the selected cost basis for each batch row.</CardDescription></CardHeader>
          <CardContent><SimpleBarList rows={model.valuation.byProductSku.map((row) => ({ id: row.id, label: row.productName, detail: `${row.skuCode} · ${row.quantity.toLocaleString()} units${row.missingCost ? " · missing cost warning" : ""}`, value: row.value ?? 0 }))} valueLabel="LKR" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Value by location</CardTitle><CardDescription>Warehouse, office and retailer branch stock value.</CardDescription></CardHeader>
          <CardContent><SimpleBarList rows={model.valuation.byLocation.map((row) => ({ id: row.id, label: row.locationName, detail: `${row.quantity.toLocaleString()} units · ${row.missingCostRows.toLocaleString()} missing-cost rows`, value: row.value ?? 0 }))} valueLabel="LKR" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Value by condition</CardTitle><CardDescription>Sellable vs damaged, quarantined, rejected, expired and pending stock.</CardDescription></CardHeader>
          <CardContent><SimpleBarList rows={model.valuation.byCondition.map((row) => ({ id: row.condition, label: row.condition, detail: `${row.quantity.toLocaleString()} units · ${row.missingCostRows.toLocaleString()} missing-cost rows`, value: row.value ?? 0 }))} valueLabel="LKR" /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Valuation detail</CardTitle><CardDescription>Costing method: batch unit cost → batch purchase cost → weighted movement cost → SKU cost per unit. If none are available, the row is marked missing.</CardDescription></CardHeader>
        <CardContent>
          {model.valuation.rows.length === 0 ? <EmptyState title="No valuation rows match" description="Adjust the filters or receive stock with recorded cost data." /> : (
            <DataTable rows={model.valuation.rows} rowKey={(row) => row.id} columns={[
              { key: "stock", header: "Product / SKU", render: (row) => <div><p className="font-semibold">{row.productName}</p><p className="mt-1 text-xs text-slate-500">{row.skuCode} · {row.batchNumber}</p></div> },
              { key: "location", header: "Location", render: (row) => <div><p>{row.locationName}</p><p className="mt-1 text-xs text-slate-500">{row.branchName ?? row.retailerName ?? row.locationCode}</p></div> },
              { key: "condition", header: "Condition", render: (row) => <StatusBadge status={row.condition} /> },
              { key: "expiry", header: "Expiry", render: (row) => formatDate(row.expiresOn) },
              { key: "qty", header: "Quantity", render: (row) => `${row.quantityOnHand.toLocaleString()} units` },
              { key: "cost", header: "Unit cost / basis", render: (row) => <div><p>{formatLkr(row.unitCost)}</p><p className="mt-1 text-xs text-slate-500">{row.costBasis}</p></div> },
              { key: "value", header: "Total value", render: (row) => row.totalValue === null ? <span className="font-semibold text-amber-700">Missing cost</span> : formatLkr(row.totalValue) },
            ]} />
          )}
        </CardContent>
      </Card>

      <CalculationNote>
        Stock valuation is an operational inventory estimate, not an accounting ledger. The report does not invent costs; rows without an available recorded cost basis remain missing.
      </CalculationNote>
      <ReportLimitNote />
    </div>
  );
}

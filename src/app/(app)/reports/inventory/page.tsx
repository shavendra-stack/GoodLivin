import Link from "next/link";
import { Boxes, History, PackageCheck } from "lucide-react";
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

export default async function InventoryReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const filters = await searchParams;
  const model = await getReportModel(user, filters);

  if (!model.access.inventory) {
    return <AccessDenied description="Your role does not include operational inventory reporting access." />;
  }

  return (
    <div className="space-y-7">
      <ReportPageHeader
        eyebrow="Stage 7 · Inventory reports"
        title="Inventory reports"
        description="Live stock balances by location, product, SKU, batch, condition and movement history. Incoming purchase orders are shown as projected stock only, never as available stock."
        icon={PackageCheck}
        generatedAt={model.generatedAt}
        actions={<><ExportLink kind="inventory" filters={filters} enabled={model.access.export} /><Link href="/reports" className="inline-flex h-10 items-center justify-center rounded-xl border border-forest-200 bg-white px-4 text-sm font-semibold text-forest-800">Reports hub</Link></>}
      />

      {model.error ? <InlineMessage kind="error">{model.error}</InlineMessage> : null}

      <form action="/reports/inventory" method="get" className="grid gap-3 rounded-2xl border border-forest-100/80 bg-white p-4 shadow-soft md:grid-cols-2 xl:grid-cols-6">
        <Input name="q" defaultValue={filters.q} placeholder="Search product, batch, location" />
        <Select name="productId" defaultValue={filters.productId ?? "all"}><option value="all">All products</option>{model.refs.products.map((row) => <option key={row.id} value={row.id}>{row.label} · {row.code}</option>)}</Select>
        <Select name="skuId" defaultValue={filters.skuId ?? "all"}><option value="all">All SKUs</option>{model.refs.skus.map((row) => <option key={row.id} value={row.id}>{row.label} · {row.code}</option>)}</Select>
        <Select name="locationId" defaultValue={filters.locationId ?? "all"}><option value="all">All locations</option>{model.refs.locations.map((row) => <option key={row.id} value={row.id}>{row.label} · {row.code}</option>)}</Select>
        <Select name="condition" defaultValue={filters.condition ?? "all"}><option value="all">All conditions</option>{conditions.map((condition) => <option key={condition} value={condition}>{condition}</option>)}</Select>
        <Button type="submit" variant="secondary">Apply filters</Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Physical stock" value={model.inventory.physicalStock.toLocaleString()} detail="Posted ledger stock on hand." />
        <MetricCard label="Available stock" value={model.inventory.availableStock.toLocaleString()} detail="Sellable, approved, non-expired units." tone="success" />
        <MetricCard label="Incoming stock" value={model.inventory.incomingStock.toLocaleString()} detail="Approved/open PO stock excluded from availability." tone="info" />
        <MetricCard label="Projected stock" value={model.inventory.projectedStock.toLocaleString()} detail="Physical + incoming, planning only." />
        <MetricCard label="Low-stock rows" value={model.inventory.lowStock.length.toLocaleString()} detail="Product/SKU and location-level warnings." tone={model.inventory.lowStock.length ? "warning" : "success"} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Boxes className="h-5 w-5 text-forest-700" />Stock by product and SKU</CardTitle><CardDescription>Physical, available, incoming and projected stock are shown separately.</CardDescription></CardHeader>
          <CardContent><SimpleBarList rows={model.inventory.byProductSku.map((row) => ({ id: row.id, label: row.productName, detail: `${row.skuCode} · ${row.available.toLocaleString()} available · ${row.incoming.toLocaleString()} incoming · ${row.projected.toLocaleString()} projected`, value: row.quantity }))} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Stock by location</CardTitle><CardDescription>Office, warehouse and retailer branch balances from the ledger.</CardDescription></CardHeader>
          <CardContent><SimpleBarList rows={model.inventory.byLocation.map((row) => ({ id: row.id, label: row.locationName, detail: `${row.locationType.replaceAll("_", " ")}${row.retailerName ? ` · ${row.retailerName}` : ""} · ${row.available.toLocaleString()} available`, value: row.quantity }))} /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live balance detail</CardTitle>
          <CardDescription>Quantity on hand by product, SKU, batch and location. Cost is masked unless your role can view financial reporting.</CardDescription>
        </CardHeader>
        <CardContent>
          {model.inventory.rows.length === 0 ? <EmptyState title="No inventory rows match" description="Adjust the filters or post stock movements to build balances." /> : (
            <DataTable rows={model.inventory.rows} rowKey={(row) => row.id} columns={[
              { key: "product", header: "Product / SKU", render: (row) => <div><p className="font-semibold">{row.productName}</p><p className="mt-1 text-xs text-slate-500">{row.productCode} · {row.skuName} · {row.skuCode}</p></div> },
              { key: "batch", header: "Batch / expiry", render: (row) => <div><p>{row.batchNumber}</p><p className="mt-1 text-xs text-slate-500">{formatDate(row.expiresOn)}</p></div> },
              { key: "location", header: "Location", render: (row) => <div><p>{row.locationName}</p><p className="mt-1 text-xs text-slate-500">{row.branchName ?? row.retailerName ?? row.locationCode}</p></div> },
              { key: "condition", header: "Condition", render: (row) => <div className="space-y-1"><StatusBadge status={row.condition} /><p className="text-xs text-slate-500">Quality: {row.qualityStatus}</p></div> },
              { key: "qty", header: "Quantity", render: (row) => <div><p className="font-semibold">{row.quantityOnHand.toLocaleString()} physical</p><p className="mt-1 text-xs text-forest-700">{row.availableQuantity.toLocaleString()} available</p></div> },
              { key: "value", header: "Value", render: (row) => model.access.financial ? <div><p>{formatLkr(row.totalValue)}</p><p className="mt-1 text-xs text-slate-500">{row.costBasis}</p></div> : <span className="text-xs text-slate-400">Restricted</span> },
            ]} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-forest-700" />Movement history extract</CardTitle><CardDescription>Receipts, transfers, adjustments, sales deductions and returns within the selected filters.</CardDescription></CardHeader>
        <CardContent>
          {model.inventory.movements.length === 0 ? <EmptyState title="No movement rows match" description="Try a wider date range or fewer filters." /> : (
            <DataTable rows={model.inventory.movements.slice(0, 100)} rowKey={(row) => row.id} columns={[
              { key: "movement", header: "Movement", render: (row) => <div><p className="font-semibold">#{row.movementNumber} · {row.movementType.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-slate-500">{formatDate(row.postedAt ?? row.createdAt)}</p></div> },
              { key: "stock", header: "Stock", render: (row) => <div><p>{row.productName}</p><p className="mt-1 text-xs text-slate-500">{row.skuCode} · {row.batchNumber}</p></div> },
              { key: "flow", header: "Flow", render: (row) => [row.sourceLocationName, row.destinationLocationName].filter(Boolean).join(" → ") || "—" },
              { key: "qty", header: "Quantity", render: (row) => `${row.quantity.toLocaleString()} units` },
              { key: "ref", header: "Reference", render: (row) => row.referenceType ?? "—" },
            ]} />
          )}
        </CardContent>
      </Card>

      <CalculationNote>
        Physical stock is calculated only from posted ledger movements. Available stock excludes non-sellable conditions. Projected stock adds approved/open incoming purchase-order quantities for planning and is never treated as available stock.
      </CalculationNote>
      <ReportLimitNote />
    </div>
  );
}

import Link from "next/link";
import { CalendarClock, ShieldAlert } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { formatDate, formatLkr } from "@/lib/utils";
import { getReportModel, type InventoryCondition, type ReportFilters } from "@/lib/reports";
import { AccessDenied, CalculationNote, ExportLink, MetricCard, ReportLimitNote, ReportPageHeader, SimpleBarList } from "@/components/reports-ui";
import { DataTable } from "@/components/data-table";
import { EmptyState, InlineMessage } from "@/components/master-data-ui";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type SearchParams = Promise<ReportFilters>;
const conditions: InventoryCondition[] = ["sellable", "damaged", "quarantined", "rejected", "expired", "pending"];
const windows = ["30", "60", "90", "180"];

export default async function ExpiryWastageReportPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const filters = await searchParams;
  const model = await getReportModel(user, filters);

  if (!model.access.expiry) return <AccessDenied description="Your role does not include expiry, wastage or stock-condition reporting access." />;

  return (
    <div className="space-y-7">
      <ReportPageHeader
        eyebrow="Stage 7 · Expiry and wastage"
        title="Expiry & wastage"
        description="Batches approaching expiry, expired quantities, damaged/quarantined/rejected stock, estimated affected value and retailer shelf-life risks."
        icon={CalendarClock}
        generatedAt={model.generatedAt}
        actions={<><ExportLink kind="expiry" filters={filters} enabled={model.access.export} /><Link href="/batches" className="inline-flex h-10 items-center justify-center rounded-xl border border-forest-200 bg-white px-4 text-sm font-semibold text-forest-800">Batches</Link></>}
      />

      {model.error ? <InlineMessage kind="error">{model.error}</InlineMessage> : null}
      {model.expiry.missingCostRows > 0 && model.access.financial ? <InlineMessage kind="info">{model.expiry.missingCostRows.toLocaleString()} affected stock row{model.expiry.missingCostRows === 1 ? "" : "s"} have missing cost data, so affected value may be incomplete.</InlineMessage> : null}

      <form action="/reports/expiry" method="get" className="grid gap-3 rounded-2xl border border-forest-100/80 bg-white p-4 shadow-soft md:grid-cols-2 xl:grid-cols-6">
        <Input name="q" defaultValue={filters.q} placeholder="Search product, batch, retailer" />
        <Select name="windowDays" defaultValue={filters.windowDays ?? "90"}>{windows.map((days) => <option key={days} value={days}>Expiring within {days} days</option>)}</Select>
        <Select name="condition" defaultValue={filters.condition ?? "all"}><option value="all">All conditions</option>{conditions.map((condition) => <option key={condition} value={condition}>{condition}</option>)}</Select>
        <Select name="productId" defaultValue={filters.productId ?? "all"}><option value="all">All products</option>{model.refs.products.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</Select>
        <Select name="retailerId" defaultValue={filters.retailerId ?? "all"}><option value="all">All retailers</option>{model.refs.retailers.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</Select>
        <Button type="submit" variant="secondary">Apply filters</Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Approaching expiry" value={model.expiry.approachingQuantity.toLocaleString()} detail={`Within ${filters.windowDays ?? 90} days.`} tone="warning" />
        <MetricCard label="Expired quantity" value={model.expiry.expiredQuantity.toLocaleString()} detail="Already expired or stored in expired stock." tone={model.expiry.expiredQuantity ? "danger" : "success"} />
        <MetricCard label="Wastage movements" value={model.expiry.wastageRows.length.toLocaleString()} detail="Damage and wastage ledger entries in selected filters." />
        <MetricCard label="Shelf-life risks" value={model.expiry.retailerShelfLifeRisks.length.toLocaleString()} detail="Retailer branch stock below active agreement shelf-life requirement." tone={model.expiry.retailerShelfLifeRisks.length ? "warning" : "success"} />
        <MetricCard label="Affected value" value={model.access.financial ? formatLkr(model.expiry.affectedValue) : "Restricted"} detail={model.access.financial ? "Uses available cost basis." : model.access.restrictedFinancialReason} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader><CardTitle>FEFO risk queue</CardTitle><CardDescription>Nearest expiry quantities that should be reviewed before slower-moving stock.</CardDescription></CardHeader>
          <CardContent><SimpleBarList rows={model.expiry.rows.map((row) => ({ id: row.id, label: `${row.productName} · ${row.skuCode}`, detail: `${row.batchNumber} · ${row.daysUntilExpiry === null ? "No expiry" : `${row.daysUntilExpiry} days`} · ${row.locationName}`, value: row.quantityOnHand }))} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-amber-700" />Retailer shelf-life checks</CardTitle><CardDescription>Flags stock that may fail each retailer’s minimum shelf-life requirement at delivery/sale time.</CardDescription></CardHeader>
          <CardContent>
            {model.expiry.retailerShelfLifeRisks.length === 0 ? <p className="text-sm text-slate-500">No retailer shelf-life risks in the visible stock.</p> : (
              <div className="space-y-3">
                {model.expiry.retailerShelfLifeRisks.slice(0, 6).map((row) => (
                  <div key={row.id} className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="font-semibold">{row.retailerName} · {row.branchName}</p>
                    <p className="mt-1">{row.productName} · {row.skuCode} · {row.batchNumber}</p>
                    <p className="mt-1 text-xs">{row.quantity.toLocaleString()} units · {row.daysUntilExpiry} days remaining, requirement {row.requiredShelfLifeDays} days.</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Expiry and stock-condition detail</CardTitle><CardDescription>Includes sellable near-expiry rows and restricted-condition stock.</CardDescription></CardHeader>
        <CardContent>
          {model.expiry.rows.length === 0 ? <EmptyState title="No expiry rows match" description="Try a wider expiry window or fewer filters." /> : (
            <DataTable rows={model.expiry.rows} rowKey={(row) => row.id} columns={[
              { key: "stock", header: "Product / SKU", render: (row) => <div><p className="font-semibold">{row.productName}</p><p className="mt-1 text-xs text-slate-500">{row.skuCode} · {row.batchNumber}</p></div> },
              { key: "location", header: "Location", render: (row) => <div><p>{row.locationName}</p><p className="mt-1 text-xs text-slate-500">{row.branchName ?? row.retailerName ?? row.locationCode}</p></div> },
              { key: "expiry", header: "Expiry", render: (row) => <div><p>{formatDate(row.expiresOn)}</p><p className="mt-1 text-xs text-slate-500">{row.daysUntilExpiry === null ? "No expiry" : `${row.daysUntilExpiry} days`}</p></div> },
              { key: "condition", header: "Condition", render: (row) => <StatusBadge status={row.condition} /> },
              { key: "qty", header: "Quantity", render: (row) => `${row.quantityOnHand.toLocaleString()} units` },
              { key: "value", header: "Estimated value", render: (row) => model.access.financial ? (row.totalValue === null ? <span className="text-amber-700">Missing cost</span> : formatLkr(row.totalValue)) : <span className="text-xs text-slate-400">Restricted</span> },
            ]} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Damage and wastage movement history</CardTitle><CardDescription>Posted damage and wastage movements remain immutable; corrections must be new ledger entries.</CardDescription></CardHeader>
        <CardContent>
          {model.expiry.wastageRows.length === 0 ? <EmptyState title="No wastage movements" description="Damage and wastage ledger movements will appear here." /> : (
            <DataTable rows={model.expiry.wastageRows.slice(0, 100)} rowKey={(row) => row.id} columns={[
              { key: "movement", header: "Movement", render: (row) => <div><p className="font-semibold">#{row.movementNumber} · {row.movementType}</p><p className="mt-1 text-xs text-slate-500">{formatDate(row.postedAt ?? row.createdAt)}</p></div> },
              { key: "stock", header: "Stock", render: (row) => <div><p>{row.productName}</p><p className="mt-1 text-xs text-slate-500">{row.skuCode} · {row.batchNumber}</p></div> },
              { key: "location", header: "Location", render: (row) => [row.sourceLocationName, row.destinationLocationName].filter(Boolean).join(" → ") || "—" },
              { key: "qty", header: "Quantity", render: (row) => `${row.quantity.toLocaleString()} units` },
              { key: "reason", header: "Reason", render: (row) => row.reason ?? "—" },
            ]} />
          )}
        </CardContent>
      </Card>

      <CalculationNote>
        FEFO risk uses current visible stock and batch expiry dates. Expired, damaged, quarantined and rejected quantities remain separate from sellable stock and are never silently considered available.
      </CalculationNote>
      <ReportLimitNote />
    </div>
  );
}

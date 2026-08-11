import Link from "next/link";
import { GitBranch, PackageSearch } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { getReportModel, type ReportFilters } from "@/lib/reports";
import { AccessDenied, CalculationNote, ExportLink, MetricCard, ReportLimitNote, ReportPageHeader } from "@/components/reports-ui";
import { DataTable } from "@/components/data-table";
import { EmptyState, InlineMessage } from "@/components/master-data-ui";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type SearchParams = Promise<ReportFilters>;

export default async function TraceabilityReportPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const filters = await searchParams;
  const model = await getReportModel(user, filters);

  if (!model.access.traceability) return <AccessDenied description="Your role does not include batch traceability reporting access." />;

  return (
    <div className="space-y-7">
      <ReportPageHeader
        eyebrow="Stage 7 · Traceability"
        title="Batch traceability"
        description="Follow one batch through supplier/manufacturer records, purchase-order receiving, current holdings, transfers, retailer reports, sales, returns and adjustments."
        icon={GitBranch}
        generatedAt={model.generatedAt}
        actions={<><ExportLink kind="traceability" filters={filters} enabled={model.access.export && Boolean(model.traceability.selectedBatchId)} /><Link href="/batches" className="inline-flex h-10 items-center justify-center rounded-xl border border-forest-200 bg-white px-4 text-sm font-semibold text-forest-800">Batch register</Link></>}
      />

      {model.error ? <InlineMessage kind="error">{model.error}</InlineMessage> : null}

      <form action="/reports/traceability" method="get" className="grid gap-3 rounded-2xl border border-forest-100/80 bg-white p-4 shadow-soft md:grid-cols-[1fr_auto]">
        <Select name="batchId" defaultValue={model.traceability.selectedBatchId ?? ""}>
          <option value="">Select a batch</option>
          {model.refs.batches.map((row) => <option key={row.id} value={row.id}>{row.label} · {row.code}</option>)}
        </Select>
        <Button type="submit" variant="secondary">Trace batch</Button>
      </form>

      {!model.traceability.selectedBatchId ? <EmptyState title="Select a batch to trace" description="Choose a batch to see its full Stage 1–6 history." /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Selected batch" value={model.traceability.selectedBatch?.label ?? "—"} detail={model.traceability.selectedBatch?.code ?? "SKU not recorded"} />
            <MetricCard label="Current holdings" value={model.traceability.holdings.reduce((sum, row) => sum + row.quantityOnHand, 0).toLocaleString()} detail={`${model.traceability.holdings.length.toLocaleString()} visible location rows.`} tone="success" />
            <MetricCard label="Timeline events" value={model.traceability.events.length.toLocaleString()} detail="Receipts, movements, sales and reports." />
            <MetricCard label="Quality status" value={model.traceability.production.qualityStatus.replaceAll("_", " ")} detail={`Batch status: ${model.traceability.production.status}`} tone={model.traceability.production.qualityStatus === "approved" ? "success" : "warning"} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><PackageSearch className="h-5 w-5 text-forest-700" />Batch identity</CardTitle><CardDescription>Supplier/manufacturer and production metadata.</CardDescription></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-xl border border-forest-100 p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Supplier / manufacturer</p><p className="mt-1 font-semibold text-ink">{model.traceability.supplierOrManufacturer}</p></div>
                <div className="rounded-xl border border-forest-100 p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Manufactured</p><p className="mt-1 font-semibold text-ink">{formatDate(model.traceability.production.manufacturedOn)}</p></div>
                <div className="rounded-xl border border-forest-100 p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Expires</p><p className="mt-1 font-semibold text-ink">{formatDate(model.traceability.production.expiresOn)}</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Current holdings</CardTitle><CardDescription>Warehouse and retailer branch quantities currently visible through RLS.</CardDescription></CardHeader>
              <CardContent>
                {model.traceability.holdings.length === 0 ? <EmptyState title="No current holdings" description="This batch has no visible current stock balance." /> : (
                  <DataTable rows={model.traceability.holdings} rowKey={(row) => row.id} columns={[
                    { key: "location", header: "Location", render: (row) => <div><p className="font-semibold">{row.locationName}</p><p className="mt-1 text-xs text-slate-500">{row.branchName ?? row.retailerName ?? row.locationCode}</p></div> },
                    { key: "condition", header: "Condition", render: (row) => <StatusBadge status={row.condition} /> },
                    { key: "quantity", header: "Quantity", render: (row) => `${row.quantityOnHand.toLocaleString()} units` },
                    { key: "available", header: "Available", render: (row) => `${row.availableQuantity.toLocaleString()} units` },
                  ]} />
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Traceability timeline</CardTitle><CardDescription>Historical ledger and workflow entries are read-only; Stage 7 does not alter or delete them.</CardDescription></CardHeader>
            <CardContent>
              {model.traceability.events.length === 0 ? <EmptyState title="No traceability events" description="Receipts and posted movements will appear when available." /> : (
                <DataTable rows={model.traceability.events} rowKey={(row) => row.id} columns={[
                  { key: "date", header: "Date", render: (row) => formatDate(row.date) },
                  { key: "event", header: "Event", render: (row) => <div><p className="font-semibold capitalize">{row.eventType}</p><p className="mt-1 text-xs text-slate-500">{row.reference}</p></div> },
                  { key: "direction", header: "Direction", render: (row) => <StatusBadge status={row.direction} /> },
                  { key: "location", header: "Location / flow", render: (row) => row.location },
                  { key: "qty", header: "Quantity", render: (row) => `${row.quantity.toLocaleString()} units` },
                  { key: "details", header: "Details", render: (row) => <span className="max-w-[240px] text-sm text-slate-600">{row.details}</span> },
                ]} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Related sales and retailer reports</CardTitle><CardDescription>Shows sales/report records directly tied to the selected batch where Stage 5 stored a batch relationship.</CardDescription></CardHeader>
            <CardContent>
              {model.traceability.relatedSales.length === 0 ? <EmptyState title="No related sales rows" description="Sales or retailer reports will appear once linked to this batch." /> : (
                <DataTable rows={model.traceability.relatedSales} rowKey={(row) => `${row.recordType}-${row.id}`} columns={[
                  { key: "ref", header: "Reference", render: (row) => <div><p className="font-semibold">{row.reference}</p><p className="mt-1 text-xs text-slate-500">{formatDate(row.date)} · {row.recordType.replaceAll("_", " ")}</p></div> },
                  { key: "channel", header: "Channel", render: (row) => row.channel.replaceAll("_", " ") },
                  { key: "retailer", header: "Retailer / branch", render: (row) => row.branchName ?? row.retailerName ?? "—" },
                  { key: "qty", header: "Units", render: (row) => `${row.unitsSold.toLocaleString()} sold · ${row.returnedUnits.toLocaleString()} returned` },
                  { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
                ]} />
              )}
            </CardContent>
          </Card>
        </>
      )}

      <CalculationNote>
        Traceability follows existing authoritative records. It does not modify historical ledger movements, purchase-order receipts, sales records, retailer reports or audit logs.
      </CalculationNote>
      <ReportLimitNote />
    </div>
  );
}

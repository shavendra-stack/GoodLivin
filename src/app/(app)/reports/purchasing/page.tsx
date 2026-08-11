import Link from "next/link";
import { ClipboardList, Truck } from "lucide-react";
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

const poStatuses = ["draft", "pending_approval", "approved", "sent_to_supplier", "in_production", "partially_ready", "ready_for_dispatch", "in_transit", "partially_received", "fully_received", "cancelled"];

export default async function PurchasingReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const filters = await searchParams;
  const model = await getReportModel(user, filters);

  if (!model.access.purchasing) return <AccessDenied description="Your role does not include purchasing, inbound or supplier reporting access." />;

  return (
    <div className="space-y-7">
      <ReportPageHeader
        eyebrow="Stage 7 · Purchasing and supplier reports"
        title="Purchasing & supplier reports"
        description="Purchase orders by status, incoming quantities, receipt variance, supplier lead time and payment milestones. This is procurement reporting only, not a full accounting system."
        icon={ClipboardList}
        generatedAt={model.generatedAt}
        actions={<><ExportLink kind="purchasing" filters={filters} enabled={model.access.export} /><Link href="/purchase-orders" className="inline-flex h-10 items-center justify-center rounded-xl border border-forest-200 bg-white px-4 text-sm font-semibold text-forest-800">Purchase orders</Link></>}
      />

      {model.error ? <InlineMessage kind="error">{model.error}</InlineMessage> : null}

      <form action="/reports/purchasing" method="get" className="grid gap-3 rounded-2xl border border-forest-100/80 bg-white p-4 shadow-soft md:grid-cols-2 xl:grid-cols-7">
        <Input type="date" name="from" defaultValue={model.range.from} aria-label="Purchasing report start date" />
        <Input type="date" name="to" defaultValue={model.range.to} aria-label="Purchasing report end date" />
        <Input name="q" defaultValue={filters.q} placeholder="Search PO, supplier, SKU" />
        <Select name="status" defaultValue={filters.status ?? "all"}><option value="all">All statuses</option>{poStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</Select>
        <Select name="supplierId" defaultValue={filters.supplierId ?? "all"}><option value="all">All suppliers/manufacturers</option>{model.refs.suppliers.map((row) => <option key={row.id} value={row.id}>{row.label} · {row.code}</option>)}</Select>
        <Select name="productId" defaultValue={filters.productId ?? "all"}><option value="all">All products</option>{model.refs.products.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</Select>
        <Button type="submit" variant="secondary">Apply</Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Open purchase orders" value={model.purchasing.openOrders.toLocaleString()} detail="Draft through partially received." />
        <MetricCard label="Incoming stock" value={model.purchasing.incomingUnits.toLocaleString()} detail="Approved/open outstanding quantities; not available stock." tone="info" />
        <MetricCard label="Overdue order lines" value={model.purchasing.overdueLines.toLocaleString()} detail="Outstanding lines past expected delivery." tone={model.purchasing.overdueLines ? "danger" : "success"} />
        <MetricCard label="PO value" value={model.access.financial ? formatLkr(model.purchasing.totalOrderValue) : "Restricted"} detail={model.access.financial ? "Visible procurement value." : model.access.restrictedFinancialReason} />
        <MetricCard label="Outstanding payments" value={model.access.financial ? formatLkr(model.purchasing.outstandingPayments) : "Restricted"} detail="Payment milestones only; no accounting ledger." tone="warning" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5 text-forest-700" />Supplier delivery performance</CardTitle><CardDescription>Ordered, received and outstanding quantities, with average lead time where receipt history exists.</CardDescription></CardHeader>
          <CardContent>
            {model.purchasing.supplierRows.length === 0 ? <EmptyState title="No supplier performance rows" description="Create or receive purchase orders to build supplier reporting." /> : (
              <DataTable rows={model.purchasing.supplierRows} rowKey={(row) => row.id} columns={[
                { key: "supplier", header: "Supplier / manufacturer", render: (row) => <p className="font-semibold">{row.supplierName}</p> },
                { key: "qty", header: "Ordered / received", render: (row) => <div><p>{row.receivedQuantity.toLocaleString()} / {row.orderedQuantity.toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">{row.outstandingQuantity.toLocaleString()} outstanding</p></div> },
                { key: "open", header: "Open / overdue", render: (row) => <div><p>{row.openOrders.toLocaleString()} open lines</p><p className="mt-1 text-xs text-slate-500">{row.overdueLines.toLocaleString()} overdue</p></div> },
                { key: "lead", header: "Lead time", render: (row) => row.averageLeadTimeDays === null ? "No receipts yet" : `${row.averageLeadTimeDays.toFixed(1)} days` },
                { key: "value", header: "Value / paid", render: (row) => model.access.financial ? <div><p>{formatLkr(row.totalValue)}</p><p className="mt-1 text-xs text-slate-500">Paid {formatLkr(row.amountPaid)} · due {formatLkr(row.balanceRemaining)}</p></div> : <span className="text-xs text-slate-400">Restricted</span> },
              ]} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Outstanding quantities</CardTitle><CardDescription>Top purchase-order lines by remaining quantity.</CardDescription></CardHeader>
          <CardContent><SimpleBarList rows={model.purchasing.rows.filter((row) => row.quantityOutstanding > 0).map((row) => ({ id: row.id, label: `${row.poNumber} · ${row.skuCode}`, detail: `${row.supplierName ?? row.manufacturerName ?? "Supplier"} · ${row.status.replaceAll("_", " ")}`, value: row.quantityOutstanding }))} /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Purchase-order line detail</CardTitle><CardDescription>Incoming stock is the outstanding quantity on approved/open statuses only. Draft and pending approval orders are not counted as incoming.</CardDescription></CardHeader>
        <CardContent>
          {model.purchasing.rows.length === 0 ? <EmptyState title="No purchase-order rows match" description="Adjust the filters or create purchase orders." /> : (
            <DataTable rows={model.purchasing.rows} rowKey={(row) => row.id} columns={[
              { key: "po", header: "Purchase order", render: (row) => <div><p className="font-semibold">{row.poNumber}</p><p className="mt-1 text-xs text-slate-500">{formatDate(row.orderDate)} · {row.supplierName ?? row.manufacturerName ?? "Supplier/manufacturer"}</p></div> },
              { key: "stock", header: "Product / SKU", render: (row) => <div><p>{row.productName}</p><p className="mt-1 text-xs text-slate-500">{row.skuCode} · {row.receivingLocationName}</p></div> },
              { key: "qty", header: "Ordered / received", render: (row) => <div><p className="font-semibold">{row.quantityReceived.toLocaleString()} / {row.quantityOrdered.toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">{row.quantityOutstanding.toLocaleString()} outstanding</p></div> },
              { key: "delivery", header: "Delivery", render: (row) => <div><p>{formatDate(row.expectedDeliveryDate)}</p>{row.daysOverdue > 0 ? <p className="mt-1 text-xs font-semibold text-red-700">{row.daysOverdue} days overdue</p> : null}</div> },
              { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
              { key: "value", header: "Line value", render: (row) => model.access.financial ? <div><p>{formatLkr(row.lineValue)}</p><p className="mt-1 text-xs text-slate-500">{formatLkr(row.unitCost)} / unit</p></div> : <span className="text-xs text-slate-400">Restricted</span> },
            ]} />
          )}
        </CardContent>
      </Card>

      <CalculationNote>
        Purchase-order reports use Stage 6 procurement data. Incoming stock is outstanding approved/open PO quantity and does not change inventory until accepted receiving posts a ledger movement.
      </CalculationNote>
      <ReportLimitNote />
    </div>
  );
}

import Link from "next/link";
import { ArrowRight, Boxes, CalendarClock, PackagePlus, Truck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { getInboundPlanning, getPurchaseOrderWorkspace } from "@/lib/procurement";
import { DataTable } from "@/components/data-table";
import { EmptyState, InlineMessage } from "@/components/master-data-ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function InboundPage() {
  await requireUser();
  const planning = await getInboundPlanning();
  const orders = await getPurchaseOrderWorkspace({ status: "all" });
  const openOrders = orders.rows.filter((row) => !["fully_received", "cancelled"].includes(row.status));
  const overdue = openOrders.filter((row) => row.daysOverdue > 0);

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-forest-600">Stage 6 · Inbound stock planning</p>
          <h1 className="mt-2 flex items-center gap-3 font-display text-3xl font-bold tracking-tight text-ink">
            <Truck className="h-8 w-8 text-forest-700" />
            Incoming stock
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            See physical stock, open ordered quantities and projected stock separately. Incoming units are never available for sales or transfers.
          </p>
        </div>
        <Link href="/purchase-orders" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-forest-700 px-4 text-sm font-semibold text-white">
          Purchase orders <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {planning.error || orders.error ? <InlineMessage kind="error">{planning.error ?? orders.error}</InlineMessage> : null}

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Open order lines</p>
            <p className="mt-2 font-display text-3xl font-bold text-ink">{openOrders.length}</p>
            <p className="mt-2 text-xs text-slate-500">Approved through partially received.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Overdue lines</p>
            <p className="mt-2 font-display text-3xl font-bold text-red-700">{overdue.length}</p>
            <p className="mt-2 text-xs text-slate-500">Based on expected delivery date.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Incoming units</p>
            <p className="mt-2 font-display text-3xl font-bold text-forest-800">
              {planning.rows.reduce((sum, row) => sum + row.incomingStock, 0).toLocaleString()}
            </p>
            <p className="mt-2 text-xs text-slate-500">Ordered but not yet accepted.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Reorder suggestions</p>
            <p className="mt-2 flex items-center gap-2 font-display text-3xl font-bold text-amber-700">
              <PackagePlus className="h-6 w-6" />
              {planning.rows.reduce((sum, row) => sum + row.recommendedReorderQuantity, 0).toLocaleString()}
            </p>
            <p className="mt-2 text-xs text-slate-500">Stage 5 suggestions remain advisory.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-forest-700" />
            Physical versus projected stock
          </CardTitle>
          <CardDescription>Projected stock is a planning figure only; it does not change the Stage 4 balance view.</CardDescription>
        </CardHeader>
        <CardContent>
          {planning.rows.length === 0 ? (
            <EmptyState title="No inbound planning rows" description="Active products and SKUs will appear here when the connected database has planning data." />
          ) : (
            <DataTable
              rows={planning.rows}
              rowKey={(row) => row.skuId}
              columns={[
                {
                  key: "sku",
                  header: "Product / SKU",
                  render: (row) => (
                    <div>
                      <p className="font-semibold">{row.productName}</p>
                      <p className="mt-1 text-xs text-slate-500">{row.productCode} · {row.sellableName} · {row.skuCode}</p>
                    </div>
                  ),
                },
                {
                  key: "physical",
                  header: "Available now",
                  render: (row) => <span className="font-semibold text-ink">{row.currentAvailableStock.toLocaleString()} units</span>,
                },
                {
                  key: "incoming",
                  header: "Incoming",
                  render: (row) => (
                    <div>
                      <p className="font-semibold text-forest-800">{row.incomingStock.toLocaleString()} units</p>
                      <p className="mt-1 text-xs text-slate-500">Not sellable yet</p>
                    </div>
                  ),
                },
                {
                  key: "projected",
                  header: "Projected",
                  render: (row) => <span className="font-semibold">{row.projectedStockAfterIncoming.toLocaleString()} units</span>,
                },
                {
                  key: "reorder",
                  header: "Recommended PO",
                  render: (row) => row.recommendedReorderQuantity > 0 ? (
                    <div className="space-y-2">
                      <Badge tone="warning">{row.recommendedReorderQuantity.toLocaleString()} suggested</Badge>
                      <Link
                        href={`/purchase-orders?source=reorder&productId=${row.productId}&skuId=${row.skuId}&quantity=${row.recommendedReorderQuantity}#new-purchase-order`}
                        className="inline-flex h-8 items-center gap-1 rounded-xl border border-forest-200 px-2.5 text-xs font-semibold text-forest-800 hover:bg-forest-50"
                      >
                        Review draft <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  ) : <Badge tone="success">Covered</Badge>,
                },
              ]}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-forest-700" />
            Open inbound orders
          </CardTitle>
          <CardDescription>Expected delivery and outstanding quantities by purchase-order line.</CardDescription>
        </CardHeader>
        <CardContent>
          {openOrders.length === 0 ? (
            <p className="text-sm text-slate-500">No open inbound orders.</p>
          ) : (
            <div className="space-y-3">
              {openOrders.slice(0, 20).map((row) => (
                <Link
                  href={`/purchase-orders/${row.id}`}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-forest-100 p-4 transition hover:border-forest-300 hover:bg-forest-50/40 sm:flex-row sm:items-center"
                  key={`${row.id}-${row.lineId}`}
                >
                  <div>
                    <p className="font-semibold text-ink">{row.poNumber} · {row.productName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.supplierName ?? "Manufacturer"} · {row.skuCode} · {row.quantityReceived.toLocaleString()} received of {row.quantityOrdered.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 sm:text-right">
                    <div>
                      <p className="font-semibold text-forest-800">{row.quantityOutstanding.toLocaleString()} outstanding</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.expectedDeliveryDate ? formatDate(row.expectedDeliveryDate) : "No delivery date"}
                        {row.daysOverdue > 0 ? ` · ${row.daysOverdue}d overdue` : ""}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-forest-600" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

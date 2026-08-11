import Link from "next/link";
import { ClipboardCheck, PackageCheck, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { getPurchaseOrderWorkspace } from "@/lib/procurement";
import { receivePurchaseOrderLine } from "@/app/(app)/procurement-actions";
import { EmptyState, FormField, InlineMessage } from "@/components/master-data-ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type SearchParams = Promise<{ po?: string; error?: string; saved?: string }>;

const fileInputClass = "block w-full rounded-xl border border-forest-100 bg-white px-3.5 py-3 text-sm text-ink shadow-sm file:mr-3 file:rounded-lg file:border-0 file:bg-forest-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-forest-800";

function errorMessage(error: string) {
  if (error === "duplicate") return "That receipt reference already exists.";
  if (error === "variance") return "Receiving exceeds the ordered quantity; only Director/Admin can approve a variance with a written reason.";
  if (error === "reference") return "The selected batch or location is archived or ineligible.";
  if (error === "attachment") return "The receipt document could not be uploaded or linked. Confirm the Stage 6 completion SQL has been applied and try again.";
  if (error === "database") return "The Stage 6 database migration is not applied yet.";
  return "The purchase-order receipt could not be posted. Check quantities, batch dates and permissions.";
}

export default async function PurchaseOrderReceivingPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const workspace = await getPurchaseOrderWorkspace({ status: "all" });
  const refs = workspace.refs;
  const eligible = workspace.rows.filter((row) => ["approved", "sent_to_supplier", "in_production", "partially_ready", "ready_for_dispatch", "in_transit", "partially_received"].includes(row.status));
  const selected = params.po ? eligible.filter((row) => row.id === params.po) : eligible;
  const canReceive = user.roles.some((role) => ["director_admin", "inventory_manager", "warehouse_staff"].includes(role));

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Link href="/purchase-orders" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-forest-700">← Back to purchase orders</Link>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-forest-600">Stage 6 · Controlled receiving</p>
          <h1 className="mt-2 flex items-center gap-3 font-display text-3xl font-bold tracking-tight text-ink">
            <PackageCheck className="h-8 w-8 text-forest-700" />
            Receive against a purchase order
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Receive partial or full quantities, record accepted quality outcomes and create exactly one ledger movement for accepted stock.
          </p>
        </div>
        <Link href="/receiving" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-forest-200 bg-white px-4 text-sm font-semibold text-forest-800">
          Stage 4 receipts
        </Link>
      </div>

      {params.error ? <InlineMessage kind="error">{errorMessage(params.error)}</InlineMessage> : params.saved ? <InlineMessage>Receipt posted. Accepted stock created one immutable movement and the PO balance was updated.</InlineMessage> : null}
      {refs.error || workspace.error ? <InlineMessage kind="error">{refs.error ?? workspace.error}</InlineMessage> : null}

      {canReceive ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-forest-700" />
              Post physical receipt
            </CardTitle>
            <CardDescription>Ordered or incoming quantities never affect live stock. Only accepted quantities below do.</CardDescription>
          </CardHeader>
          <CardContent>
            {selected.length === 0 ? (
              <EmptyState title="No eligible purchase orders" description="An order must be approved and in production, dispatch or transit before it can be received." />
            ) : (
              <form action={receivePurchaseOrderLine} className="grid gap-4 md:grid-cols-2">
                <FormField label="Purchase-order line" required>
                  <Select name="purchaseOrderLineId" required defaultValue="">
                    <option value="">Select an open line</option>
                    {selected.map((row) => (
                      <option key={`${row.id}-${row.lineId}`} value={row.lineId}>
                        {row.poNumber} · {row.productName} · {row.skuCode} · {row.quantityOutstanding} outstanding
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Purchase order" required>
                  <Select name="purchaseOrderId" required defaultValue={params.po ?? ""}>
                    <option value="">Select purchase order</option>
                    {selected.map((row) => <option key={row.id} value={row.id}>{row.poNumber} · {row.supplierName ?? "Manufacturer"}</option>)}
                  </Select>
                </FormField>
                <FormField label="Receipt reference" required>
                  <Input name="receiptNumber" required placeholder="GRN-PO-2026-0001" />
                </FormField>
                <FormField label="Received on" required>
                  <Input type="date" name="receivedOn" required defaultValue={new Date().toISOString().slice(0, 10)} />
                </FormField>
                <FormField label="Receiving location" required>
                  <Select name="receivingLocationId" required defaultValue="">
                    <option value="">Select active location</option>
                    {refs.locations.map((row) => <option key={row.id} value={row.id}>{row.label} · {row.code}</option>)}
                  </Select>
                </FormField>

                <div className="rounded-2xl border border-forest-100 bg-forest-50/50 p-4 md:col-span-2">
                  <p className="flex items-center gap-2 text-sm font-semibold text-forest-800">
                    <ShieldCheck className="h-4 w-4" />
                    Quality quantities
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Accepted posts to stock. Damaged, rejected and quarantined quantities are recorded but do not become sellable inventory.
                  </p>
                </div>

                <FormField label="Accepted quantity">
                  <Input type="number" min="0" step="1" name="quantityAccepted" defaultValue="0" />
                </FormField>
                <FormField label="Damaged quantity">
                  <Input type="number" min="0" step="1" name="quantityDamaged" defaultValue="0" />
                </FormField>
                <FormField label="Rejected quantity">
                  <Input type="number" min="0" step="1" name="quantityRejected" defaultValue="0" />
                </FormField>
                <FormField label="Quarantined quantity">
                  <Input type="number" min="0" step="1" name="quantityQuarantined" defaultValue="0" />
                </FormField>
                <FormField label="Existing batch ID">
                  <Input name="batchId" placeholder="Optional UUID" />
                </FormField>
                <FormField label="New batch / lot number">
                  <Input name="batchNumber" placeholder="Required for accepted stock if no batch ID" />
                </FormField>
                <FormField label="Manufactured on">
                  <Input type="date" name="manufacturedOn" />
                </FormField>
                <FormField label="Expires on">
                  <Input type="date" name="expiresOn" />
                </FormField>
                <FormField label="Supporting document">
                  <input type="file" name="attachmentFile" className={fileInputClass} />
                </FormField>
                <FormField label="Variance reason">
                  <Input name="varianceReason" placeholder="Required only for approved Director/Admin over-receipt" />
                </FormField>
                <FormField label="Internal notes">
                  <Input name="notes" placeholder="Delivery note or inspection context" />
                </FormField>
                <div className="flex justify-end md:col-span-2">
                  <Button type="submit">Post purchase-order receipt</Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      ) : (
        <InlineMessage kind="error">Your role cannot receive purchase-order stock.</InlineMessage>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Open inbound lines</CardTitle>
          <CardDescription>Use the outstanding quantity as the control total; a receipt cannot silently increase it.</CardDescription>
        </CardHeader>
        <CardContent>
          {eligible.length === 0 ? (
            <p className="text-sm text-slate-500">No open inbound lines.</p>
          ) : (
            <div className="space-y-3">
              {eligible.map((row) => (
                <div className="flex flex-col justify-between gap-3 rounded-2xl border border-forest-100 p-4 sm:flex-row sm:items-center" key={`${row.id}-${row.lineId}`}>
                  <div>
                    <p className="font-semibold text-ink">{row.poNumber} · {row.productName}</p>
                    <p className="mt-1 text-xs text-slate-500">{row.skuCode} · expected {row.expectedDeliveryDate ? formatDate(row.expectedDeliveryDate) : "not scheduled"}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-semibold text-forest-800">{row.quantityOutstanding.toLocaleString()} outstanding</p>
                    <p className="mt-1 text-xs text-slate-500">{row.status.replaceAll("_", " ")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

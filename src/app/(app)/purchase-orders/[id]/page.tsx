import Link from "next/link";
import { ArrowLeft, CalendarClock, CreditCard, FileText, History, PackageCheck, Paperclip, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { formatDate, formatDateTime, formatLkr } from "@/lib/utils";
import { getPurchaseOrderDetail } from "@/lib/procurement";
import { changePurchaseOrderStatus, recordPurchaseOrderPayment, uploadPurchaseOrderDocument } from "@/app/(app)/procurement-actions";
import { DataTable } from "@/components/data-table";
import { EmptyState, FormField, InlineMessage } from "@/components/master-data-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string; saved?: string }>;

const statusTone: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  draft: "neutral",
  pending_approval: "warning",
  approved: "success",
  sent_to_supplier: "info",
  in_production: "info",
  partially_ready: "info",
  ready_for_dispatch: "success",
  in_transit: "info",
  partially_received: "warning",
  fully_received: "success",
  cancelled: "danger",
};

const label = (value: string) => value.replaceAll("_", " ");
const documentLabel = (value: string) => label(value).replace(/\b\w/g, (char) => char.toUpperCase());
const fileInputClass = "block w-full rounded-xl border border-forest-100 bg-white px-3.5 py-3 text-sm text-ink shadow-sm file:mr-3 file:rounded-lg file:border-0 file:bg-forest-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-forest-800";

export default async function PurchaseOrderDetailPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const result = await getPurchaseOrderDetail(id);
  const order = result.data;
  const canApprove = user.roles.includes("director_admin");
  const canManage = user.roles.some((role) => ["director_admin", "inventory_manager"].includes(role));
  const canPay = user.roles.some((role) => ["director_admin", "finance_team"].includes(role));
  const canReceive = user.roles.some((role) => ["director_admin", "inventory_manager", "warehouse_staff"].includes(role));

  if (!order) {
    return (
      <div className="space-y-5">
        <Link href="/purchase-orders" className="inline-flex items-center gap-2 text-sm font-semibold text-forest-700">
          <ArrowLeft className="h-4 w-4" />
          Back to purchase orders
        </Link>
        <InlineMessage kind="error">{result.error ?? "Purchase order not found."}</InlineMessage>
      </div>
    );
  }

  const paid = order.payments.reduce((sum, row) => sum + row.amount, 0);
  const outstanding = order.totalAmount - paid;
  const notice = query.error ? (
    <InlineMessage kind="error">
      {query.error === "attachment"
        ? "The document could not be uploaded or linked. Confirm the Stage 6 completion SQL has been applied and try again."
        : query.error === "database"
          ? "The Stage 6 database migration is not applied yet."
          : "The requested purchase-order action could not be completed."}
    </InlineMessage>
  ) : query.saved === "document" ? (
    <InlineMessage>Document uploaded, linked to this purchase order and audit recorded.</InlineMessage>
  ) : query.saved ? (
    <InlineMessage>Purchase-order change saved and audit recorded.</InlineMessage>
  ) : null;

  return (
    <div className="space-y-7">
      <div>
        <Link href="/purchase-orders" className="inline-flex items-center gap-2 text-sm font-semibold text-forest-700">
          <ArrowLeft className="h-4 w-4" />
          Back to purchase orders
        </Link>
        <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-forest-600">Purchase-order detail</p>
            <h1 className="mt-2 flex items-center gap-3 font-display text-3xl font-bold tracking-tight text-ink">
              <FileText className="h-8 w-8 text-forest-700" />
              {order.poNumber}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {order.supplierName ?? order.manufacturerName ?? "Internal procurement"} · ordered {formatDate(order.orderDate)} · receiving at {order.receivingLocationName}
            </p>
          </div>
          <Badge tone={statusTone[order.status] ?? "neutral"}>{label(order.status)}</Badge>
        </div>
      </div>

      {notice}

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Subtotal</p>
            <p className="mt-2 font-display text-2xl font-bold text-ink">{formatLkr(order.subtotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Order total</p>
            <p className="mt-2 font-display text-2xl font-bold text-forest-800">{formatLkr(order.totalAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Paid</p>
            <p className="mt-2 font-display text-2xl font-bold text-ink">{formatLkr(paid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Balance</p>
            <p className="mt-2 font-display text-2xl font-bold text-amber-700">{formatLkr(Math.max(0, outstanding))}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-forest-700" />
                Ordered lines
              </CardTitle>
              <CardDescription>Ordered, received and outstanding quantities remain separate until physical acceptance.</CardDescription>
            </CardHeader>
            <CardContent>
              {order.lines.length ? (
                <DataTable
                  rows={order.lines}
                  rowKey={(row) => row.id}
                  columns={[
                    {
                      key: "line",
                      header: "Product / SKU",
                      render: (row) => (
                        <div>
                          <p className="font-semibold">{row.productName}</p>
                          <p className="mt-1 text-xs text-slate-500">{row.productCode} · {row.sellableName} · {row.skuCode}</p>
                        </div>
                      ),
                    },
                    {
                      key: "quantity",
                      header: "Quantity",
                      render: (row) => (
                        <div>
                          <p>{row.quantityReceived.toLocaleString()} received / {row.quantityOrdered.toLocaleString()} ordered</p>
                          <p className="mt-1 text-xs text-slate-500">{row.quantityOutstanding.toLocaleString()} outstanding</p>
                        </div>
                      ),
                    },
                    {
                      key: "cost",
                      header: "Cost",
                      render: (row) => (
                        <div>
                          <p>{formatLkr(row.unitCost)} / unit</p>
                          <p className="mt-1 text-xs text-slate-500">Line {formatLkr(row.lineTotal)}</p>
                        </div>
                      ),
                    },
                    {
                      key: "status",
                      header: "State",
                      render: (row) => row.quantityOutstanding === 0 ? <Badge tone="success">Complete</Badge> : <Badge tone="warning">Open</Badge>,
                    },
                  ]}
                />
              ) : (
                <EmptyState title="No order lines" description="This order has no lines." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="h-5 w-5 text-forest-700" />
                Procurement documents
              </CardTitle>
              <CardDescription>Attach quotations, invoices, payment confirmations, delivery notes and quality documents without changing PO stock state.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.attachments.length === 0 ? (
                <p className="text-sm text-slate-500">No purchase-order documents linked yet.</p>
              ) : (
                <div className="space-y-3">
                  {order.attachments.map((attachment) => (
                    <div className="flex flex-col justify-between gap-3 rounded-2xl border border-forest-100 bg-forest-50/40 p-3 sm:flex-row sm:items-center" key={attachment.linkId}>
                      <div>
                        <p className="font-semibold text-ink">{attachment.fileName}</p>
                        <p className="mt-1 text-xs text-slate-500">{documentLabel(attachment.documentType)} · {formatDateTime(attachment.linkedAt)}</p>
                      </div>
                      {attachment.signedUrl ? (
                        <Link href={attachment.signedUrl} target="_blank" className="inline-flex h-9 items-center justify-center rounded-xl border border-forest-200 px-3 text-xs font-semibold text-forest-800">
                          View / download
                        </Link>
                      ) : (
                        <Badge tone="neutral">Stored</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {canManage ? (
                <form action={uploadPurchaseOrderDocument} className="grid gap-3 border-t border-forest-100 pt-4 sm:grid-cols-2">
                  <input type="hidden" name="id" value={id} />
                  <FormField label="Document type" required>
                    <Select name="documentType" required defaultValue="quotation">
                      <option value="quotation">Quotation</option>
                      <option value="proforma_invoice">Proforma invoice</option>
                      <option value="commercial_invoice">Commercial invoice</option>
                      <option value="payment_confirmation">Payment confirmation</option>
                      <option value="delivery_note">Delivery note</option>
                      <option value="certificate_of_analysis">Certificate of analysis</option>
                      <option value="quality_compliance">Quality compliance</option>
                      <option value="other">Other</option>
                    </Select>
                  </FormField>
                  <FormField label="File" required>
                    <input type="file" name="attachmentFile" required className={fileInputClass} />
                  </FormField>
                  <div className="flex justify-end sm:col-span-2">
                    <Button type="submit">Upload document</Button>
                  </div>
                </form>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-forest-700" />
                Receipt history
              </CardTitle>
              <CardDescription>Accepted quantities are the only receipt quantities that create stock movements.</CardDescription>
            </CardHeader>
            <CardContent>
              {order.receipts.length === 0 ? (
                <p className="text-sm text-slate-500">No receipts posted against this purchase order.</p>
              ) : (
                <div className="space-y-3">
                  {order.receipts.map((receipt) => (
                    <div className="rounded-2xl border border-forest-100 p-3" key={receipt.id}>
                      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                        <div>
                          <p className="font-semibold text-ink">{receipt.receiptNumber}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDate(receipt.receivedOn)} · batch {receipt.batchNumber ?? "existing / not applicable"}</p>
                        </div>
                        <Badge tone={receipt.quantityAccepted > 0 ? "success" : "warning"}>{receipt.totalReceived.toLocaleString()} received</Badge>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        Accepted {receipt.quantityAccepted.toLocaleString()} · damaged {receipt.quantityDamaged.toLocaleString()} · rejected {receipt.quantityRejected.toLocaleString()} · quarantined {receipt.quantityQuarantined.toLocaleString()}
                      </p>
                      {receipt.attachment?.signedUrl ? (
                        <Link href={receipt.attachment.signedUrl} target="_blank" className="mt-2 inline-flex text-xs font-semibold text-forest-700 hover:underline">
                          View receipt document
                        </Link>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-forest-700" />
                Status timeline
              </CardTitle>
              <CardDescription>Every important status change is timestamped with the acting user and reason.</CardDescription>
            </CardHeader>
            <CardContent>
              {order.timeline.length ? (
                <div className="space-y-4">
                  {order.timeline.map((item) => (
                    <div className="flex gap-3" key={item.id}>
                      <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-forest-600 ring-4 ring-forest-100" />
                      <div>
                        <p className="text-sm font-semibold capitalize text-ink">{label(item.toStatus)}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.fromStatus ? `${label(item.fromStatus)} → ` : ""}
                          {formatDateTime(item.changedAt)}
                        </p>
                        {item.reason ? <p className="mt-1 text-xs text-slate-500">{item.reason}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No status changes recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-forest-700" />
                Payments
              </CardTitle>
              <CardDescription>Payments cannot exceed the order total without an approved overpayment reason.</CardDescription>
            </CardHeader>
            <CardContent>
              {order.payments.length ? (
                <div className="space-y-3">
                  {order.payments.map((payment) => (
                    <div className="rounded-2xl border border-forest-100 bg-forest-50/40 p-3" key={payment.id}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-ink">{payment.paymentNumber}</p>
                        <span className="font-semibold">{formatLkr(payment.amount)}</span>
                      </div>
                      <p className="mt-1 text-xs capitalize text-slate-500">{label(payment.paymentType)} · {formatDate(payment.paymentDate)} · {payment.paymentMethod}</p>
                      {payment.attachment?.signedUrl ? (
                        <Link href={payment.attachment.signedUrl} target="_blank" className="mt-2 inline-flex text-xs font-semibold text-forest-700 hover:underline">
                          View payment proof
                        </Link>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No payments recorded.</p>
              )}
              {canPay ? (
                <form action={recordPurchaseOrderPayment} className="mt-5 space-y-3 border-t border-forest-100 pt-5">
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="currencyCode" value={order.currencyCode} />
                  <FormField label="Payment reference" required>
                    <Input name="paymentNumber" required placeholder="PAY-2026-0001" />
                  </FormField>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Type" required>
                      <Select name="paymentType" defaultValue="deposit">
                        <option value="deposit">Deposit</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="final">Final</option>
                        <option value="other">Other</option>
                      </Select>
                    </FormField>
                    <FormField label="Amount" required>
                      <Input type="number" min="0.01" step="0.01" name="amount" required />
                    </FormField>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Date" required>
                      <Input type="date" name="paymentDate" required defaultValue={new Date().toISOString().slice(0, 10)} />
                    </FormField>
                    <FormField label="Method" required>
                      <Input name="paymentMethod" required placeholder="Bank transfer" />
                    </FormField>
                  </div>
                  <FormField label="Reference number">
                    <Input name="referenceNumber" placeholder="Bank / invoice reference" />
                  </FormField>
                  <FormField label="Payment confirmation">
                    <input type="file" name="attachmentFile" className={fileInputClass} />
                  </FormField>
                  <FormField label="Overpayment reason">
                    <Input name="overpaymentReason" placeholder="Required only for approved overpayment" />
                  </FormField>
                  <Button type="submit">Record payment</Button>
                </form>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-forest-700" />
                Workflow controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {canApprove && order.status === "pending_approval" ? (
                <form action={changePurchaseOrderStatus}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="status" value="approved" />
                  <Button type="submit" className="w-full">
                    <ShieldCheck className="h-4 w-4" />
                    Approve order
                  </Button>
                </form>
              ) : null}
              {canManage && ["approved", "sent_to_supplier", "in_production", "partially_ready", "ready_for_dispatch"].includes(order.status) ? (
                <form action={changePurchaseOrderStatus}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="status" value={order.status === "approved" ? "sent_to_supplier" : order.status === "sent_to_supplier" ? "in_production" : order.status === "in_production" ? "partially_ready" : order.status === "partially_ready" ? "ready_for_dispatch" : "in_transit"} />
                  <Button type="submit" variant="secondary" className="w-full">Advance status</Button>
                </form>
              ) : null}
              {canReceive && ["approved", "sent_to_supplier", "in_production", "partially_ready", "ready_for_dispatch", "in_transit", "partially_received"].includes(order.status) ? (
                <Link href={`/purchase-orders/receiving?po=${id}`} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-forest-200 px-4 text-sm font-semibold text-forest-800">
                  <PackageCheck className="h-4 w-4" />
                  Receive against this PO
                </Link>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{order.notes ?? "No internal notes."}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

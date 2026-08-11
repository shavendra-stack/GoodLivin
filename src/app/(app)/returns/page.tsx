import { ArrowDownToLine, ClipboardCheck, Package, Plus, RotateCcw } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { getReturnsWorkspace, type Stage5Option } from "@/lib/stage5";
import { createInventoryReturn, postInventoryReturn } from "@/app/(app)/stage5-actions";
import { DataTable } from "@/components/data-table";
import { EmptyState, FormField, InlineMessage } from "@/components/master-data-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type SearchParams = Promise<{ error?: string; saved?: string }>;

function options(rows: Stage5Option[], name: string, placeholder: string) {
  return <Select name={name} defaultValue=""><option value="">{placeholder}</option>{rows.map((row) => <option key={row.id} value={row.id}>{row.label}{row.code ? ` · ${row.code}` : ""}</option>)}</Select>;
}

function notice(error?: string, saved?: string) {
  if (saved) return <InlineMessage>Return workflow updated. Any posted condition is reflected in the immutable ledger.</InlineMessage>;
  if (!error) return null;
  const messages: Record<string, string> = { duplicate: "That return reference already exists.", insufficient: "The return would create negative stock at the source branch.", reference: "The selected batch, SKU, location or relationship is inactive or invalid.", validation: "Check the return fields, quantity, condition and reason.", "not-authorized": "Your role cannot perform this return operation.", database: "The Stage 5 database migration is not available yet.", server: "The return could not be completed. Review the detailed server error." };
  return <InlineMessage kind="error">{messages[error] ?? messages.server}</InlineMessage>;
}

export default async function ReturnsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const result = await getReturnsWorkspace();
  const canManage = user.roles.some((role) => ["director_admin", "inventory_manager", "warehouse_staff"].includes(role));
  const today = new Date().toISOString().slice(0, 10);
  return <div className="space-y-7">
    <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-forest-600">Stage 5 · Inventory corrections</p><h1 className="mt-2 flex items-center gap-3 font-display text-3xl font-bold tracking-tight text-ink"><RotateCcw className="h-8 w-8 text-forest-700" />Returns & refunds</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Route customer and retailer returns by condition. Damaged, quarantined and expired stock is never silently made sellable.</p></div>
    {notice(params.error, params.saved)}
    {result.error ? <InlineMessage kind="error">{result.error}</InlineMessage> : null}
    {canManage ? <Card id="return-form"><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-forest-700" />Prepare a return</CardTitle><CardDescription>Saving creates a pending return; posting creates the correctly typed immutable ledger movement.</CardDescription></CardHeader><CardContent><form action={createInventoryReturn} className="grid gap-4 md:grid-cols-2"><FormField label="Return reference" required><Input name="returnNumber" required placeholder="RET-2026-0001" /></FormField><FormField label="Return date" required><Input type="date" name="returnDate" defaultValue={today} required /></FormField><FormField label="Return type" required><Select name="returnType" defaultValue="customer" required><option value="customer">Customer return to GoodLivin</option><option value="retailer">Retailer return to GoodLivin</option></Select></FormField><FormField label="Condition" required><Select name="condition" defaultValue="sellable" required><option value="sellable">Sellable — active stock location</option><option value="damaged">Damaged — damaged stock only</option><option value="quarantined">Quarantined — quarantine only</option><option value="expired">Expired — expired stock only</option></Select></FormField><FormField label="Retailer (retailer return)">{options(result.refs.retailers, "retailerId", "Not applicable")}</FormField><FormField label="Branch (retailer return)">{options(result.refs.branches, "branchId", "Not applicable")}</FormField><FormField label="Source location (retailer return)">{options(result.refs.locations, "sourceLocationId", "Not applicable")}</FormField><FormField label="Destination location" required>{options(result.refs.locations, "destinationLocationId", "Select active destination")}</FormField><FormField label="Product" required>{options(result.refs.products, "productId", "Select product")}</FormField><FormField label="Sellable SKU" required>{options(result.refs.skus, "skuId", "Select SKU")}</FormField><FormField label="Batch" required>{options(result.refs.batches, "batchId", "Select batch")}</FormField><FormField label="Quantity" required><Input type="number" name="quantity" min="1" step="1" defaultValue="1" required /></FormField><FormField label="Reason" required><Textarea name="reason" required placeholder="Return reason, condition evidence and receiving context" /></FormField><div className="flex items-center justify-end md:col-span-2"><Button type="submit"><ArrowDownToLine className="h-4 w-4" />Save pending return</Button></div></form></CardContent></Card> : <InlineMessage kind="info">Your role can view returns but cannot create or post them.</InlineMessage>}
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-forest-700" />Return history</CardTitle><CardDescription>Completed returns remain immutable and are corrected through a new reversal record.</CardDescription></CardHeader><CardContent>{result.returns.length === 0 ? <EmptyState title="No returns yet" description="Pending and posted customer or retailer returns will appear here." /> : <DataTable rows={result.returns} rowKey={(row) => row.id} columns={[{ key: "return", header: "Return", render: (row) => <div><p className="font-semibold">{row.returnNumber}</p><p className="mt-1 text-xs text-slate-500">{formatDate(row.returnDate)} · {row.returnType}</p></div> }, { key: "stock", header: "Stock", render: (row) => <div><p>{row.productName}</p><p className="mt-1 text-xs text-slate-500">{row.skuCode} · {row.batchNumber}</p></div> }, { key: "route", header: "Route", render: (row) => <div><p>{row.destinationName}</p><p className="mt-1 text-xs text-slate-500">{row.retailerName ?? "GoodLivin customer"}{row.branchName ? ` · ${row.branchName}` : ""}</p></div> }, { key: "condition", header: "Condition", render: (row) => <Badge tone={row.condition === "sellable" ? "success" : "warning"}>{row.condition}</Badge> }, { key: "quantity", header: "Quantity", render: (row) => `${row.quantity.toLocaleString()} units` }, { key: "status", header: "Status", render: (row) => <Badge tone={row.status === "posted" ? "success" : row.status === "cancelled" ? "danger" : "info"}>{row.status}</Badge> }, { key: "actions", header: "Actions", className: "text-right", render: (row) => row.status === "pending" && canManage ? <form action={postInventoryReturn}><input type="hidden" name="id" value={row.id} /><Button type="submit" size="sm"><Package className="h-3.5 w-3.5" />Post return</Button></form> : <span className="text-xs text-slate-400">Immutable</span> }]} />}</CardContent></Card>
  </div>;
}

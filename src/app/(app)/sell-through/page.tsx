import { BarChart3, ClipboardCheck, RefreshCw } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { createRetailerReconciliation } from "@/app/(app)/stage5-actions";
import { getSellThroughWorkspace, type Stage5Option } from "@/lib/stage5";
import { DataTable } from "@/components/data-table";
import { EmptyState, FormField, InlineMessage } from "@/components/master-data-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type SearchParams = Promise<{ error?: string; saved?: string }>;

function options(rows: Stage5Option[], name: string, placeholder: string) {
  return <Select name={name} defaultValue=""><option value="">{placeholder}</option>{rows.map((row) => <option key={row.id} value={row.id}>{row.label}{row.code ? ` · ${row.code}` : ""}</option>)}</Select>;
}

export default async function SellThroughPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const result = await getSellThroughWorkspace();
  const canReconcile = user.roles.some((role) => ["director_admin", "inventory_manager"].includes(role));
  const today = new Date().toISOString().slice(0, 10);
  const totalSold = result.rows.reduce((sum, row) => sum + row.sold, 0);
  const lowBranches = result.rows.filter((row) => row.currentStock <= 0).length;
  return <div className="space-y-7">
    <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-forest-600">Stage 5 · Retailer intelligence</p><h1 className="mt-2 flex items-center gap-3 font-display text-3xl font-bold tracking-tight text-ink"><BarChart3 className="h-8 w-8 text-forest-700" />Retailer sell-through</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Calculated branch performance from posted deliveries, reports and the current immutable ledger. Values are latest calculated information, not editable balances.</p></div>
    {params.saved ? <InlineMessage>Reconciliation saved. Any variance will be posted as a controlled ledger adjustment.</InlineMessage> : null}{params.error ? <InlineMessage kind="error">Check the reconciliation fields, branch relationship and permissions.</InlineMessage> : null}{result.error ? <InlineMessage kind="error">{result.error}</InlineMessage> : null}
    <div className="grid gap-4 sm:grid-cols-3"><Card><CardContent className="p-5"><p className="text-sm text-slate-500">Reported sold units</p><p className="mt-2 font-display text-3xl font-bold text-ink">{totalSold.toLocaleString()}</p><p className="mt-2 text-xs text-slate-500">Across posted retailer reports.</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm text-slate-500">Tracked branch / SKU rows</p><p className="mt-2 font-display text-3xl font-bold text-ink">{result.rows.length}</p><p className="mt-2 text-xs text-slate-500">Active retailer branch catalogue coverage.</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm text-slate-500">Zero current stock rows</p><p className="mt-2 font-display text-3xl font-bold text-amber-700">{lowBranches}</p><p className="mt-2 text-xs text-slate-500">Review replenishment suggestions before transferring.</p></CardContent></Card></div>
    <Card><CardHeader><CardTitle>Sell-through detail</CardTitle><CardDescription>Current retailer stock = deliveries − reported sales − returns sent back − damages − expired ± adjustments. The current stock column comes from the ledger; other columns come from posted reports.</CardDescription></CardHeader><CardContent>{result.rows.length === 0 ? <EmptyState title="No sell-through rows" description="Active retailer branches and products will appear once Stage 5 references and reports are available." /> : <DataTable rows={result.rows} rowKey={(row) => `${row.branchId}-${row.skuId}`} columns={[{ key: "branch", header: "Branch", render: (row) => <div><p className="font-semibold">{row.branchName}</p><p className="mt-1 text-xs text-slate-500">{row.branchCode}</p></div> }, { key: "sku", header: "Product / SKU", render: (row) => <div><p>{row.productName}</p><p className="mt-1 text-xs text-slate-500">{row.productCode} · {row.skuCode}</p></div> }, { key: "movement", header: "Flow", render: (row) => <div className="text-xs"><p>Deliveries {row.deliveries} · Sold {row.sold}</p><p className="mt-1 text-slate-500">Returns {row.returnsSentBack} · Damage {row.damaged} · Expired {row.expired}</p></div> }, { key: "stock", header: "Current stock", render: (row) => <span className={row.currentStock <= 0 ? "font-bold text-amber-700" : "font-semibold"}>{row.currentStock.toLocaleString()} units</span> }, { key: "rate", header: "Sell-through", render: (row) => <div><p className="font-semibold">{row.sellThroughPercent.toFixed(1)}%</p><p className="mt-1 text-xs text-slate-500">{row.daysSinceLastReport} days since report</p></div> }, { key: "last", header: "Latest", render: (row) => formatDate(row.lastReportDate) }]} />}</CardContent></Card>
    {canReconcile ? <Card><CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-forest-700" />Reconcile a branch count</CardTitle><CardDescription>Enter the physical count and reason. Posting compares the live balance again and creates an adjustment only for the final variance.</CardDescription></CardHeader><CardContent><form action={createRetailerReconciliation} className="grid gap-4 md:grid-cols-2"><FormField label="Reconciliation reference" required><Input name="reconciliationNumber" required placeholder="REC-BRANCH-2026-001" /></FormField><FormField label="Count date" required><Input type="date" name="countDate" defaultValue={today} required /></FormField><FormField label="Retailer" required>{options(result.refs.retailers, "retailerId", "Select retailer")}</FormField><FormField label="Branch" required>{options(result.refs.branches, "branchId", "Select branch")}</FormField><FormField label="Product" required>{options(result.refs.products, "productId", "Select product")}</FormField><FormField label="SKU" required>{options(result.refs.skus, "skuId", "Select SKU")}</FormField><FormField label="Batch" required>{options(result.refs.batches, "batchId", "Select batch")}</FormField><FormField label="Counted quantity" required><Input type="number" name="countedQuantity" min="0" step="1" defaultValue="0" required /></FormField><FormField label="Reason" required><Textarea name="reason" required placeholder="Physical count evidence, date and explanation for any variance" /></FormField><div className="flex items-center justify-end md:col-span-2"><Button type="submit"><RefreshCw className="h-4 w-4" />Save reconciliation</Button></div></form></CardContent></Card> : null}
  </div>;
}

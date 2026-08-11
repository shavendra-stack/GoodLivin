import Link from "next/link";
import { ArrowUpRight, Boxes, CalendarClock, Edit3, Eye, FileUp, Plus, ShieldAlert } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getBatchWorkspace, QUALITY_STATUSES, type BatchRecord, type ExpiryBucket, type ExpiryFilter } from "@/lib/batches";
import { formatDate, formatLkr } from "@/lib/utils";
import { archiveBatch, saveBatch } from "@/app/(app)/batch-actions";
import { BatchProductSkuFields } from "@/components/batch-form-fields";
import { ArchiveButton, EmptyState, FilterBar, FormField, InlineMessage } from "@/components/master-data-ui";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { AuditInfo } from "@/components/audit-info";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";

type SearchParams = Promise<{
  q?: string;
  status?: string;
  quality?: string;
  expiry?: ExpiryFilter;
  productId?: string;
  skuId?: string;
  manufacturerId?: string;
  edit?: string;
  saved?: string;
  demo?: string;
  error?: string;
}>;

const expiryLabels: Record<ExpiryBucket, string> = {
  expired: "Already expired",
  within_30: "Within 30 days",
  within_60: "Within 60 days",
  within_90: "Within 90 days",
  over_90: "More than 90 days",
  missing: "No expiry information",
};

const expiryTone: Record<ExpiryBucket, BadgeTone> = {
  expired: "danger",
  within_30: "warning",
  within_60: "warning",
  within_90: "info",
  over_90: "sage",
  missing: "neutral",
};

const errorMessages: Record<string, string> = {
  "duplicate-code": "That batch number is already in use for this SKU.",
  validation: "Check the dates, quantity, quality status and required product/SKU fields.",
  reference: "The selected product, SKU, manufacturer, supplier or attachment is no longer available.",
  "archived-reference": "Archived master records cannot be selected for new batches.",
  "batch-correction-required": "A correction reason is required because this batch has stock movement history.",
  "batch-has-movements": "This batch has stock transactions and cannot be hard-deleted.",
  attachment: "Upload a supported document only: PDF, JPEG, PNG, WebP, HEIC or Word file up to 10 MB.",
  "operations-only": "Warehouse Staff can only update permitted operational batch information.",
  "not-authorized": "Your role can view these batches but cannot change them.",
  server: "The batch change could not be saved.",
};

function asDate(value: string | null | undefined) {
  return value?.slice(0, 10) ?? "";
}

function ExpiryBadge({ batch }: { batch: BatchRecord }) {
  const days = batch.daysRemaining;
  const detail = days === null ? "No expiry" : days < 0 ? `${Math.abs(days)} days overdue` : `${days} days remaining`;
  return <div className="space-y-1"><Badge tone={expiryTone[batch.expiryBucket]}>{expiryLabels[batch.expiryBucket]}</Badge><p className="text-xs text-slate-500">{detail}</p></div>;
}

function BatchForm({ batch, workspace, canManage, canOperate }: { batch?: BatchRecord; workspace: Awaited<ReturnType<typeof getBatchWorkspace>>["data"]; canManage: boolean; canOperate: boolean }) {
  const products = workspace.products.filter((row) => row.status === "active" || row.id === batch?.productId);
  const skus = workspace.skus.filter((row) => row.status === "active" || row.id === batch?.skuId);
  const manufacturers = workspace.manufacturers.filter((row) => row.status === "active" || row.id === batch?.manufacturerId);
  const suppliers = workspace.suppliers.filter((row) => row.status === "active" || row.id === batch?.supplierId);
  return (
    <Card id="batch-form">
      <CardHeader>
        <CardTitle>{batch ? "Edit product batch" : "Add product batch"}</CardTitle>
        <CardDescription>Every batch is linked to one product and sellable SKU. Stock receiving and movement posting remain Stage 4.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={saveBatch} encType="multipart/form-data" className="grid gap-4 md:grid-cols-2">
          <input type="hidden" name="id" value={batch?.id ?? ""} />
          <BatchProductSkuFields products={products} skus={skus} initialProductId={batch?.productId} initialSkuId={batch?.skuId} />
          <FormField label="Batch / lot number" required>
            <Input name="batchNumber" required defaultValue={batch?.batchNumber ?? ""} placeholder="GL-MAG-2607" />
          </FormField>
          <FormField label="Manufacturer">
            <Select name="manufacturerId" defaultValue={batch?.manufacturerId ?? ""}>
              <option value="">Not specified</option>
              {manufacturers.map((manufacturer) => <option key={manufacturer.id} value={manufacturer.id}>{manufacturer.name}{manufacturer.code ? ` · ${manufacturer.code}` : ""}</option>)}
            </Select>
          </FormField>
          <FormField label="Supplier">
            <Select name="supplierId" defaultValue={batch?.supplierId ?? ""}>
              <option value="">Not specified</option>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.code ? ` · ${supplier.code}` : ""}</option>)}
            </Select>
          </FormField>
          <FormField label="Manufacturing date">
            <Input name="manufacturedOn" type="date" defaultValue={asDate(batch?.manufacturedOn)} />
          </FormField>
          <FormField label="Expiry date" required>
            <Input name="expiresOn" type="date" required defaultValue={asDate(batch?.expiresOn)} />
          </FormField>
          <FormField label="Date received">
            <Input name="receivedOn" type="date" defaultValue={asDate(batch?.receivedOn)} />
          </FormField>
          <FormField label="Initial quantity" required hint="Whole units only; receiving stock is not created from this field.">
            <Input name="initialQuantity" type="number" min="0" step="1" required defaultValue={batch?.initialQuantity ?? 0} />
          </FormField>
          {canManage ? (
            <FormField label="Unit cost (LKR)" required>
              <Input name="unitCost" type="number" min="0" step="0.01" required defaultValue={batch?.unitCost ?? 0} />
            </FormField>
          ) : (
            <>
              <FormField label="Unit cost (LKR)" hint="Warehouse Staff cannot change costs.">
                <Input value="Managed by Finance / Inventory Manager" readOnly />
              </FormField>
              <input type="hidden" name="unitCost" value="0" />
            </>
          )}
          {canManage ? (
            <FormField label="Quality status" required>
              <Select name="qualityStatus" required defaultValue={batch?.qualityStatus ?? "pending"}>
                {QUALITY_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
              </Select>
            </FormField>
          ) : (
            <>
              <FormField label="Quality status" hint="Final quality decisions are restricted to batch managers.">
                <Input value={(batch?.qualityStatus ?? "pending").replaceAll("_", " ")} readOnly />
              </FormField>
              <input type="hidden" name="qualityStatus" value="pending" />
            </>
          )}
          <FormField label="Supporting document" hint="Upload PDF, JPEG, PNG, WebP, HEIC or Word files up to 10 MB. A new upload replaces the selected existing document for this batch.">
            <Input
              name="attachmentFile"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            />
          </FormField>
          <FormField label="Use existing document">
            <Select name="attachmentId" defaultValue={batch?.attachmentId ?? ""}>
              <option value="">No existing attachment</option>
              {workspace.attachments.map((attachment) => <option key={attachment.id} value={attachment.id}>{attachment.fileName}</option>)}
            </Select>
          </FormField>
          {batch?.attachmentName ? (
            <div className="flex items-center gap-2 rounded-xl border border-forest-100 bg-forest-50 px-4 py-3 text-sm text-forest-800 md:col-span-2">
              <FileUp className="h-4 w-4" />Current supporting document: {batch.attachmentName}
            </div>
          ) : null}
          <FormField label="Internal notes">
            <textarea name="notes" defaultValue={batch?.notes ?? ""} className="min-h-24 w-full rounded-xl border bg-white px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-forest-500 focus:ring-2 focus:ring-forest-100" placeholder="Internal batch notes" />
          </FormField>
          {batch ? (
            <FormField label="Correction reason" hint="Required when traceability fields change after stock movements exist.">
              <textarea name="correctionReason" className="min-h-24 w-full rounded-xl border bg-white px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-forest-500 focus:ring-2 focus:ring-forest-100" placeholder="Explain the correction and supporting evidence" />
            </FormField>
          ) : <input type="hidden" name="correctionReason" value="" />}
          <div className="flex items-center justify-end gap-2 md:col-span-2">
            <Link href="/batches" className="inline-flex h-10 items-center px-3 text-sm font-semibold text-slate-500">Cancel</Link>
            <SubmitButton>{batch ? "Save batch changes" : "Create batch"}</SubmitButton>
          </div>
        </form>
        {canOperate && !canManage ? <p className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-800">Warehouse Staff can enter operational information. Cost, product identity, traceability dates and final quality decisions are protected.</p> : null}
      </CardContent>
    </Card>
  );
}

export default async function BatchesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const result = await getBatchWorkspace({ q: params.q, status: params.status ?? "active", quality: params.quality, expiry: params.expiry, productId: params.productId, skuId: params.skuId, manufacturerId: params.manufacturerId });
  const canManage = user.roles.some((role) => role === "director_admin" || role === "inventory_manager");
  const canOperate = canManage || user.roles.includes("warehouse_staff");
  const editing = params.edit && params.edit !== "new" ? result.data.batches.find((row) => row.id === params.edit) : undefined;
  const showFinancial = user.roles.some((role) => role === "director_admin" || role === "inventory_manager" || role === "finance_team");
  const notice = params.error ? <InlineMessage kind="error">{errorMessages[params.error] ?? "The request could not be completed."}</InlineMessage> : params.demo ? <InlineMessage kind="info">Demo mode is read-only; this is a preview.</InlineMessage> : params.saved ? <InlineMessage>Batch change saved and audit recorded.</InlineMessage> : null;
  return <div className="space-y-7"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-forest-600">Stage 3 · Traceability</p><h1 className="mt-2 flex items-center gap-3 font-display text-3xl font-bold tracking-tight text-ink"><Boxes className="h-8 w-8 text-forest-700" />Batches & expiry</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Manage batch identity, quality status, expiry risk and FEFO-ready history without creating stock movements.</p></div>{canOperate ? <Link href="/batches?edit=new#batch-form" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-forest-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-forest-800"><Plus className="h-4 w-4" />New batch</Link> : <Badge tone="neutral">Read-only batches</Badge>}</div>{notice}<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{(Object.keys(expiryLabels) as ExpiryBucket[]).map((bucket) => <Card key={bucket} className={bucket === "expired" ? "border-red-100" : undefined}><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{expiryLabels[bucket]}</p><p className="mt-2 font-display text-2xl font-bold text-ink">{result.data.summary[bucket]}</p></CardContent></Card>)}</div><div className="rounded-2xl border border-forest-100 bg-forest-50/60 p-4 text-sm text-forest-800"><CalendarClock className="mr-2 inline h-4 w-4" />Records are sorted by nearest expiry. Preparing or approving a batch does not receive stock; FEFO ranking is available for future Stage 4 allocation.</div><FilterBar action="/batches" query={params.q} status={params.status ?? "active"}><Select name="quality" defaultValue={params.quality ?? "all"} className="sm:w-44"><option value="all">All quality statuses</option>{QUALITY_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</Select><Select name="expiry" defaultValue={params.expiry ?? "all"} className="sm:w-52"><option value="all">All expiry periods</option>{(Object.entries(expiryLabels) as [ExpiryBucket, string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select><Select name="productId" defaultValue={params.productId ?? "all"} className="sm:w-52"><option value="all">All products</option>{result.data.products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.productCode}</option>)}</Select><Select name="skuId" defaultValue={params.skuId ?? "all"} className="sm:w-52"><option value="all">All SKUs</option>{result.data.skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.sellableName} · {sku.skuCode}</option>)}</Select><Select name="manufacturerId" defaultValue={params.manufacturerId ?? "all"} className="sm:w-52"><option value="all">All manufacturers</option>{result.data.manufacturers.map((manufacturer) => <option key={manufacturer.id} value={manufacturer.id}>{manufacturer.name}</option>)}</Select></FilterBar><div className="flex items-center justify-between"><div><h2 className="font-display text-xl font-bold text-ink">Batch register</h2><p className="mt-1 text-sm text-slate-500">{result.error ? "Unable to load batches." : `${result.data.batches.length} batch${result.data.batches.length === 1 ? "" : "es"} shown`}</p></div>{!showFinancial ? <p className="text-xs text-slate-400">Cost fields are restricted to Finance, Inventory Manager and Director/Admin roles.</p> : null}</div>{result.error ? <InlineMessage kind="error">{result.error}</InlineMessage> : result.data.batches.length === 0 ? <EmptyState title="No batches match" description="Adjust the search and expiry filters or create the first product batch." /> : <DataTable rows={result.data.batches} rowKey={(row) => row.id} columns={[{ key: "batch", header: "Batch / SKU", render: (row) => <div><p className="font-semibold">{row.batchNumber}</p><p className="mt-1 text-xs text-slate-500">{row.productCode} · {row.skuCode}</p><p className="mt-1 text-xs text-slate-400">{row.productName}</p></div> }, { key: "expiry", header: "Expiry", render: (row) => <div><ExpiryBadge batch={row} /><p className="mt-1 text-xs text-slate-400">{formatDate(row.expiresOn)}</p></div> }, { key: "quality", header: "Quality", render: (row) => <StatusBadge status={row.qualityStatus} /> }, { key: "quantity", header: "Initial quantity", render: (row) => <div><p>{row.initialQuantity.toLocaleString()} units</p>{showFinancial ? <p className="mt-1 text-xs text-slate-500">{formatLkr(row.unitCost)} / unit</p> : null}</div> }, { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> }, { key: "actions", header: "Actions", className: "text-right", render: (row) => <div className="flex flex-wrap justify-end gap-2"><Link href={`/batches/${row.id}`} className="inline-flex h-9 items-center gap-1 rounded-xl border border-forest-200 px-3 text-xs font-semibold text-forest-800 hover:bg-forest-50"><Eye className="h-3.5 w-3.5" />View</Link>{canOperate && row.status === "active" ? <Link href={`/batches?edit=${row.id}#batch-form`} className="inline-flex h-9 items-center gap-1 rounded-xl border border-forest-200 px-3 text-xs font-semibold text-forest-800 hover:bg-forest-50"><Edit3 className="h-3.5 w-3.5" />Edit</Link> : null}{canManage && row.status === "active" ? <ArchiveButton action={archiveBatch} id={row.id} recordLabel={row.batchNumber} /> : null}</div> }]} />}{canOperate && params.edit ? <BatchForm batch={editing} workspace={result.data} canManage={canManage} canOperate={canOperate} /> : null}<div className="grid gap-4 xl:grid-cols-2"><AuditInfo actor={user.displayName} timestamp={new Date().toISOString()} reason="Batch changes are audited. Stock receiving and allocation are intentionally deferred to Stage 4." /><Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-forest-700" />FEFO preparation</CardTitle><CardDescription>Eligible batches are ranked by earliest expiry for future stock allocation.</CardDescription></CardHeader><CardContent><Link href="/notifications" className="inline-flex items-center gap-2 text-sm font-semibold text-forest-700">Review expiry alerts <ArrowUpRight className="h-4 w-4" /></Link></CardContent></Card></div></div>;
}

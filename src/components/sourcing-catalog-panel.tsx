import { ArchiveButton, EmptyState, FormField, InlineMessage } from "@/components/master-data-ui";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { archiveSupplierCatalogItem, saveSupplierCatalogItem } from "@/app/(app)/master-data-actions";
import { formatDateTime, formatLkr } from "@/lib/utils";
import { type SupplierCatalogRecord } from "@/lib/master-data";
import { type ProcurementOption } from "@/lib/procurement";

type OwnerType = "supplier" | "manufacturer";

function formatMoney(value: number, currencyCode: string) {
  return currencyCode === "LKR" ? formatLkr(value) : `${currencyCode} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function SourcingCatalogPanel({
  ownerType,
  rows,
  owners,
  products,
  skus,
  canManage,
  error,
}: {
  ownerType: OwnerType;
  rows: SupplierCatalogRecord[];
  owners: ProcurementOption[];
  products: ProcurementOption[];
  skus: ProcurementOption[];
  canManage: boolean;
  error?: string | null;
}) {
  const ownerLabel = ownerType === "supplier" ? "supplier" : "manufacturer";
  const ownerTitle = ownerType === "supplier" ? "Supplier" : "Manufacturer";
  return (
    <Card>
      <CardHeader>
        <CardTitle>Products and SKUs supplied</CardTitle>
        <CardDescription>
          Link active products and sellable SKUs to each {ownerLabel}, with MOQ, lead time, cost, document notes and audit-safe archive status.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? <InlineMessage kind="error">{error}</InlineMessage> : null}
        {rows.length === 0 ? (
          <EmptyState title={`No ${ownerLabel} SKU links yet`} description={`Add a product/SKU link when this ${ownerLabel} becomes an approved source for GoodLivin purchasing.`} />
        ) : (
          <DataTable
            rows={rows}
            rowKey={(row) => row.id}
            columns={[
              {
                key: "source",
                header: ownerTitle,
                render: (row) => (
                  <div>
                    <p className="font-semibold">{ownerType === "supplier" ? row.supplierName : row.manufacturerName}</p>
                    <p className="mt-1 text-xs text-slate-500">{row.supplierSkuCode ?? "No external SKU code"}</p>
                  </div>
                ),
              },
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
                key: "terms",
                header: "Cost / terms",
                render: (row) => (
                  <div>
                    <p>{formatMoney(row.unitCost, row.currencyCode)} / unit</p>
                    <p className="mt-1 text-xs text-slate-500">MOQ {row.minimumOrderQuantity.toLocaleString()} · {row.leadTimeDays}d lead time</p>
                  </div>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (row) => (
                  <div className="space-y-1">
                    <StatusBadge status={row.status} />
                    {row.isDefault ? <Badge tone="success">Default source</Badge> : null}
                  </div>
                ),
              },
              {
                key: "updated",
                header: "Audit",
                render: (row) => (
                  <div>
                    <p className="text-xs text-slate-500">Updated {formatDateTime(row.updatedAt)}</p>
                    <p className="mt-1 text-xs text-slate-400">Created {formatDateTime(row.createdAt)}</p>
                  </div>
                ),
              },
              {
                key: "actions",
                header: "Actions",
                className: "text-right",
                render: (row) => canManage && row.status === "active" ? (
                  <ArchiveButton action={archiveSupplierCatalogItem} id={row.id} recordLabel={`${row.productName} · ${row.skuCode}`} hiddenFields={{ ownerType }} />
                ) : <span className="text-xs text-slate-400">Read-only</span>,
              },
            ]}
          />
        )}
        {canManage ? (
          <form action={saveSupplierCatalogItem} className="grid gap-4 rounded-[1.35rem] border border-forest-100 bg-forest-50/40 p-4 sm:grid-cols-2 xl:grid-cols-4">
            <input type="hidden" name="id" value="" />
            <input type="hidden" name="ownerType" value={ownerType} />
            {ownerType === "supplier" ? <input type="hidden" name="manufacturerId" value="" /> : <input type="hidden" name="supplierId" value="" />}
            <FormField label={ownerTitle} required>
              <Select name={ownerType === "supplier" ? "supplierId" : "manufacturerId"} required defaultValue="">
                <option value="">Select {ownerLabel}</option>
                {owners.map((row) => <option key={row.id} value={row.id}>{row.label}{row.code ? ` · ${row.code}` : ""}</option>)}
              </Select>
            </FormField>
            <FormField label="Product" required>
              <Select name="productId" required defaultValue="">
                <option value="">Select product</option>
                {products.map((row) => <option key={row.id} value={row.id}>{row.label}{row.code ? ` · ${row.code}` : ""}</option>)}
              </Select>
            </FormField>
            <FormField label="Sellable SKU" required>
              <Select name="skuId" required defaultValue="">
                <option value="">Select SKU</option>
                {skus.map((row) => <option key={row.id} value={row.id}>{row.label}{row.code ? ` · ${row.code}` : ""}</option>)}
              </Select>
            </FormField>
            <FormField label="External SKU code">
              <Input name="supplierSkuCode" placeholder="Optional supplier code" />
            </FormField>
            <FormField label="Unit cost">
              <Input type="number" min="0" step="0.01" name="unitCost" defaultValue="0" />
            </FormField>
            <FormField label="Currency">
              <Input name="currencyCode" maxLength={3} defaultValue="LKR" />
            </FormField>
            <FormField label="MOQ">
              <Input type="number" min="0" step="1" name="minimumOrderQuantity" defaultValue="0" />
            </FormField>
            <FormField label="Lead time days">
              <Input type="number" min="0" step="1" name="leadTimeDays" defaultValue="0" />
            </FormField>
            <label className="flex items-center gap-2 rounded-xl border border-forest-100 bg-white px-3.5 py-3 text-sm font-semibold text-ink shadow-sm xl:col-span-1">
              <input type="checkbox" name="isDefault" className="h-4 w-4 rounded border-forest-200 text-forest-700 focus:ring-forest-500" />
              Default source for this SKU
            </label>
            <FormField label="Internal notes">
              <Textarea name="notes" placeholder="Quotation notes, document references or sourcing context" />
            </FormField>
            <div className="flex items-end justify-end sm:col-span-2 xl:col-span-2">
              <Button type="submit">Save SKU source</Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

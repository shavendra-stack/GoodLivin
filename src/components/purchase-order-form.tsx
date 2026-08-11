"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/master-data-ui";

type Option = { id: string; label: string; code?: string | null; productId?: string };
type Line = { productId: string; skuId: string; quantityOrdered: number; unitCost: number; discountAmount: number; notes: string };
const blankLine = (): Line => ({ productId: "", skuId: "", quantityOrdered: 1, unitCost: 0, discountAmount: 0, notes: "" });

export function PurchaseOrderForm({ action, suppliers, manufacturers, products, skus, locations, initialId = "", initialSupplierId = "", initialManufacturerId = "", initialLine }: { action: (formData: FormData) => void | Promise<void>; suppliers: Option[]; manufacturers: Option[]; products: Option[]; skus: Option[]; locations: Option[]; initialId?: string; initialSupplierId?: string; initialManufacturerId?: string; initialLine?: Partial<Line> }) {
  const [lines, setLines] = useState<Line[]>([{ ...blankLine(), ...initialLine, quantityOrdered: Math.max(1, Number(initialLine?.quantityOrdered ?? 1)), unitCost: Math.max(0, Number(initialLine?.unitCost ?? 0)), discountAmount: Math.max(0, Number(initialLine?.discountAmount ?? 0)) }]);
  const serialized = useMemo(() => JSON.stringify(lines), [lines]);
  function patchLine(index: number, patch: Partial<Line>) { setLines((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch, ...(patch.productId !== undefined ? { skuId: "" } : {}) } : row)); }
  return <form action={action} className="grid gap-4 md:grid-cols-2"><input type="hidden" name="id" value={initialId} /><input type="hidden" name="lines" value={serialized} />
    <FormField label="Supplier"><Select name="supplierId" defaultValue={initialSupplierId}><option value="">Select supplier</option>{suppliers.map((row) => <option key={row.id} value={row.id}>{row.label}{row.code ? ` · ${row.code}` : ""}</option>)}</Select></FormField>
    <FormField label="Manufacturer"><Select name="manufacturerId" defaultValue={initialManufacturerId}><option value="">Select manufacturer</option>{manufacturers.map((row) => <option key={row.id} value={row.id}>{row.label}{row.code ? ` · ${row.code}` : ""}</option>)}</Select></FormField>
    <FormField label="Order date" required><Input type="date" name="orderDate" required defaultValue={new Date().toISOString().slice(0, 10)} /></FormField>
    <FormField label="Expected production completion"><Input type="date" name="expectedProductionCompletionDate" /></FormField>
    <FormField label="Expected delivery"><Input type="date" name="expectedDeliveryDate" /></FormField>
    <FormField label="Receiving location" required><Select name="receivingLocationId" required defaultValue=""><option value="">Select active location</option>{locations.map((row) => <option key={row.id} value={row.id}>{row.label}{row.code ? ` · ${row.code}` : ""}</option>)}</Select></FormField>
    <FormField label="Currency"><Input name="currencyCode" maxLength={3} defaultValue="LKR" /></FormField>
    <FormField label="Payment terms"><Input name="paymentTerms" placeholder="50% deposit · balance before dispatch" /></FormField>
    <FormField label="Deposit / advance required"><Input type="number" min="0" step="0.01" name="depositRequired" defaultValue="0" /></FormField>
    <FormField label="Order discount"><Input type="number" min="0" step="0.01" name="discountAmount" defaultValue="0" /></FormField>
    <FormField label="Tax"><Input type="number" min="0" step="0.01" name="taxAmount" defaultValue="0" /></FormField>
    <FormField label="Shipping"><Input type="number" min="0" step="0.01" name="shippingAmount" defaultValue="0" /></FormField>
    <FormField label="Additional costs"><Input type="number" min="0" step="0.01" name="additionalCosts" defaultValue="0" /></FormField>
    <div className="space-y-3 md:col-span-2"><div className="flex items-center justify-between"><div><h3 className="font-display text-base font-bold text-ink">Order lines</h3><p className="text-xs text-slate-500">Add one or more products and sellable SKUs.</p></div><Button type="button" size="sm" variant="secondary" onClick={() => setLines((rows) => [...rows, blankLine()])}><Plus className="h-4 w-4" />Add line</Button></div>{lines.map((line, index) => <div className="grid gap-3 rounded-2xl border border-forest-100 bg-forest-50/40 p-4 md:grid-cols-[1.1fr_1.3fr_100px_120px_110px_auto]" key={index}><Select aria-label={`Product line ${index + 1}`} value={line.productId} onChange={(event) => patchLine(index, { productId: event.target.value })}><option value="">Product</option>{products.map((row) => <option key={row.id} value={row.id}>{row.label} · {row.code}</option>)}</Select><Select aria-label={`SKU line ${index + 1}`} value={line.skuId} onChange={(event) => patchLine(index, { skuId: event.target.value })}><option value="">SKU</option>{skus.filter((row) => !line.productId || row.productId === line.productId).map((row) => <option key={row.id} value={row.id}>{row.label} · {row.code}</option>)}</Select><Input aria-label={`Quantity line ${index + 1}`} type="number" min="1" value={line.quantityOrdered} onChange={(event) => patchLine(index, { quantityOrdered: Number(event.target.value) })} /><Input aria-label={`Unit cost line ${index + 1}`} type="number" min="0" step="0.01" value={line.unitCost} onChange={(event) => patchLine(index, { unitCost: Number(event.target.value) })} /><Input aria-label={`Discount line ${index + 1}`} type="number" min="0" step="0.01" value={line.discountAmount} onChange={(event) => patchLine(index, { discountAmount: Number(event.target.value) })} />{lines.length > 1 ? <Button type="button" variant="ghost" aria-label={`Remove line ${index + 1}`} onClick={() => setLines((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}><Trash2 className="h-4 w-4" /></Button> : <span />}</div>)}</div>
    <FormField label="Internal notes"><textarea name="notes" className="min-h-24 w-full rounded-xl border border-forest-100 bg-white px-3.5 py-3 text-sm text-ink shadow-sm outline-none focus:border-forest-500 focus:ring-4 focus:ring-forest-100/70" placeholder="Supplier context, quotation notes or production instructions" /></FormField>
    <div className="flex items-end justify-end md:col-span-2"><Button type="submit"><Plus className="h-4 w-4" />Save draft purchase order</Button></div>
  </form>;
}

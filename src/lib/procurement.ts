import { isDemoMode } from "@/lib/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ProcurementOption = { id: string; label: string; code?: string | null; productId?: string };

export type PurchaseOrderSummary = {
  id: string; poNumber: string; status: string; orderDate: string; expectedProductionCompletionDate: string | null; expectedDeliveryDate: string | null;
  currencyCode: string; totalAmount: number; supplierId: string | null; supplierName: string | null; receivingLocationName: string;
  lineId: string; productId: string; productCode: string; productName: string; skuId: string; skuCode: string; sellableName: string;
  quantityOrdered: number; quantityReceived: number; quantityOutstanding: number; daysOverdue: number;
};

export type PurchaseOrderLine = {
  id: string; lineNumber: number; productId: string; productCode: string; productName: string; skuId: string; skuCode: string; sellableName: string;
  quantityOrdered: number; unitCost: number; discountAmount: number; lineTotal: number; quantityReceived: number; quantityOutstanding: number; notes: string | null;
};

export type PurchaseOrderRecord = {
  id: string; poNumber: string; status: string; orderDate: string; expectedProductionCompletionDate: string | null; expectedDeliveryDate: string | null;
  currencyCode: string; paymentTerms: string | null; depositRequired: number; discountAmount: number; taxAmount: number; shippingAmount: number; additionalCosts: number;
  subtotal: number; totalAmount: number; supplierId: string | null; supplierName: string | null; manufacturerId: string | null; manufacturerName: string | null;
  receivingLocationId: string; receivingLocationName: string; notes: string | null; createdBy: string; createdAt: string; updatedAt: string;
  lines: PurchaseOrderLine[]; payments: PaymentRecord[]; receipts: PurchaseOrderReceiptRecord[]; attachments: PurchaseOrderAttachmentRecord[]; timeline: TimelineRecord[];
};

export type ProcurementAttachment = { id: string; fileName: string; mimeType: string | null; byteSize: number; storageBucket: string; storagePath: string; signedUrl: string | null; createdAt: string };
export type PurchaseOrderAttachmentRecord = ProcurementAttachment & { linkId: string; documentType: string; linkedAt: string };
export type PaymentRecord = { id: string; paymentNumber: string; paymentType: string; paymentDate: string; amount: number; currencyCode: string; paymentMethod: string; referenceNumber: string | null; attachment: ProcurementAttachment | null; createdAt: string };
export type PurchaseOrderReceiptRecord = { id: string; receiptNumber: string; receivedOn: string; quantityAccepted: number; quantityDamaged: number; quantityRejected: number; quantityQuarantined: number; totalReceived: number; batchNumber: string | null; attachment: ProcurementAttachment | null; notes: string | null; createdAt: string };
export type TimelineRecord = { id: string; fromStatus: string | null; toStatus: string; reason: string | null; changedAt: string };
export type InboundPlanningRow = { productId: string; productCode: string; productName: string; skuId: string; skuCode: string; sellableName: string; currentAvailableStock: number; incomingStock: number; recommendedReorderQuantity: number; projectedStockAfterIncoming: number };

export type ProcurementReferences = {
  suppliers: ProcurementOption[]; manufacturers: ProcurementOption[]; products: ProcurementOption[]; skus: ProcurementOption[]; locations: ProcurementOption[]; error: string | null;
};

const emptyReferences: ProcurementReferences = { suppliers: [], manufacturers: [], products: [], skus: [], locations: [], error: null };
const number = (row: Record<string, unknown>, key: string) => Number(row[key] ?? 0);
const nullable = (row: Record<string, unknown>, key: string) => row[key] == null ? null : String(row[key]);
const errorMessage = (error: { message?: string } | null) => error?.message ?? "Procurement data could not be loaded.";
type ServerSupabase = NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>;

const demoReferences: ProcurementReferences = {
  suppliers: [{ id: "00000000-0000-0000-0000-000000000202", label: "Serendib Wellness Supply", code: "SWS" }],
  manufacturers: [{ id: "00000000-0000-0000-0000-000000000201", label: "GoodLivin Labs", code: "GL-LABS" }],
  products: [{ id: "00000000-0000-0000-0000-000000000210", label: "GoodLivin Magnesium Complex", code: "GL-MAG" }, { id: "00000000-0000-0000-0000-000000000212", label: "GoodLivin Omega 3", code: "GL-OMEGA" }],
  skus: [{ id: "00000000-0000-0000-0000-000000000211", label: "Magnesium Complex · 60 capsules", code: "GL-MAG-60", productId: "00000000-0000-0000-0000-000000000210" }],
  locations: [{ id: "00000000-0000-0000-0000-000000000401", label: "Kotte Main Warehouse", code: "WH-KOT" }], error: null,
};

export async function getProcurementReferences(): Promise<ProcurementReferences> {
  if (isDemoMode()) return demoReferences;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ...emptyReferences, error: "Supabase is not configured." };
  const [suppliers, manufacturers, products, skus, locations] = await Promise.all([
    supabase.from("suppliers").select("id, code, name, status").eq("status", "active").order("name"),
    supabase.from("manufacturers").select("id, code, name, status").eq("status", "active").order("name"),
    supabase.from("products").select("id, product_code, name, status").eq("status", "active").order("name"),
    supabase.from("product_skus").select("id, product_id, sku_code, sellable_name, status").eq("status", "active").order("sellable_name"),
    supabase.from("inventory_locations").select("id, code, name, status").eq("status", "active").order("name"),
  ]);
  const firstError = [suppliers, manufacturers, products, skus, locations].find((result) => result.error)?.error;
  if (firstError) return { ...emptyReferences, error: errorMessage(firstError) };
  return {
    suppliers: (suppliers.data ?? []).map((row) => ({ id: String(row.id), label: String(row.name), code: nullable(row as Record<string, unknown>, "code") })),
    manufacturers: (manufacturers.data ?? []).map((row) => ({ id: String(row.id), label: String(row.name), code: nullable(row as Record<string, unknown>, "code") })),
    products: (products.data ?? []).map((row) => ({ id: String(row.id), label: String(row.name), code: nullable(row as Record<string, unknown>, "product_code") })),
    skus: (skus.data ?? []).map((row) => ({ id: String(row.id), label: String(row.sellable_name), code: nullable(row as Record<string, unknown>, "sku_code"), productId: String(row.product_id) })),
    locations: (locations.data ?? []).map((row) => ({ id: String(row.id), label: String(row.name), code: nullable(row as Record<string, unknown>, "code") })), error: null,
  };
}

function mapInbound(row: Record<string, unknown>): PurchaseOrderSummary {
  return { id: String(row.purchase_order_id), poNumber: String(row.po_number), status: String(row.status), orderDate: String(row.order_date), expectedProductionCompletionDate: nullable(row, "expected_production_completion_date"), expectedDeliveryDate: nullable(row, "expected_delivery_date"), currencyCode: String(row.currency_code ?? "LKR"), totalAmount: number(row, "total_amount"), supplierId: nullable(row, "supplier_id"), supplierName: nullable(row, "supplier_name"), receivingLocationName: String(row.receiving_location_name ?? "Unknown location"), lineId: String(row.line_id), productId: String(row.product_id), productCode: String(row.product_code), productName: String(row.product_name), skuId: String(row.sku_id), skuCode: String(row.sku_code), sellableName: String(row.sellable_name), quantityOrdered: number(row, "quantity_ordered"), quantityReceived: number(row, "quantity_received"), quantityOutstanding: number(row, "quantity_outstanding"), daysOverdue: number(row, "days_overdue") };
}

function nestedRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as Record<string, unknown> | undefined) ?? null;
  return value as Record<string, unknown>;
}

async function mapAttachment(supabase: ServerSupabase, value: unknown): Promise<ProcurementAttachment | null> {
  const row = nestedRecord(value);
  if (!row?.id) return null;
  const storageBucket = String(row.storage_bucket ?? "goodlivin-attachments");
  const storagePath = String(row.storage_path ?? "");
  let signedUrl: string | null = null;
  if (storagePath) {
    const { data } = await supabase.storage.from(storageBucket).createSignedUrl(storagePath, 60 * 10);
    signedUrl = data?.signedUrl ?? null;
  }
  return {
    id: String(row.id),
    fileName: String(row.file_name ?? "Document"),
    mimeType: nullable(row, "mime_type"),
    byteSize: Number(row.byte_size ?? 0),
    storageBucket,
    storagePath,
    signedUrl,
    createdAt: String(row.created_at ?? ""),
  };
}

export async function getPurchaseOrderWorkspace(filters: { q?: string; status?: string } = {}) {
  const refs = await getProcurementReferences();
  if (refs.error) return { refs, rows: [] as PurchaseOrderSummary[], error: refs.error };
  if (isDemoMode()) return { refs, rows: [] as PurchaseOrderSummary[], error: null };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { refs, rows: [], error: "Supabase is not configured." };
  const result = await supabase.from("purchase_order_inbound").select("*").order("created_at", { ascending: false });
  if (result.error) return { refs, rows: [], error: errorMessage(result.error) };
  const query = filters.q?.trim().toLowerCase() ?? "";
  const rows = (result.data ?? []).map((row) => mapInbound(row as Record<string, unknown>)).filter((row) => (!filters.status || filters.status === "all" || row.status === filters.status) && (!query || [row.poNumber, row.supplierName, row.productName, row.skuCode].some((value) => String(value ?? "").toLowerCase().includes(query))));
  return { refs, rows, error: null };
}

export async function getPurchaseOrderDetail(id: string): Promise<{ data: PurchaseOrderRecord | null; error: string | null }> {
  if (isDemoMode()) return { data: null, error: null };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { data: null, error: "Supabase is not configured." };
  const [{ data: order, error: orderError }, { data: lineRows, error: lineError }, { data: paymentRows, error: paymentError }, { data: timelineRows, error: timelineError }, { data: attachmentRows, error: attachmentError }, { data: receiptRows, error: receiptError }] = await Promise.all([
    supabase.from("purchase_orders").select("*").eq("id", id).maybeSingle(),
    supabase.from("purchase_order_lines").select("*, products(product_code, name), product_skus(sku_code, sellable_name)").eq("purchase_order_id", id).order("line_number"),
    supabase.from("purchase_order_payments").select("*, attachments(id, storage_bucket, storage_path, file_name, mime_type, byte_size, created_at)").eq("purchase_order_id", id).order("payment_date", { ascending: false }),
    supabase.from("purchase_order_status_history").select("*").eq("purchase_order_id", id).order("changed_at"),
    supabase.from("purchase_order_attachments").select("id, document_type, created_at, attachments(id, storage_bucket, storage_path, file_name, mime_type, byte_size, created_at)").eq("purchase_order_id", id).order("created_at", { ascending: false }),
    supabase.from("purchase_order_receipts").select("*, attachments(id, storage_bucket, storage_path, file_name, mime_type, byte_size, created_at)").eq("purchase_order_id", id).order("created_at", { ascending: false }),
  ]);
  const firstError = orderError ?? lineError ?? paymentError ?? timelineError ?? attachmentError ?? receiptError;
  if (firstError) return { data: null, error: errorMessage(firstError) };
  if (!order) return { data: null, error: "Purchase order not found." };
  const supplier = order.supplier_id ? await supabase.from("suppliers").select("name").eq("id", order.supplier_id).maybeSingle() : { data: null };
  const manufacturer = order.manufacturer_id ? await supabase.from("manufacturers").select("name").eq("id", order.manufacturer_id).maybeSingle() : { data: null };
  const location = await supabase.from("inventory_locations").select("name").eq("id", order.receiving_location_id).maybeSingle();
  const receivedByLine = new Map<string, number>();
  (receiptRows ?? []).filter((row) => String(row.status) === "posted").forEach((row) => receivedByLine.set(String(row.purchase_order_line_id), (receivedByLine.get(String(row.purchase_order_line_id)) ?? 0) + Number(row.total_received ?? 0)));
  const lines = (lineRows ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    const product = record.products as Record<string, unknown> | null;
    const sku = record.product_skus as Record<string, unknown> | null;
    const received = receivedByLine.get(String(record.id)) ?? 0;
    return { id: String(record.id), lineNumber: Number(record.line_number), productId: String(record.product_id), productCode: String(product?.product_code ?? "—"), productName: String(product?.name ?? "Unknown product"), skuId: String(record.sku_id), skuCode: String(sku?.sku_code ?? "—"), sellableName: String(sku?.sellable_name ?? "Unknown SKU"), quantityOrdered: Number(record.quantity_ordered), unitCost: Number(record.unit_cost), discountAmount: Number(record.discount_amount), lineTotal: Number(record.line_total), quantityReceived: received, quantityOutstanding: Math.max(0, Number(record.quantity_ordered) - received), notes: nullable(record, "notes") } satisfies PurchaseOrderLine;
  });
  const attachments = await Promise.all((attachmentRows ?? []).map(async (row) => {
    const record = row as Record<string, unknown>;
    const attachment = await mapAttachment(supabase, record.attachments);
    if (!attachment) return null;
    return { ...attachment, linkId: String(record.id), documentType: String(record.document_type), linkedAt: String(record.created_at) } satisfies PurchaseOrderAttachmentRecord;
  }));
  const payments = await Promise.all((paymentRows ?? []).map(async (row) => {
    const record = row as Record<string, unknown>;
    return { id: String(record.id), paymentNumber: String(record.payment_number), paymentType: String(record.payment_type), paymentDate: String(record.payment_date), amount: Number(record.amount), currencyCode: String(record.currency_code), paymentMethod: String(record.payment_method), referenceNumber: nullable(record, "reference_number"), attachment: await mapAttachment(supabase, record.attachments), createdAt: String(record.created_at) } satisfies PaymentRecord;
  }));
  const receipts = await Promise.all((receiptRows ?? []).map(async (row) => {
    const record = row as Record<string, unknown>;
    return { id: String(record.id), receiptNumber: String(record.receipt_number), receivedOn: String(record.received_on), quantityAccepted: Number(record.quantity_accepted ?? 0), quantityDamaged: Number(record.quantity_damaged ?? 0), quantityRejected: Number(record.quantity_rejected ?? 0), quantityQuarantined: Number(record.quantity_quarantined ?? 0), totalReceived: Number(record.total_received ?? 0), batchNumber: nullable(record, "batch_number"), attachment: await mapAttachment(supabase, record.attachments), notes: nullable(record, "notes"), createdAt: String(record.created_at) } satisfies PurchaseOrderReceiptRecord;
  }));
  return { data: { id: String(order.id), poNumber: String(order.po_number), status: String(order.status), orderDate: String(order.order_date), expectedProductionCompletionDate: nullable(order, "expected_production_completion_date"), expectedDeliveryDate: nullable(order, "expected_delivery_date"), currencyCode: String(order.currency_code ?? "LKR"), paymentTerms: nullable(order, "payment_terms"), depositRequired: Number(order.deposit_required ?? 0), discountAmount: Number(order.discount_amount ?? 0), taxAmount: Number(order.tax_amount ?? 0), shippingAmount: Number(order.shipping_amount ?? 0), additionalCosts: Number(order.additional_costs ?? 0), subtotal: Number(order.subtotal ?? 0), totalAmount: Number(order.total_amount ?? 0), supplierId: nullable(order, "supplier_id"), supplierName: supplier.data?.name ?? null, manufacturerId: nullable(order, "manufacturer_id"), manufacturerName: manufacturer.data?.name ?? null, receivingLocationId: String(order.receiving_location_id), receivingLocationName: location.data?.name ?? "Unknown location", notes: nullable(order, "notes"), createdBy: String(order.created_by), createdAt: String(order.created_at), updatedAt: String(order.updated_at), lines, payments, receipts, attachments: attachments.filter((row): row is PurchaseOrderAttachmentRecord => Boolean(row)), timeline: (timelineRows ?? []).map((row) => ({ id: String(row.id), fromStatus: nullable(row as Record<string, unknown>, "from_status"), toStatus: String(row.to_status), reason: nullable(row as Record<string, unknown>, "reason"), changedAt: String(row.changed_at) })) }, error: null };
}

export async function getInboundPlanning(): Promise<{ rows: InboundPlanningRow[]; error: string | null }> {
  if (isDemoMode()) return { rows: [], error: null };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { rows: [], error: "Supabase is not configured." };
  const result = await supabase.from("inbound_stock_planning").select("*").order("product_name");
  if (result.error) return { rows: [], error: errorMessage(result.error) };
  return { rows: (result.data ?? []).map((row) => { const r = row as Record<string, unknown>; return { productId: String(r.product_id), productCode: String(r.product_code), productName: String(r.product_name), skuId: String(r.sku_id), skuCode: String(r.sku_code), sellableName: String(r.sellable_name), currentAvailableStock: number(r, "current_available_stock"), incomingStock: number(r, "incoming_stock"), recommendedReorderQuantity: number(r, "recommended_reorder_quantity"), projectedStockAfterIncoming: number(r, "projected_stock_after_incoming") }; }), error: null };
}

import { isDemoMode } from "@/lib/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const QUALITY_STATUSES = ["pending", "approved", "quarantined", "rejected", "recalled"] as const;
export type QualityStatus = (typeof QUALITY_STATUSES)[number];
export type BatchStatus = "active" | "archived";
export type ExpiryBucket = "expired" | "within_30" | "within_60" | "within_90" | "over_90" | "missing";
export type ExpiryFilter = ExpiryBucket | "all";

export type BatchRecord = {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  manufacturerId: string | null;
  manufacturerName: string | null;
  supplierId: string | null;
  supplierName: string | null;
  batchNumber: string;
  manufacturedOn: string | null;
  expiresOn: string;
  receivedOn: string | null;
  initialQuantity: number;
  unitCost: number;
  purchaseCost: number | null;
  currencyCode: string;
  qualityStatus: QualityStatus;
  attachmentId: string | null;
  attachmentName: string | null;
  notes: string | null;
  status: BatchStatus;
  archivedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
  correctionReason: string | null;
  movementCount: number;
  hasStockMovements: boolean;
  daysRemaining: number | null;
  expiryBucket: ExpiryBucket;
};

export type BatchSummary = Record<ExpiryBucket, number>;

export type BatchWorkspace = {
  batches: BatchRecord[];
  summary: BatchSummary;
  products: Array<{ id: string; productCode: string; name: string; status: string }>;
  skus: Array<{ id: string; productId: string; skuCode: string; sellableName: string; status: string }>;
  manufacturers: Array<{ id: string; name: string; code: string | null; status: string }>;
  suppliers: Array<{ id: string; name: string; code: string | null; status: string }>;
  attachments: Array<{ id: string; fileName: string; storagePath: string }>;
};

export type BatchResult = { data: BatchWorkspace; error: string | null };

export type AuditRecord = {
  id: string;
  action: string;
  reason: string | null;
  beforeSnapshot: Record<string, unknown> | null;
  afterSnapshot: Record<string, unknown> | null;
  createdAt: string;
};

export type AppNotification = {
  id: string;
  notificationType: string;
  title: string;
  message: string;
  recordType: string | null;
  recordId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type ExpiryAlert = AppNotification & {
  batchId: string;
  daysRemaining: number | null;
  expiryBucket: ExpiryBucket;
  qualityStatus: QualityStatus;
};

export type NotificationsWorkspace = {
  notifications: AppNotification[];
  expiryAlerts: ExpiryAlert[];
  thresholds: number[];
  error: string | null;
};

const DEFAULT_THRESHOLDS = [90, 60, 30];
const DAY_MS = 24 * 60 * 60 * 1000;
const DEMO_DATE = "2026-08-02T04:00:00.000Z";

function dateOnly(value: string | Date) {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function dateToUtc(value: string) {
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function daysUntilExpiry(expiresOn: string | null, today: string | Date = new Date()) {
  if (!expiresOn) return null;
  const expiry = dateToUtc(expiresOn);
  const current = dateToUtc(dateOnly(today));
  if (!expiry || !current) return null;
  return Math.floor((expiry.getTime() - current.getTime()) / DAY_MS);
}

export function getExpiryBucket(expiresOn: string | null, today: string | Date = new Date()): ExpiryBucket {
  const days = daysUntilExpiry(expiresOn, today);
  if (days === null) return "missing";
  if (days < 0) return "expired";
  if (days <= 30) return "within_30";
  if (days <= 60) return "within_60";
  if (days <= 90) return "within_90";
  return "over_90";
}

export function hasSufficientShelfLife(expiresOn: string | null, requiredDays: number, today: string | Date = new Date()) {
  const days = daysUntilExpiry(expiresOn, today);
  return days !== null && days >= requiredDays;
}

export function isFefoEligible(batch: Pick<BatchRecord, "status" | "qualityStatus" | "expiresOn">, today: string | Date = new Date()) {
  const days = daysUntilExpiry(batch.expiresOn, today);
  return batch.status === "active"
    && days !== null
    && days >= 0
    && !["rejected", "recalled", "quarantined"].includes(batch.qualityStatus);
}

export function rankFefo<T extends Pick<BatchRecord, "status" | "qualityStatus" | "expiresOn" | "createdAt">>(batches: T[], today: string | Date = new Date()) {
  return batches
    .filter((batch) => isFefoEligible(batch, today))
    .sort((left, right) => {
      const leftDays = daysUntilExpiry(left.expiresOn, today) ?? Number.MAX_SAFE_INTEGER;
      const rightDays = daysUntilExpiry(right.expiresOn, today) ?? Number.MAX_SAFE_INTEGER;
      return leftDays - rightDays || left.createdAt.localeCompare(right.createdAt);
    });
}

function matches(value: unknown, query: string) {
  return String(value ?? "").toLowerCase().includes(query.toLowerCase());
}

function statusMatches(status: string, requested: string) {
  return requested === "all" || status === requested;
}

function errorMessage(error: { message?: string } | null) {
  return error?.message ?? "The requested batch records could not be loaded.";
}

function emptySummary(): BatchSummary {
  return { expired: 0, within_30: 0, within_60: 0, within_90: 0, over_90: 0, missing: 0 };
}

function mapBatch(
  row: Record<string, unknown>,
  products: Map<string, { code: string; name: string }>,
  skus: Map<string, { productId: string; code: string; name: string }>,
  manufacturers: Map<string, string>,
  suppliers: Map<string, string>,
  attachments: Map<string, string>,
  movementCounts: Map<string, number>,
): BatchRecord {
  const productId = String(row.product_id);
  const skuId = String(row.sku_id);
  const product = products.get(productId);
  const sku = skus.get(skuId);
  const movementCount = movementCounts.get(String(row.id)) ?? 0;
  const expiresOn = String(row.expires_on ?? "");
  return {
    id: String(row.id),
    productId,
    productCode: product?.code ?? "Unknown product",
    productName: product?.name ?? "Unknown product",
    skuId,
    skuCode: sku?.code ?? "Unknown SKU",
    skuName: sku?.name ?? "Unknown SKU",
    manufacturerId: (row.manufacturer_id as string | null) ?? null,
    manufacturerName: row.manufacturer_id ? manufacturers.get(String(row.manufacturer_id)) ?? null : null,
    supplierId: (row.supplier_id as string | null) ?? null,
    supplierName: row.supplier_id ? suppliers.get(String(row.supplier_id)) ?? null : null,
    batchNumber: String(row.batch_number ?? ""),
    manufacturedOn: (row.manufactured_on as string | null) ?? null,
    expiresOn,
    receivedOn: (row.received_on as string | null) ?? null,
    initialQuantity: Number(row.initial_quantity ?? 0),
    unitCost: Number(row.unit_cost ?? row.purchase_cost ?? 0),
    purchaseCost: row.purchase_cost === null || row.purchase_cost === undefined ? null : Number(row.purchase_cost),
    currencyCode: String(row.currency_code ?? "LKR"),
    qualityStatus: (row.quality_status as QualityStatus) ?? "pending",
    attachmentId: (row.attachment_id as string | null) ?? null,
    attachmentName: row.attachment_id ? attachments.get(String(row.attachment_id)) ?? null : null,
    notes: (row.notes as string | null) ?? null,
    status: (row.status as BatchStatus) ?? "active",
    archivedAt: (row.archived_at as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedBy: (row.updated_by as string | null) ?? null,
    updatedAt: String(row.updated_at),
    correctionReason: (row.correction_reason as string | null) ?? null,
    movementCount,
    hasStockMovements: movementCount > 0,
    daysRemaining: daysUntilExpiry(expiresOn),
    expiryBucket: getExpiryBucket(expiresOn),
  };
}

const demoProducts = [{ id: "00000000-0000-0000-0000-000000000210", productCode: "GL-MAG", name: "GoodLivin Magnesium Complex", status: "active" }];
const demoSkus = [{ id: "00000000-0000-0000-0000-000000000211", productId: demoProducts[0].id, skuCode: "GL-MAG-60", sellableName: "Magnesium Complex · 60 capsules", status: "active" }];
const demoBatches: BatchRecord[] = [
  {
    id: "00000000-0000-0000-0000-000000000241", productId: demoProducts[0].id, productCode: "GL-MAG", productName: demoProducts[0].name, skuId: demoSkus[0].id, skuCode: "GL-MAG-60", skuName: demoSkus[0].sellableName, manufacturerId: null, manufacturerName: "GoodLivin Labs", supplierId: null, supplierName: "Serendib Wellness Supply", batchNumber: "GL-MAG-2607", manufacturedOn: "2026-07-28", expiresOn: "2027-07-28", receivedOn: "2026-08-01", initialQuantity: 1200, unitCost: 2700, purchaseCost: 2700, currencyCode: "LKR", qualityStatus: "approved", attachmentId: null, attachmentName: null, notes: "Demo opening batch", status: "active", archivedAt: null, createdBy: null, createdAt: DEMO_DATE, updatedBy: null, updatedAt: DEMO_DATE, correctionReason: null, movementCount: 2, hasStockMovements: true, daysRemaining: daysUntilExpiry("2027-07-28", "2026-08-02"), expiryBucket: getExpiryBucket("2027-07-28", "2026-08-02"),
  },
];

export async function getBatchWorkspace(filters: { q?: string; status?: string; quality?: string; expiry?: ExpiryFilter; productId?: string; skuId?: string; manufacturerId?: string; id?: string }): Promise<BatchResult> {
  if (isDemoMode()) {
    const summary = emptySummary();
    demoBatches.forEach((batch) => { summary[batch.expiryBucket] += 1; });
    return { data: { batches: demoBatches, summary, products: demoProducts, skus: demoSkus, manufacturers: [], suppliers: [], attachments: [] }, error: null };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return { data: { batches: [], summary: emptySummary(), products: [], skus: [], manufacturers: [], suppliers: [], attachments: [] }, error: "Supabase is not configured." };

  const [{ data: batchRows, error: batchError }, { data: productRows, error: productError }, { data: skuRows, error: skuError }, { data: manufacturerRows, error: manufacturerError }, { data: supplierRows, error: supplierError }] = await Promise.all([
    supabase.from("product_batches").select("*").order("expires_on", { ascending: true }),
    supabase.from("products").select("id, product_code, name, status").order("name"),
    supabase.from("product_skus").select("id, product_id, sku_code, sellable_name, status").order("sku_code"),
    supabase.from("manufacturers").select("id, name, code, status").order("name"),
    supabase.from("suppliers").select("id, name, code, status").order("name"),
  ]);
  const firstError = batchError ?? productError ?? skuError ?? manufacturerError ?? supplierError;
  if (firstError) return { data: { batches: [], summary: emptySummary(), products: [], skus: [], manufacturers: [], suppliers: [], attachments: [] }, error: errorMessage(firstError) };

  const productOptions = (productRows ?? []).map((row) => ({ id: String(row.id), productCode: String(row.product_code ?? ""), name: String(row.name ?? ""), status: String(row.status ?? "active") }));
  const skuOptions = (skuRows ?? []).map((row) => ({ id: String(row.id), productId: String(row.product_id), skuCode: String(row.sku_code ?? ""), sellableName: String(row.sellable_name ?? ""), status: String(row.status ?? "active") }));
  const manufacturerOptions = (manufacturerRows ?? []).map((row) => ({ id: String(row.id), name: String(row.name ?? ""), code: (row.code as string | null) ?? null, status: String(row.status ?? "active") }));
  const supplierOptions = (supplierRows ?? []).map((row) => ({ id: String(row.id), name: String(row.name ?? ""), code: (row.code as string | null) ?? null, status: String(row.status ?? "active") }));
  const products = new Map(productOptions.map((row) => [row.id, { code: row.productCode, name: row.name }]));
  const skus = new Map(skuOptions.map((row) => [row.id, { productId: row.productId, code: row.skuCode, name: row.sellableName }]));
  const manufacturers = new Map(manufacturerOptions.map((row) => [row.id, row.name]));
  const suppliers = new Map(supplierOptions.map((row) => [row.id, row.name]));

  const rawRows = batchRows ?? [];
  const movementCounts = new Map<string, number>();
  if (rawRows.length > 0) {
    const movementResult = await supabase.from("stock_movements").select("id, batch_id").in("batch_id", rawRows.map((row) => String(row.id)));
    if (!movementResult.error) (movementResult.data ?? []).forEach((row) => movementCounts.set(String(row.batch_id), (movementCounts.get(String(row.batch_id)) ?? 0) + 1));
  }
  const attachmentResult = await supabase.from("attachments").select("id, file_name, storage_path").order("created_at", { ascending: false });
  const attachments = !attachmentResult.error ? (attachmentResult.data ?? []).map((row) => ({ id: String(row.id), fileName: String(row.file_name ?? ""), storagePath: String(row.storage_path ?? "") })) : [];
  const attachmentMap = new Map(attachments.map((row) => [row.id, row.fileName]));
  const mapped = rawRows.map((row) => mapBatch(row as Record<string, unknown>, products, skus, manufacturers, suppliers, attachmentMap, movementCounts));
  const summary = emptySummary();
  mapped.forEach((batch) => { summary[batch.expiryBucket] += 1; });
  const query = filters.q?.trim() ?? "";
  const filtered = mapped.filter((batch) =>
    (!filters.id || batch.id === filters.id)
    && statusMatches(batch.status, filters.status ?? "active")
    && (!filters.quality || filters.quality === "all" || batch.qualityStatus === filters.quality)
    && (!filters.expiry || filters.expiry === "all" || batch.expiryBucket === filters.expiry)
    && (!filters.productId || filters.productId === "all" || batch.productId === filters.productId)
    && (!filters.skuId || filters.skuId === "all" || batch.skuId === filters.skuId)
    && (!filters.manufacturerId || filters.manufacturerId === "all" || batch.manufacturerId === filters.manufacturerId)
    && (!query || [batch.batchNumber, batch.productCode, batch.productName, batch.skuCode, batch.skuName, batch.manufacturerName, batch.supplierName].some((value) => matches(value, query))),
  ).sort((left, right) => (left.daysRemaining ?? Number.MAX_SAFE_INTEGER) - (right.daysRemaining ?? Number.MAX_SAFE_INTEGER) || left.createdAt.localeCompare(right.createdAt));

  return { data: { batches: filtered, summary, products: productOptions, skus: skuOptions, manufacturers: manufacturerOptions, suppliers: supplierOptions, attachments }, error: null };
}

export async function getBatchDetail(id: string) {
  const result = await getBatchWorkspace({ id, status: "all" });
  return { batch: result.data.batches[0] ?? null, options: result.data, error: result.error };
}

export async function getBatchAuditHistory(id: string): Promise<{ data: AuditRecord[]; error: string | null }> {
  if (isDemoMode()) return { data: [], error: null };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { data: [], error: "Supabase is not configured." };
  const { data, error } = await supabase.from("audit_logs").select("id, action, reason, before_snapshot, after_snapshot, created_at").eq("table_name", "product_batches").eq("record_id", id).order("created_at", { ascending: false });
  if (error) return { data: [], error: null };
  return { data: (data ?? []).map((row) => ({ id: String(row.id), action: String(row.action), reason: (row.reason as string | null) ?? null, beforeSnapshot: (row.before_snapshot as Record<string, unknown> | null) ?? null, afterSnapshot: (row.after_snapshot as Record<string, unknown> | null) ?? null, createdAt: String(row.created_at) })), error: null };
}

export async function getNotificationsWorkspace(): Promise<NotificationsWorkspace> {
  if (isDemoMode()) return { notifications: [], expiryAlerts: demoBatches.map((batch) => ({ id: `expiry-${batch.id}`, notificationType: "batch_expiry", title: `${batch.batchNumber} expiry watch`, message: `${batch.productName} · ${batch.daysRemaining} days remaining`, recordType: "product_batches", recordId: batch.id, readAt: null, createdAt: DEMO_DATE, batchId: batch.id, daysRemaining: batch.daysRemaining, expiryBucket: batch.expiryBucket, qualityStatus: batch.qualityStatus })), thresholds: DEFAULT_THRESHOLDS, error: null };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { notifications: [], expiryAlerts: [], thresholds: DEFAULT_THRESHOLDS, error: "Supabase is not configured." };
  const [{ data: rows, error: notificationError }, { data: thresholdRows }] = await Promise.all([
    supabase.from("notifications").select("id, notification_type, title, message, record_type, record_id, read_at, created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("expiry_notification_settings").select("threshold_days").eq("enabled", true).order("threshold_days", { ascending: false }),
  ]);
  const thresholds = (thresholdRows ?? []).map((row) => Number(row.threshold_days)).filter((value) => Number.isFinite(value));
  const batchResult = await getBatchWorkspace({ status: "active" });
  const maxThreshold = Math.max(...(thresholds.length > 0 ? thresholds : DEFAULT_THRESHOLDS));
  const expiryAlerts = batchResult.data.batches.filter((batch) => batch.daysRemaining !== null && batch.daysRemaining <= maxThreshold && batch.qualityStatus !== "rejected" && batch.qualityStatus !== "recalled").map((batch) => ({
    id: `expiry-${batch.id}`,
    notificationType: "batch_expiry",
    title: `${batch.batchNumber} expiry watch`,
    message: batch.daysRemaining !== null && batch.daysRemaining < 0 ? `${batch.productName} is expired.` : `${batch.productName} · ${batch.daysRemaining} days remaining.`,
    recordType: "product_batches",
    recordId: batch.id,
    readAt: null,
    createdAt: batch.updatedAt,
    batchId: batch.id,
    daysRemaining: batch.daysRemaining,
    expiryBucket: batch.expiryBucket,
    qualityStatus: batch.qualityStatus,
  }));
  const notifications = (rows ?? []).map((row) => ({ id: String(row.id), notificationType: String(row.notification_type), title: String(row.title), message: String(row.message), recordType: (row.record_type as string | null) ?? null, recordId: (row.record_id as string | null) ?? null, readAt: (row.read_at as string | null) ?? null, createdAt: String(row.created_at) }));
  return { notifications, expiryAlerts, thresholds: thresholds.length > 0 ? thresholds : DEFAULT_THRESHOLDS, error: notificationError ? errorMessage(notificationError) : batchResult.error };
}

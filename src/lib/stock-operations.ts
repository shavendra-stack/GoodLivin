import { isDemoMode } from "@/lib/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type StockStatus = "draft" | "dispatched" | "received" | "cancelled" | "posted" | "pending";
export type AdjustmentType = "physical_count" | "damaged_stock" | "expired_stock" | "sample_influencer_stock" | "promotional_event" | "return" | "other";
export type MovementType = "receipt" | "transfer" | "adjustment_in" | "adjustment_out" | "return" | "damage" | "wastage" | "issue";

export type StockOption = { id: string; label: string; code?: string | null; status?: string; productId?: string; retailerId?: string | null; branchId?: string | null };

export type StockBalanceRow = {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  minimumStockLevel: number;
  reorderLevel: number;
  skuId: string;
  skuCode: string;
  skuName: string;
  batchId: string;
  batchNumber: string;
  expiresOn: string;
  qualityStatus: string;
  locationId: string;
  locationCode: string;
  locationName: string;
  locationType: string;
  retailerId: string | null;
  retailerName: string | null;
  branchName: string | null;
  quantityOnHand: number;
  availableQuantity: number;
  quarantinedQuantity: number;
  damagedQuantity: number;
  expiredQuantity: number;
  lastMovementAt: string | null;
};

export type StockSummary = {
  totalUnits: number;
  availableUnits: number;
  quarantinedUnits: number;
  damagedUnits: number;
  expiredUnits: number;
  skuCount: number;
  warningCount: number;
};

export type InventoryWorkspace = {
  balances: StockBalanceRow[];
  summary: StockSummary;
  warnings: Array<{ productId: string; productName: string; productCode: string; quantity: number; minimumStockLevel: number; reorderLevel: number; severity: "minimum" | "reorder" }>;
  products: StockOption[];
  skus: StockOption[];
  batches: StockOption[];
  locations: StockOption[];
  retailers: StockOption[];
  error: string | null;
};

export type Stage4ReferenceData = {
  products: StockOption[];
  skus: StockOption[];
  batches: Array<StockOption & { productId: string; expiresOn: string; qualityStatus: string; unitCost: number }>;
  locations: Array<StockOption & { locationType: string; retailerId: string | null; branchId: string | null }>;
  suppliers: StockOption[];
  manufacturers: StockOption[];
  attachments: StockOption[];
  agreements: Array<{ id: string; retailerId: string; retailerName: string; agreementNumber: string; minimumShelfLifeDays: number }>;
  balances: StockBalanceRow[];
  error: string | null;
};

export type ReceiptRow = {
  id: string;
  receiptNumber: string;
  supplierName: string | null;
  manufacturerName: string | null;
  locationName: string;
  productName: string;
  skuCode: string;
  batchNumber: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  receivedOn: string;
  inspectionStatus: string;
  status: string;
  createdAt: string;
};

export type TransferRow = {
  id: string;
  transferNumber: string;
  sourceLocationName: string;
  destinationLocationName: string;
  productName: string;
  skuCode: string;
  batchNumber: string;
  expiresOn: string;
  quantity: number;
  status: StockStatus;
  transferDate: string;
  overrideReason: string | null;
  createdAt: string;
};

export type AdjustmentRow = {
  id: string;
  adjustmentNumber: string;
  adjustmentType: AdjustmentType;
  direction: "in" | "out";
  locationName: string;
  productName: string;
  skuCode: string;
  batchNumber: string;
  quantity: number;
  unitCost: number;
  reason: string;
  status: StockStatus;
  createdAt: string;
};

export type MovementRow = {
  id: string;
  movementNumber: number;
  movementType: MovementType | string;
  status: string;
  productName: string;
  skuCode: string;
  batchNumber: string;
  sourceLocationName: string | null;
  destinationLocationName: string | null;
  quantity: number;
  unitCost: number | null;
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
  createdAt: string;
};

const emptyInventory: InventoryWorkspace = {
  balances: [],
  summary: { totalUnits: 0, availableUnits: 0, quarantinedUnits: 0, damagedUnits: 0, expiredUnits: 0, skuCount: 0, warningCount: 0 },
  warnings: [], products: [], skus: [], batches: [], locations: [], retailers: [], error: null,
};

function text(row: Record<string, unknown>, key: string) { return row[key] == null ? null : String(row[key]); }
function number(row: Record<string, unknown>, key: string) { return Number(row[key] ?? 0); }
function option(row: Record<string, unknown>, labelKey: string, codeKey = "code"): StockOption {
  return { id: String(row.id), label: String(row[labelKey] ?? ""), code: text(row, codeKey), status: text(row, "status") ?? undefined };
}
function dateOnly(value: string | null) { return value?.slice(0, 10) ?? null; }
function isExpired(value: string) { return value < new Date().toISOString().slice(0, 10); }
function errorMessage(error: { message?: string; code?: string; details?: string | null; hint?: string | null } | null) {
  if (!error) return "The stock data could not be loaded.";
  console.error("[goodlivin:stock-data] Supabase query failed", { code: error.code ?? null, message: error.message ?? null, details: error.details ?? null, hint: error.hint ?? null });
  return error.message ?? "The stock data could not be loaded.";
}

async function queryInventoryData() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { data: null, error: "Supabase is not configured." };
  const [balanceResult, productsResult, skusResult, batchesResult, locationsResult, retailersResult, branchesResult, movementResult] = await Promise.all([
    supabase.from("stock_balances").select("product_id, batch_id, location_id, quantity_on_hand"),
    supabase.from("products").select("id, product_code, name, minimum_stock_level, reorder_level, status").order("name"),
    supabase.from("product_skus").select("id, product_id, sku_code, sellable_name, status").order("sellable_name"),
    supabase.from("product_batches").select("id, product_id, sku_id, batch_number, expires_on, quality_status, status").order("expires_on"),
    supabase.from("inventory_locations").select("id, code, name, location_type, retailer_id, branch_id, status").order("name"),
    supabase.from("retailers").select("id, code, name, status").order("name"),
    supabase.from("retailer_branches").select("id, retailer_id, code, name, status").order("name"),
    supabase.from("stock_movements").select("product_id, batch_id, source_location_id, destination_location_id, created_at, status").eq("status", "posted").order("created_at", { ascending: false }),
  ]);
  const firstError = [balanceResult, productsResult, skusResult, batchesResult, locationsResult, retailersResult, branchesResult, movementResult].find((result) => result.error)?.error;
  if (firstError) return { data: null, error: errorMessage(firstError) };
  return { data: { balances: balanceResult.data ?? [], products: productsResult.data ?? [], skus: skusResult.data ?? [], batches: batchesResult.data ?? [], locations: locationsResult.data ?? [], retailers: retailersResult.data ?? [], branches: branchesResult.data ?? [], movements: movementResult.data ?? [] }, error: null };
}

export async function getInventoryWorkspace(params: { q?: string; productId?: string; skuId?: string; locationId?: string; retailerId?: string; qualityStatus?: string } = {}): Promise<InventoryWorkspace> {
  if (isDemoMode()) return emptyInventory;
  const result = await queryInventoryData();
  if (!result.data) return { ...emptyInventory, error: result.error };
  const { balances, products, skus, batches, locations, retailers, branches, movements } = result.data;
  const productMap = new Map(products.map((row) => [String(row.id), row]));
  const skuMap = new Map(skus.map((row) => [String(row.id), row]));
  const batchMap = new Map(batches.map((row) => [String(row.id), row]));
  const locationMap = new Map(locations.map((row) => [String(row.id), row]));
  const retailerMap = new Map(retailers.map((row) => [String(row.id), row]));
  const branchMap = new Map(branches.map((row) => [String(row.id), row]));
  const lastMovement = new Map<string, string>();
  (movements as Record<string, unknown>[]).forEach((row) => {
    const date = String(row.created_at);
    [row.source_location_id, row.destination_location_id].filter(Boolean).forEach((locationId) => {
      const key = `${row.product_id}:${row.batch_id}:${locationId}`;
      if (!lastMovement.has(key)) lastMovement.set(key, date);
    });
  });
  const query = params.q?.trim().toLowerCase() ?? "";
  const rows = (balances as Record<string, unknown>[]).map((row, index) => {
    const product = productMap.get(String(row.product_id));
    const sku = skuMap.get(String((batchMap.get(String(row.batch_id)) as Record<string, unknown> | undefined)?.sku_id ?? ""));
    const batch = batchMap.get(String(row.batch_id));
    const location = locationMap.get(String(row.location_id));
    const retailer = location?.retailer_id ? retailerMap.get(String(location.retailer_id)) : null;
    const branch = location?.branch_id ? branchMap.get(String(location.branch_id)) : null;
    const quantity = number(row, "quantity_on_hand");
    const batchExpiry = String(batch?.expires_on ?? "");
    const quality = String(batch?.quality_status ?? "pending");
    const locationType = String(location?.location_type ?? "warehouse");
    const quarantined = ["quarantine", "quarantine_stock"].includes(locationType) || ["quarantined", "rejected", "recalled"].includes(quality);
    const damaged = locationType === "damaged_stock";
    const expired = locationType === "expired_stock" || isExpired(batchExpiry);
    const available = !quarantined && !damaged && !expired && quality === "approved" ? quantity : 0;
    const rowValue: StockBalanceRow = {
      id: `${row.product_id}-${row.batch_id}-${row.location_id}-${index}`,
      productId: String(row.product_id), productCode: String(product?.product_code ?? "—"), productName: String(product?.name ?? "Unknown product"),
      minimumStockLevel: number(product ?? {}, "minimum_stock_level"), reorderLevel: number(product ?? {}, "reorder_level"),
      skuId: String(sku?.id ?? "—"), skuCode: String(sku?.sku_code ?? "—"), skuName: String(sku?.sellable_name ?? "Unknown SKU"),
      batchId: String(row.batch_id), batchNumber: String(batch?.batch_number ?? "—"), expiresOn: batchExpiry, qualityStatus: quality,
      locationId: String(row.location_id), locationCode: String(location?.code ?? "—"), locationName: String(location?.name ?? "Unknown location"), locationType,
      retailerId: location?.retailer_id ? String(location.retailer_id) : null, retailerName: retailer ? String(retailer.name) : null, branchName: branch ? String(branch.name) : null,
      quantityOnHand: quantity, availableQuantity: available, quarantinedQuantity: quarantined ? quantity : 0, damagedQuantity: damaged ? quantity : 0, expiredQuantity: expired ? quantity : 0,
      lastMovementAt: lastMovement.get(`${row.product_id}:${row.batch_id}:${row.location_id}`) ?? null,
    };
    return rowValue;
  }).filter((row) => {
    const matchesQuery = !query || [row.productName, row.productCode, row.skuName, row.skuCode, row.batchNumber, row.locationName, row.locationCode, row.retailerName, row.branchName].some((value) => String(value ?? "").toLowerCase().includes(query));
    return matchesQuery && (!params.productId || row.productId === params.productId) && (!params.skuId || row.skuId === params.skuId) && (!params.locationId || row.locationId === params.locationId) && (!params.retailerId || row.retailerId === params.retailerId) && (!params.qualityStatus || params.qualityStatus === "all" || row.qualityStatus === params.qualityStatus);
  });
  const totals = new Map<string, { product: StockBalanceRow; quantity: number }>();
  rows.forEach((row) => {
    const key = row.productId;
    const existing = totals.get(key) ?? { product: row, quantity: 0 };
    existing.quantity += row.quantityOnHand;
    totals.set(key, existing);
  });
  const warnings: InventoryWorkspace["warnings"] = [];
  totals.forEach(({ product, quantity }) => {
    if (product.minimumStockLevel > 0 && quantity <= product.minimumStockLevel) warnings.push({ productId: product.productId, productName: product.productName, productCode: product.productCode, quantity, minimumStockLevel: product.minimumStockLevel, reorderLevel: product.reorderLevel, severity: "minimum" });
    else if (product.reorderLevel > 0 && quantity <= product.reorderLevel) warnings.push({ productId: product.productId, productName: product.productName, productCode: product.productCode, quantity, minimumStockLevel: product.minimumStockLevel, reorderLevel: product.reorderLevel, severity: "reorder" });
  });
  return {
    balances: rows,
    summary: { totalUnits: rows.reduce((sum, row) => sum + row.quantityOnHand, 0), availableUnits: rows.reduce((sum, row) => sum + row.availableQuantity, 0), quarantinedUnits: rows.reduce((sum, row) => sum + row.quarantinedQuantity, 0), damagedUnits: rows.reduce((sum, row) => sum + row.damagedQuantity, 0), expiredUnits: rows.reduce((sum, row) => sum + row.expiredQuantity, 0), skuCount: new Set(rows.map((row) => row.skuId)).size, warningCount: warnings.length },
    warnings,
    products: products.map((row) => option(row, "name", "product_code")),
    skus: skus.map((row) => ({ ...option(row, "sellable_name", "sku_code"), productId: String(row.product_id) })),
    batches: batches.map((row) => ({ ...option(row, "batch_number", "batch_number"), productId: String(row.product_id) })),
    locations: locations.map((row) => ({ ...option(row, "name"), code: String(row.code), retailerId: text(row, "retailer_id"), branchId: text(row, "branch_id") })),
    retailers: retailers.map((row) => option(row, "name")),
    error: null,
  };
}

export async function getStage4References(): Promise<Stage4ReferenceData> {
  const inventory = await getInventoryWorkspace();
  if (isDemoMode()) return { products: [], skus: [], batches: [], locations: [], suppliers: [], manufacturers: [], attachments: [], agreements: [], balances: inventory.balances, error: null };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { products: [], skus: [], batches: [], locations: [], suppliers: [], manufacturers: [], attachments: [], agreements: [], balances: inventory.balances, error: "Supabase is not configured." };
  const [suppliers, manufacturers, attachments, agreements, products, skus, batches, locations, retailers] = await Promise.all([
    supabase.from("suppliers").select("id, code, name, status").eq("status", "active").order("name"),
    supabase.from("manufacturers").select("id, code, name, status").eq("status", "active").order("name"),
    supabase.from("attachments").select("id, file_name").order("created_at", { ascending: false }).limit(100),
    supabase.from("retailer_commercial_agreements").select("id, retailer_id, agreement_number, minimum_shelf_life_days, status").eq("status", "active"),
    supabase.from("products").select("id, product_code, name, status").eq("status", "active").order("name"),
    supabase.from("product_skus").select("id, product_id, sku_code, sellable_name, status").eq("status", "active").order("sellable_name"),
    supabase.from("product_batches").select("id, product_id, sku_id, batch_number, expires_on, quality_status, unit_cost, status").eq("status", "active").order("expires_on"),
    supabase.from("inventory_locations").select("id, code, name, location_type, retailer_id, branch_id, status").eq("status", "active").order("name"),
    supabase.from("retailers").select("id, name, status").eq("status", "active"),
  ]);
  // Attachments are optional for receiving, transfers and adjustments. A
  // missing table grant must not hide the valid master-data references needed
  // to post stock. The corrective migration restores this grant while the
  // fallback keeps the workflow resilient during a partial deployment.
  if (attachments.error) errorMessage(attachments.error);
  const firstError = [suppliers, manufacturers, agreements, products, skus, batches, locations, retailers].find((result) => result.error)?.error;
  if (firstError) return { products: [], skus: [], batches: [], locations: [], suppliers: [], manufacturers: [], attachments: [], agreements: [], balances: inventory.balances, error: errorMessage(firstError) };
  const retailerMap = new Map((retailers.data ?? []).map((row) => [String(row.id), String(row.name)]));
  return {
    products: (products.data ?? []).map((row) => option(row, "name", "product_code")),
    skus: (skus.data ?? []).map((row) => ({ ...option(row, "sellable_name", "sku_code"), productId: String(row.product_id) })),
    batches: (batches.data ?? []).map((row) => ({ ...option(row, "batch_number", "batch_number"), productId: String(row.product_id), expiresOn: String(row.expires_on), qualityStatus: String(row.quality_status), unitCost: number(row, "unit_cost") })),
    locations: (locations.data ?? []).map((row) => ({ ...option(row, "name"), code: String(row.code), locationType: String(row.location_type), retailerId: text(row, "retailer_id"), branchId: text(row, "branch_id") })),
    suppliers: (suppliers.data ?? []).map((row) => option(row, "name")),
    manufacturers: (manufacturers.data ?? []).map((row) => option(row, "name")),
    attachments: (attachments.data ?? []).map((row) => option(row, "file_name")),
    agreements: (agreements.data ?? []).map((row) => ({ id: String(row.id), retailerId: String(row.retailer_id), retailerName: retailerMap.get(String(row.retailer_id)) ?? "Retailer", agreementNumber: String(row.agreement_number), minimumShelfLifeDays: number(row, "minimum_shelf_life_days") })),
    balances: inventory.balances,
    error: null,
  };
}

async function getDocumentRows<T>(table: string, mapRows: (rows: Record<string, unknown>[], refs: Stage4ReferenceData) => T[]): Promise<{ rows: T[]; refs: Stage4ReferenceData; error: string | null }> {
  const refs = await getStage4References();
  if (refs.error) return { rows: [], refs, error: refs.error };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { rows: [], refs, error: "Supabase is not configured." };
  const result = await supabase.from(table).select("*").order("created_at", { ascending: false }).limit(100);
  if (result.error) return { rows: [], refs, error: errorMessage(result.error) };
  return { rows: mapRows((result.data ?? []) as Record<string, unknown>[], refs), refs, error: null };
}

function refMaps(refs: Stage4ReferenceData) {
  return { products: new Map(refs.products.map((row) => [row.id, row])), skus: new Map(refs.skus.map((row) => [row.id, row])), batches: new Map(refs.batches.map((row) => [row.id, row])), locations: new Map(refs.locations.map((row) => [row.id, row])), suppliers: new Map(refs.suppliers.map((row) => [row.id, row])), manufacturers: new Map(refs.manufacturers.map((row) => [row.id, row])) };
}

export async function getReceiptWorkspace(): Promise<{ receipts: ReceiptRow[]; refs: Stage4ReferenceData; error: string | null }> {
  const result = await getDocumentRows("stock_receipts", (rows, refs) => { const maps = refMaps(refs); return rows.map((row) => ({ id: String(row.id), receiptNumber: String(row.receipt_number), supplierName: maps.suppliers.get(String(row.supplier_id))?.label ?? null, manufacturerName: maps.manufacturers.get(String(row.manufacturer_id))?.label ?? null, locationName: maps.locations.get(String(row.receiving_location_id))?.label ?? "Unknown location", productName: maps.products.get(String(row.product_id))?.label ?? "Unknown product", skuCode: maps.skus.get(String(row.sku_id))?.code ?? "—", batchNumber: maps.batches.get(String(row.batch_id))?.label ?? "—", quantity: number(row, "quantity"), unitCost: number(row, "unit_cost"), totalCost: number(row, "total_cost"), receivedOn: String(row.received_on), inspectionStatus: String(row.inspection_status), status: String(row.status), createdAt: String(row.created_at) })); });
  return { receipts: result.rows, refs: result.refs, error: result.error };
}

export async function getTransferWorkspace(): Promise<{ transfers: TransferRow[]; refs: Stage4ReferenceData; error: string | null }> {
  const result = await getDocumentRows("stock_transfers", (rows, refs) => { const maps = refMaps(refs); return rows.map((row) => ({ id: String(row.id), transferNumber: String(row.transfer_number), sourceLocationName: maps.locations.get(String(row.source_location_id))?.label ?? "Unknown location", destinationLocationName: maps.locations.get(String(row.destination_location_id))?.label ?? "Unknown location", productName: maps.products.get(String(row.product_id))?.label ?? "Unknown product", skuCode: maps.skus.get(String(row.sku_id))?.code ?? "—", batchNumber: maps.batches.get(String(row.batch_id))?.label ?? "—", expiresOn: maps.batches.get(String(row.batch_id))?.expiresOn ?? "", quantity: number(row, "quantity"), status: String(row.status) as StockStatus, transferDate: String(row.transfer_date), overrideReason: text(row, "override_reason"), createdAt: String(row.created_at) })); });
  return { transfers: result.rows, refs: result.refs, error: result.error };
}

export async function getAdjustmentWorkspace(): Promise<{ adjustments: AdjustmentRow[]; refs: Stage4ReferenceData; error: string | null }> {
  const result = await getDocumentRows("stock_adjustments", (rows, refs) => { const maps = refMaps(refs); return rows.map((row) => ({ id: String(row.id), adjustmentNumber: String(row.adjustment_number), adjustmentType: String(row.adjustment_type) as AdjustmentType, direction: String(row.direction) as "in" | "out", locationName: maps.locations.get(String(row.location_id))?.label ?? "Unknown location", productName: maps.products.get(String(row.product_id))?.label ?? "Unknown product", skuCode: maps.skus.get(String(row.sku_id))?.code ?? "—", batchNumber: maps.batches.get(String(row.batch_id))?.label ?? "—", quantity: number(row, "quantity"), unitCost: number(row, "unit_cost"), reason: String(row.reason), status: String(row.status) as StockStatus, createdAt: String(row.created_at) })); });
  return { adjustments: result.rows, refs: result.refs, error: result.error };
}

export async function getMovementHistory(params: { q?: string; type?: string; status?: string; from?: string; to?: string } = {}): Promise<{ movements: MovementRow[]; refs: Stage4ReferenceData; error: string | null }> {
  const refs = await getStage4References();
  if (refs.error) return { movements: [], refs, error: refs.error };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { movements: [], refs, error: "Supabase is not configured." };
  let query = supabase.from("stock_movements").select("*").order("created_at", { ascending: false }).limit(200);
  if (params.type && params.type !== "all") query = query.eq("movement_type", params.type);
  if (params.status && params.status !== "all") query = query.eq("status", params.status);
  if (params.from) query = query.gte("created_at", `${params.from}T00:00:00.000Z`);
  if (params.to) query = query.lt("created_at", `${params.to}T23:59:59.999Z`);
  const result = await query;
  if (result.error) return { movements: [], refs, error: errorMessage(result.error) };
  const maps = refMaps(refs);
  const q = params.q?.toLowerCase() ?? "";
  const movements = ((result.data ?? []) as Record<string, unknown>[]).map((row) => ({ id: String(row.id), movementNumber: number(row, "movement_number"), movementType: String(row.movement_type), status: String(row.status), productName: maps.products.get(String(row.product_id))?.label ?? "Unknown product", skuCode: maps.skus.get(String(row.sku_id))?.code ?? "—", batchNumber: maps.batches.get(String(row.batch_id))?.label ?? "—", sourceLocationName: maps.locations.get(String(row.source_location_id))?.label ?? null, destinationLocationName: maps.locations.get(String(row.destination_location_id))?.label ?? null, quantity: number(row, "quantity"), unitCost: row.unit_cost == null ? null : number(row, "unit_cost"), referenceType: text(row, "reference_type"), referenceId: text(row, "reference_id"), reason: text(row, "reason"), createdAt: String(row.created_at) })).filter((row) => !q || [row.productName, row.skuCode, row.batchNumber, row.sourceLocationName, row.destinationLocationName, row.referenceType, row.reason].some((value) => String(value ?? "").toLowerCase().includes(q)));
  return { movements, refs, error: null };
}

export function formatLkr(value: number | null) { return value == null ? "—" : `LKR ${value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
export function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat("en-LK", { dateStyle: "medium" }).format(new Date(`${dateOnly(value)}T00:00:00Z`)) : "—"; }

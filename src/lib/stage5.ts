import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/config";

export type Stage5Option = { id: string; label: string; code?: string | null; status?: string; productId?: string; retailerId?: string | null; branchId?: string | null; locationType?: string; expiresOn?: string; qualityStatus?: string; unitCost?: number };

export type Stage5References = {
  products: Stage5Option[];
  skus: Stage5Option[];
  batches: Stage5Option[];
  locations: Stage5Option[];
  retailers: Stage5Option[];
  branches: Stage5Option[];
  error: string | null;
};

export type SalesOrderRow = {
  id: string; orderNumber: string; saleDate: string; salesChannel: string; locationName: string; retailerName: string | null; branchName: string | null;
  productName: string; skuCode: string; batchNumber: string | null; quantity: number; sellingPrice: number; discount: number; totalValue: number; status: string; customerName: string | null; createdAt: string;
};

export type RetailerReportRow = {
  id: string; reportNumber: string; reportDate: string; periodStart: string; periodEnd: string; retailerName: string; branchName: string;
  productName: string; skuCode: string; batchNumber: string | null; quantitySold: number; returnsQuantity: number; damagedQuantity: number; expiredQuantity: number; status: string; createdAt: string;
};

export type ReturnRow = {
  id: string; returnNumber: string; returnType: string; returnDate: string; retailerName: string | null; branchName: string | null;
  destinationName: string; productName: string; skuCode: string; batchNumber: string; quantity: number; condition: string; status: string; reason: string; createdAt: string;
};

export type SellThroughRow = {
  branchId: string; retailerId: string; branchCode: string; branchName: string; productId: string; productCode: string; productName: string; skuId: string; skuCode: string; sellableName: string;
  openingStock: number; deliveries: number; sold: number; returnsSentBack: number; damaged: number; expired: number; currentStock: number; sellThroughPercent: number; lastReportDate: string | null; daysSinceLastReport: number;
};

export type ReplenishmentRow = {
  targetId: string; retailerId: string; branchId: string; productId: string; skuId: string; retailerName: string; branchCode: string; branchName: string;
  productCode: string; productName: string; skuCode: string; sellableName: string; minimumStock: number; targetStock: number; leadTimeDays: number;
  currentBranchStock: number; avgDailySales: number; availableWarehouseStock: number; suggestedQuantity: number; recommendationStatus: string;
};

const emptyReferences: Stage5References = { products: [], skus: [], batches: [], locations: [], retailers: [], branches: [], error: null };

function value(row: Record<string, unknown>, key: string) { return row[key] == null ? null : String(row[key]); }
function number(row: Record<string, unknown>, key: string) { return Number(row[key] ?? 0); }
function option(row: Record<string, unknown>, labelKey: string, codeKey: string, extras: Partial<Stage5Option> = {}): Stage5Option {
  return { id: String(row.id), label: String(row[labelKey] ?? ""), code: value(row, codeKey), status: undefined, ...extras };
}
function errorMessage(error: { message?: string; code?: string; details?: string | null; hint?: string | null } | null) {
  if (!error) return "The Stage 5 data could not be loaded.";
  console.error("[goodlivin:stage5-data] Supabase query failed", { code: error.code ?? null, message: error.message ?? null, details: error.details ?? null, hint: error.hint ?? null });
  return error.message ?? "The Stage 5 data could not be loaded.";
}

export async function getStage5References(): Promise<Stage5References> {
  if (isDemoMode()) return emptyReferences;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ...emptyReferences, error: "Supabase is not configured." };
  const [products, skus, batches, locations, retailers, branches] = await Promise.all([
    supabase.from("products").select("id, product_code, name, status").eq("status", "active").order("name"),
    supabase.from("product_skus").select("id, product_id, sku_code, sellable_name, retail_price, wholesale_price, status").eq("status", "active").order("sellable_name"),
    supabase.from("product_batches").select("id, product_id, sku_id, batch_number, expires_on, quality_status, unit_cost, status").eq("status", "active").order("expires_on"),
    supabase.from("inventory_locations").select("id, code, name, location_type, retailer_id, branch_id, status").eq("status", "active").order("name"),
    supabase.from("retailers").select("id, code, name, status").eq("status", "active").order("name"),
    supabase.from("retailer_branches").select("id, retailer_id, code, name, status").eq("status", "active").order("name"),
  ]);
  const firstError = [products, skus, batches, locations, retailers, branches].find((result) => result.error)?.error;
  if (firstError) return { ...emptyReferences, error: errorMessage(firstError) };
  return {
    products: (products.data ?? []).map((row) => option(row, "name", "product_code")),
    skus: (skus.data ?? []).map((row) => option(row, "sellable_name", "sku_code", { productId: String(row.product_id) })),
    batches: (batches.data ?? []).map((row) => option(row, "batch_number", "batch_number", { productId: String(row.product_id), expiresOn: String(row.expires_on), qualityStatus: String(row.quality_status), unitCost: number(row, "unit_cost") })),
    locations: (locations.data ?? []).map((row) => option(row, "name", "code", { status: value(row, "status") ?? undefined, locationType: value(row, "location_type") ?? undefined, retailerId: value(row, "retailer_id"), branchId: value(row, "branch_id") })),
    retailers: (retailers.data ?? []).map((row) => option(row, "name", "code")),
    branches: (branches.data ?? []).map((row) => option(row, "name", "code", { retailerId: String(row.retailer_id) })),
    error: null,
  };
}

function maps(refs: Stage5References) {
  return {
    products: new Map(refs.products.map((row) => [row.id, row])), skus: new Map(refs.skus.map((row) => [row.id, row])), batches: new Map(refs.batches.map((row) => [row.id, row])), locations: new Map(refs.locations.map((row) => [row.id, row])), retailers: new Map(refs.retailers.map((row) => [row.id, row])), branches: new Map(refs.branches.map((row) => [row.id, row])),
  };
}

async function queryRows(table: string) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { data: null, error: "Supabase is not configured." };
  const result = await supabase.from(table).select("*").order("created_at", { ascending: false }).limit(200);
  if (result.error) return { data: null, error: errorMessage(result.error) };
  return { data: (result.data ?? []) as Record<string, unknown>[], error: null };
}

export async function getSalesWorkspace() {
  const refs = await getStage5References();
  if (refs.error) return { refs, orders: [] as SalesOrderRow[], reports: [] as RetailerReportRow[], error: refs.error };
  if (isDemoMode()) return { refs, orders: [], reports: [], error: null };
  const [ordersResult, reportsResult] = await Promise.all([queryRows("sales_orders"), queryRows("retailer_sales_reports")]);
  if (ordersResult.error || reportsResult.error) return { refs, orders: [], reports: [], error: ordersResult.error ?? reportsResult.error };
  const ref = maps(refs);
  const orders = (ordersResult.data ?? []).map((row) => ({
    id: String(row.id), orderNumber: String(row.order_number), saleDate: String(row.sale_date), salesChannel: String(row.sales_channel), locationName: ref.locations.get(String(row.fulfilment_location_id))?.label ?? "Unknown location", retailerName: row.retailer_id ? ref.retailers.get(String(row.retailer_id))?.label ?? null : null, branchName: row.branch_id ? ref.branches.get(String(row.branch_id))?.label ?? null : null, productName: ref.products.get(String(row.product_id))?.label ?? "Unknown product", skuCode: ref.skus.get(String(row.sku_id))?.code ?? "—", batchNumber: row.batch_id ? ref.batches.get(String(row.batch_id))?.label ?? null : null, quantity: number(row, "quantity"), sellingPrice: number(row, "selling_price"), discount: number(row, "discount"), totalValue: number(row, "total_value"), status: String(row.status), customerName: value(row, "customer_name"), createdAt: String(row.created_at),
  } satisfies SalesOrderRow));
  const reports = (reportsResult.data ?? []).map((row) => ({
    id: String(row.id), reportNumber: String(row.report_number), reportDate: String(row.report_date), periodStart: String(row.period_start), periodEnd: String(row.period_end), retailerName: ref.retailers.get(String(row.retailer_id))?.label ?? "Unknown retailer", branchName: ref.branches.get(String(row.branch_id))?.label ?? "Unknown branch", productName: ref.products.get(String(row.product_id))?.label ?? "Unknown product", skuCode: ref.skus.get(String(row.sku_id))?.code ?? "—", batchNumber: row.batch_id ? ref.batches.get(String(row.batch_id))?.label ?? null : null, quantitySold: number(row, "quantity_sold"), returnsQuantity: number(row, "returns_quantity"), damagedQuantity: number(row, "damaged_quantity"), expiredQuantity: number(row, "expired_quantity"), status: String(row.status), createdAt: String(row.created_at),
  } satisfies RetailerReportRow));
  return { refs, orders, reports, error: null };
}

export async function getReturnsWorkspace() {
  const refs = await getStage5References();
  if (refs.error) return { refs, returns: [] as ReturnRow[], error: refs.error };
  if (isDemoMode()) return { refs, returns: [], error: null };
  const result = await queryRows("inventory_returns");
  if (result.error) return { refs, returns: [], error: result.error };
  const ref = maps(refs);
  const returns = (result.data ?? []).map((row) => ({
    id: String(row.id), returnNumber: String(row.return_number), returnType: String(row.return_type), returnDate: String(row.return_date), retailerName: row.retailer_id ? ref.retailers.get(String(row.retailer_id))?.label ?? null : null, branchName: row.branch_id ? ref.branches.get(String(row.branch_id))?.label ?? null : null, destinationName: ref.locations.get(String(row.destination_location_id))?.label ?? "Unknown location", productName: ref.products.get(String(row.product_id))?.label ?? "Unknown product", skuCode: ref.skus.get(String(row.sku_id))?.code ?? "—", batchNumber: ref.batches.get(String(row.batch_id))?.label ?? "—", quantity: number(row, "quantity"), condition: String(row.condition), status: String(row.status), reason: String(row.reason), createdAt: String(row.created_at),
  } satisfies ReturnRow));
  return { refs, returns, error: null };
}

export async function getSellThroughWorkspace() {
  const refs = await getStage5References();
  if (refs.error) return { refs, rows: [] as SellThroughRow[], error: refs.error };
  if (isDemoMode()) return { refs, rows: [], error: null };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { refs, rows: [], error: "Supabase is not configured." };
  const result = await supabase.from("retailer_sell_through").select("*").order("branch_name").order("product_name");
  if (result.error) return { refs, rows: [], error: errorMessage(result.error) };
  return { refs, rows: (result.data ?? []).map((row) => ({
    branchId: String(row.branch_id), retailerId: String(row.retailer_id), branchCode: String(row.branch_code), branchName: String(row.branch_name), productId: String(row.product_id), productCode: String(row.product_code), productName: String(row.product_name), skuId: String(row.sku_id), skuCode: String(row.sku_code), sellableName: String(row.sellable_name), openingStock: number(row, "opening_stock"), deliveries: number(row, "deliveries"), sold: number(row, "sold"), returnsSentBack: number(row, "returns_sent_back"), damaged: number(row, "damaged"), expired: number(row, "expired"), currentStock: number(row, "current_stock"), sellThroughPercent: number(row, "sell_through_percent"), lastReportDate: value(row, "last_report_date"), daysSinceLastReport: number(row, "days_since_last_report"),
  } satisfies SellThroughRow)), error: null };
}

export async function getReplenishmentWorkspace() {
  const refs = await getStage5References();
  if (refs.error) return { refs, rows: [] as ReplenishmentRow[], error: refs.error };
  if (isDemoMode()) return { refs, rows: [], error: null };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { refs, rows: [], error: "Supabase is not configured." };
  const result = await supabase.from("replenishment_recommendations").select("*").order("suggested_quantity", { ascending: false });
  if (result.error) return { refs, rows: [], error: errorMessage(result.error) };
  return { refs, rows: (result.data ?? []).map((row) => ({
    targetId: String(row.target_id), retailerId: String(row.retailer_id), branchId: String(row.branch_id), productId: String(row.product_id), skuId: String(row.sku_id), retailerName: String(row.retailer_name), branchCode: String(row.branch_code), branchName: String(row.branch_name), productCode: String(row.product_code), productName: String(row.product_name), skuCode: String(row.sku_code), sellableName: String(row.sellable_name), minimumStock: number(row, "minimum_stock"), targetStock: number(row, "target_stock"), leadTimeDays: number(row, "lead_time_days"), currentBranchStock: number(row, "current_branch_stock"), avgDailySales: number(row, "avg_daily_sales"), availableWarehouseStock: number(row, "available_warehouse_stock"), suggestedQuantity: number(row, "suggested_quantity"), recommendationStatus: String(row.recommendation_status),
  } satisfies ReplenishmentRow)), error: null };
}

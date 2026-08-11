import { isDemoMode } from "@/lib/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/auth";
import type { RoleCode } from "@/lib/roles";

export const REPORT_TIME_ZONE = "Asia/Colombo";
export const REPORT_ROW_LIMIT = 1000;

export type ReportKind =
  | "inventory"
  | "sales"
  | "retailers"
  | "purchasing"
  | "valuation"
  | "expiry"
  | "traceability";

export type InventoryCondition = "sellable" | "damaged" | "quarantined" | "rejected" | "expired" | "pending";

export type ReportFilters = {
  q?: string;
  from?: string;
  to?: string;
  productId?: string;
  skuId?: string;
  batchId?: string;
  locationId?: string;
  retailerId?: string;
  branchId?: string;
  supplierId?: string;
  status?: string;
  channel?: string;
  movementType?: string;
  condition?: string;
  windowDays?: string;
};

export type ReportOption = {
  id: string;
  label: string;
  code?: string | null;
  productId?: string | null;
  retailerId?: string | null;
};

export type ReportAccess = Record<ReportKind, boolean> & {
  dashboard: boolean;
  financial: boolean;
  export: boolean;
  restrictedFinancialReason: string;
};

export type InventoryReportRow = {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  batchId: string;
  batchNumber: string;
  locationId: string;
  locationCode: string;
  locationName: string;
  locationType: string;
  retailerId: string | null;
  retailerName: string | null;
  branchId: string | null;
  branchName: string | null;
  quantityOnHand: number;
  availableQuantity: number;
  condition: InventoryCondition;
  qualityStatus: string;
  expiresOn: string | null;
  daysUntilExpiry: number | null;
  minimumStockLevel: number;
  reorderLevel: number;
  unitCost: number | null;
  costBasis: string;
  totalValue: number | null;
  lastMovementAt: string | null;
};

export type MovementReportRow = {
  id: string;
  movementNumber: number;
  movementType: string;
  status: string;
  productId: string;
  productName: string;
  skuId: string | null;
  skuCode: string;
  batchId: string;
  batchNumber: string;
  sourceLocationId: string | null;
  sourceLocationName: string | null;
  destinationLocationId: string | null;
  destinationLocationName: string | null;
  quantity: number;
  unitCost: number | null;
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
  createdAt: string;
  postedAt: string | null;
};

export type SalesReportRow = {
  id: string;
  recordType: "sales_order" | "retailer_report";
  reference: string;
  date: string;
  channel: string;
  status: string;
  productId: string;
  productName: string;
  skuId: string;
  skuCode: string;
  retailerId: string | null;
  retailerName: string | null;
  branchId: string | null;
  branchName: string | null;
  unitsSold: number;
  returnedUnits: number;
  damagedUnits: number;
  expiredUnits: number;
  grossValue: number | null;
  discounts: number | null;
  refunds: number | null;
  netValue: number | null;
  averageSellingPrice: number | null;
  note: string;
};

export type RetailerPerformanceRow = {
  id: string;
  retailerId: string;
  retailerName: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  productId: string;
  productCode: string;
  productName: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  openingStock: number;
  deliveries: number;
  unitsSold: number;
  returns: number;
  damaged: number;
  expired: number;
  currentStock: number;
  sellThroughPercent: number;
  averageDailySales: number;
  lastReportDate: string | null;
  daysSinceLastReport: number;
  lowStockStatus: string;
  suggestedReplenishmentQuantity: number;
};

export type PurchasingReportRow = {
  id: string;
  poNumber: string;
  status: string;
  orderDate: string;
  expectedDeliveryDate: string | null;
  supplierId: string | null;
  supplierName: string | null;
  manufacturerId: string | null;
  manufacturerName: string | null;
  receivingLocationName: string;
  productId: string;
  productName: string;
  skuId: string;
  skuCode: string;
  quantityOrdered: number;
  quantityReceived: number;
  quantityOutstanding: number;
  daysOverdue: number;
  unitCost: number | null;
  lineValue: number | null;
};

export type SupplierPerformanceRow = {
  id: string;
  supplierName: string;
  orderedQuantity: number;
  receivedQuantity: number;
  outstandingQuantity: number;
  openOrders: number;
  overdueLines: number;
  averageLeadTimeDays: number | null;
  totalValue: number | null;
  amountPaid: number | null;
  balanceRemaining: number | null;
};

export type TraceabilityEvent = {
  id: string;
  date: string;
  eventType: string;
  reference: string;
  direction: string;
  location: string;
  quantity: number;
  details: string;
};

export type ReportModel = {
  generatedAt: string;
  today: string;
  range: { from: string; to: string; label: string };
  access: ReportAccess;
  refs: {
    products: ReportOption[];
    skus: ReportOption[];
    batches: ReportOption[];
    locations: ReportOption[];
    retailers: ReportOption[];
    branches: ReportOption[];
    suppliers: ReportOption[];
  };
  inventory: {
    rows: InventoryReportRow[];
    movements: MovementReportRow[];
    physicalStock: number;
    availableStock: number;
    incomingStock: number;
    projectedStock: number;
    conditionTotals: Record<InventoryCondition, number>;
    byProductSku: Array<{ id: string; productName: string; skuCode: string; quantity: number; available: number; incoming: number; projected: number }>;
    byLocation: Array<{ id: string; locationName: string; locationType: string; retailerName: string | null; quantity: number; available: number }>;
    lowStock: Array<{ id: string; productName: string; skuCode: string; locationName: string | null; quantity: number; reorderLevel: number; minimumStockLevel: number; severity: "out_of_stock" | "minimum" | "reorder" }>;
  };
  sales: {
    rows: SalesReportRow[];
    grossSales: number;
    discounts: number;
    refunds: number;
    netSales: number;
    completedUnits: number;
    retailerReportedUnits: number;
    channelTotals: Array<{ channel: string; units: number; grossValue: number | null; netValue: number | null }>;
    productTotals: Array<{ id: string; productName: string; skuCode: string; units: number; netValue: number | null; averageSellingPrice: number | null }>;
    trend: Array<{ date: string; units: number; netValue: number }>;
    todayGross: number;
    weekGross: number;
    monthGross: number;
  };
  retailers: {
    rows: RetailerPerformanceRow[];
    totalDeliveries: number;
    totalSold: number;
    averageSellThroughPercent: number;
    lowStockRows: number;
  };
  purchasing: {
    rows: PurchasingReportRow[];
    supplierRows: SupplierPerformanceRow[];
    openOrders: number;
    incomingUnits: number;
    overdueLines: number;
    outstandingPayments: number | null;
    totalOrderValue: number | null;
    totalPaid: number | null;
  };
  valuation: {
    rows: InventoryReportRow[];
    totalValue: number | null;
    sellableValue: number | null;
    restrictedValue: number | null;
    missingCostRows: number;
    byProductSku: Array<{ id: string; productName: string; skuCode: string; quantity: number; unitCost: number | null; value: number | null; missingCost: boolean }>;
    byLocation: Array<{ id: string; locationName: string; quantity: number; value: number | null; missingCostRows: number }>;
    byCondition: Array<{ condition: InventoryCondition; quantity: number; value: number | null; missingCostRows: number }>;
  };
  expiry: {
    rows: InventoryReportRow[];
    wastageRows: MovementReportRow[];
    retailerShelfLifeRisks: Array<{ id: string; retailerName: string; branchName: string; productName: string; skuCode: string; batchNumber: string; daysUntilExpiry: number; requiredShelfLifeDays: number; quantity: number }>;
    expiredQuantity: number;
    approachingQuantity: number;
    affectedValue: number | null;
    missingCostRows: number;
  };
  traceability: {
    selectedBatchId: string | null;
    selectedBatch: ReportOption | null;
    events: TraceabilityEvent[];
    holdings: InventoryReportRow[];
    relatedSales: SalesReportRow[];
    supplierOrManufacturer: string;
    production: { manufacturedOn: string | null; expiresOn: string | null; qualityStatus: string; status: string };
  };
  error: string | null;
};

type DbRow = Record<string, unknown>;
type QueryResult = { data: unknown[] | null; error: { message?: string; code?: string; details?: string | null; hint?: string | null } | null };

const incomingStatuses = new Set(["approved", "sent_to_supplier", "in_production", "partially_ready", "ready_for_dispatch", "in_transit", "partially_received"]);
const openPoStatuses = new Set(["draft", "pending_approval", "approved", "sent_to_supplier", "in_production", "partially_ready", "ready_for_dispatch", "in_transit", "partially_received"]);
const finalPoStatuses = new Set(["fully_received", "cancelled"]);

function hasAnyRole(user: CurrentUser, roles: RoleCode[]) {
  return user.roles.some((role) => roles.includes(role));
}

export function getReportAccess(user: CurrentUser): ReportAccess {
  const director = user.roles.includes("director_admin");
  const auditor = user.roles.includes("auditor_read_only");
  const inventory = hasAnyRole(user, ["director_admin", "inventory_manager", "warehouse_staff", "auditor_read_only"]);
  const sales = hasAnyRole(user, ["director_admin", "sales_manager", "finance_team", "auditor_read_only"]);
  const retailers = hasAnyRole(user, ["director_admin", "sales_manager", "finance_team", "auditor_read_only"]);
  const purchasing = hasAnyRole(user, ["director_admin", "inventory_manager", "warehouse_staff", "finance_team", "auditor_read_only"]);
  const financial = director || auditor || user.roles.includes("finance_team");
  const canExport = director || auditor || hasAnyRole(user, ["inventory_manager", "warehouse_staff", "finance_team", "sales_manager"]);

  return {
    dashboard: director || auditor || inventory || sales || purchasing || user.roles.includes("finance_team"),
    inventory,
    sales,
    retailers,
    purchasing,
    valuation: financial,
    expiry: inventory || financial,
    traceability: inventory || sales || purchasing || auditor || director,
    financial,
    export: canExport,
    restrictedFinancialReason: "Financial values are visible only to Director/Admin, Finance Team and Auditor roles.",
  };
}

export function canViewReport(user: CurrentUser, kind: ReportKind) {
  return getReportAccess(user)[kind];
}

export function canExportReport(user: CurrentUser, kind: ReportKind) {
  const access = getReportAccess(user);
  return access.export && access[kind];
}

function text(row: DbRow | undefined | null, key: string) {
  const value = row?.[key];
  return value === null || value === undefined || value === "" ? null : String(value);
}

function num(row: DbRow | undefined | null, key: string) {
  const value = row?.[key];
  return value === null || value === undefined || value === "" ? 0 : Number(value);
}

function positive(row: DbRow | undefined | null, key: string) {
  const value = num(row, key);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function dateText(row: DbRow | undefined | null, key: string) {
  return text(row, key)?.slice(0, 10) ?? null;
}

function option(row: DbRow, labelKey: string, codeKey?: string, extras: Partial<ReportOption> = {}): ReportOption {
  return { id: String(row.id), label: String(row[labelKey] ?? "—"), code: codeKey ? text(row, codeKey) : null, ...extras };
}

function localDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(from: string | null, to: string | null) {
  if (!from || !to) return null;
  const start = Date.parse(`${from.slice(0, 10)}T00:00:00.000Z`);
  const end = Date.parse(`${to.slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

function inDateRange(date: string | null, from: string, to: string) {
  if (!date) return false;
  const value = date.slice(0, 10);
  return value >= from && value <= to;
}

function normalizeQuery(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function isAll(value: string | null | undefined) {
  return !value || value === "all";
}

function matchesQuery(rowValues: Array<string | null | undefined>, query: string) {
  return !query || rowValues.some((value) => String(value ?? "").toLowerCase().includes(query));
}

function addMapValue<K>(map: Map<K, number>, key: K, value: number) {
  map.set(key, (map.get(key) ?? 0) + value);
}

function nullAwareSum(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value !== null);
  return valid.length === values.length ? valid.reduce((sum, value) => sum + value, 0) : null;
}

function reportError(error: { message?: string; code?: string; details?: string | null; hint?: string | null } | null) {
  if (!error) return "Report data could not be loaded.";
  console.error("[goodlivin:reports] Supabase query failed", {
    code: error.code ?? null,
    message: error.message ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
  });
  return error.message ?? "Report data could not be loaded.";
}

function makeRange(filters: ReportFilters) {
  const today = localDateParts(new Date());
  const defaultFrom = `${today.slice(0, 7)}-01`;
  const from = filters.from?.slice(0, 10) || defaultFrom;
  const to = filters.to?.slice(0, 10) || today;
  return { today, range: { from, to, label: `${from} to ${to}` } };
}

type BaseData = {
  products: DbRow[];
  skus: DbRow[];
  batches: DbRow[];
  balances: DbRow[];
  locations: DbRow[];
  retailers: DbRow[];
  branches: DbRow[];
  suppliers: DbRow[];
  manufacturers: DbRow[];
  movements: DbRow[];
  salesOrders: DbRow[];
  retailerReports: DbRow[];
  returns: DbRow[];
  agreements: DbRow[];
  inboundRows: DbRow[];
  purchaseOrders: DbRow[];
  purchaseOrderLines: DbRow[];
  purchasePayments: DbRow[];
  purchaseReceipts: DbRow[];
  sellThroughRows: DbRow[];
  replenishmentRows: DbRow[];
};

const emptyBaseData: BaseData = {
  products: [],
  skus: [],
  batches: [],
  balances: [],
  locations: [],
  retailers: [],
  branches: [],
  suppliers: [],
  manufacturers: [],
  movements: [],
  salesOrders: [],
  retailerReports: [],
  returns: [],
  agreements: [],
  inboundRows: [],
  purchaseOrders: [],
  purchaseOrderLines: [],
  purchasePayments: [],
  purchaseReceipts: [],
  sellThroughRows: [],
  replenishmentRows: [],
};

async function loadBaseData(): Promise<{ data: BaseData; error: string | null }> {
  if (isDemoMode()) return { data: emptyBaseData, error: null };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { data: emptyBaseData, error: "Supabase is not configured." };

  const [
    products,
    skus,
    batches,
    balances,
    locations,
    retailers,
    branches,
    suppliers,
    manufacturers,
    movements,
    salesOrders,
    retailerReports,
    returns,
    agreements,
    inboundRows,
    purchaseOrders,
    purchaseOrderLines,
    purchasePayments,
    purchaseReceipts,
    sellThroughRows,
    replenishmentRows,
  ] = await Promise.all([
    supabase.from("products").select("id, product_code, name, category, brand, minimum_stock_level, reorder_level, status, supplier_id, manufacturer_id").order("name").limit(REPORT_ROW_LIMIT),
    supabase.from("product_skus").select("id, product_id, sku_code, sellable_name, cost_per_unit, retail_price, wholesale_price, status").order("sellable_name").limit(REPORT_ROW_LIMIT),
    supabase.from("product_batches").select("id, product_id, sku_id, batch_number, manufactured_on, received_on, expires_on, quality_status, unit_cost, purchase_cost, supplier_id, manufacturer_id, status, created_at").order("expires_on").limit(REPORT_ROW_LIMIT),
    supabase.from("stock_balances").select("product_id, batch_id, location_id, quantity_on_hand").limit(REPORT_ROW_LIMIT),
    supabase.from("inventory_locations").select("id, code, name, location_type, retailer_id, branch_id, status").order("name").limit(REPORT_ROW_LIMIT),
    supabase.from("retailers").select("id, code, name, status").order("name").limit(REPORT_ROW_LIMIT),
    supabase.from("retailer_branches").select("id, retailer_id, code, name, status").order("name").limit(REPORT_ROW_LIMIT),
    supabase.from("suppliers").select("id, code, name, status").order("name").limit(REPORT_ROW_LIMIT),
    supabase.from("manufacturers").select("id, code, name, status").order("name").limit(REPORT_ROW_LIMIT),
    supabase.from("stock_movements").select("id, movement_number, movement_type, status, product_id, sku_id, batch_id, source_location_id, destination_location_id, quantity, unit_cost, currency_code, reference_type, reference_id, reason, created_at, posted_at, reversal_of_id").order("created_at", { ascending: false }).limit(REPORT_ROW_LIMIT),
    supabase.from("sales_orders").select("id, order_number, sale_date, sales_channel, fulfilment_location_id, retailer_id, branch_id, product_id, sku_id, batch_id, quantity, selling_price, discount, total_value, currency_code, status, return_condition, movement_id, refund_movement_id, created_at, fulfilled_at, refunded_at, cancelled_at").order("sale_date", { ascending: false }).limit(REPORT_ROW_LIMIT),
    supabase.from("retailer_sales_reports").select("id, report_number, report_date, period_start, period_end, retailer_id, branch_id, product_id, sku_id, batch_id, quantity_sold, returns_quantity, damaged_quantity, expired_quantity, status, created_at, posted_at").order("report_date", { ascending: false }).limit(REPORT_ROW_LIMIT),
    supabase.from("inventory_returns").select("id, return_number, return_type, return_date, retailer_id, branch_id, source_location_id, destination_location_id, product_id, sku_id, batch_id, quantity, condition, status, created_at, posted_at").order("return_date", { ascending: false }).limit(REPORT_ROW_LIMIT),
    supabase.from("retailer_commercial_agreements").select("id, retailer_id, agreement_number, arrangement_type, retailer_margin_percent, payment_terms_days, credit_limit, minimum_shelf_life_days, effective_from, effective_to, status").order("effective_from", { ascending: false }).limit(REPORT_ROW_LIMIT),
    supabase.from("purchase_order_inbound").select("*").order("expected_delivery_date", { ascending: true, nullsFirst: false }).limit(REPORT_ROW_LIMIT),
    supabase.from("purchase_orders").select("id, po_number, supplier_id, manufacturer_id, order_date, expected_delivery_date, receiving_location_id, currency_code, total_amount, status, created_at").order("created_at", { ascending: false }).limit(REPORT_ROW_LIMIT),
    supabase.from("purchase_order_lines").select("id, purchase_order_id, product_id, sku_id, quantity_ordered, unit_cost, discount_amount, line_total").limit(REPORT_ROW_LIMIT),
    supabase.from("purchase_order_payments").select("id, purchase_order_id, payment_number, payment_type, payment_date, amount, currency_code, created_at").order("payment_date", { ascending: false }).limit(REPORT_ROW_LIMIT),
    supabase.from("purchase_order_receipts").select("id, purchase_order_id, purchase_order_line_id, receipt_number, received_on, receiving_location_id, batch_id, quantity_accepted, quantity_damaged, quantity_rejected, quantity_quarantined, total_received, status, created_at").order("received_on", { ascending: false }).limit(REPORT_ROW_LIMIT),
    supabase.from("retailer_sell_through").select("*").order("branch_name").limit(REPORT_ROW_LIMIT),
    supabase.from("replenishment_recommendations").select("*").order("suggested_quantity", { ascending: false }).limit(REPORT_ROW_LIMIT),
  ]);

  const firstError = ([
    products,
    skus,
    batches,
    balances,
    locations,
    retailers,
    branches,
    suppliers,
    manufacturers,
    movements,
    salesOrders,
    retailerReports,
    returns,
    agreements,
    inboundRows,
    purchaseOrders,
    purchaseOrderLines,
    purchasePayments,
    purchaseReceipts,
    sellThroughRows,
    replenishmentRows,
  ] as QueryResult[]).find((result) => result.error)?.error;

  if (firstError) return { data: emptyBaseData, error: reportError(firstError) };

  return {
    data: {
      products: (products.data ?? []) as DbRow[],
      skus: (skus.data ?? []) as DbRow[],
      batches: (batches.data ?? []) as DbRow[],
      balances: (balances.data ?? []) as DbRow[],
      locations: (locations.data ?? []) as DbRow[],
      retailers: (retailers.data ?? []) as DbRow[],
      branches: (branches.data ?? []) as DbRow[],
      suppliers: (suppliers.data ?? []) as DbRow[],
      manufacturers: (manufacturers.data ?? []) as DbRow[],
      movements: (movements.data ?? []) as DbRow[],
      salesOrders: (salesOrders.data ?? []) as DbRow[],
      retailerReports: (retailerReports.data ?? []) as DbRow[],
      returns: (returns.data ?? []) as DbRow[],
      agreements: (agreements.data ?? []) as DbRow[],
      inboundRows: (inboundRows.data ?? []) as DbRow[],
      purchaseOrders: (purchaseOrders.data ?? []) as DbRow[],
      purchaseOrderLines: (purchaseOrderLines.data ?? []) as DbRow[],
      purchasePayments: (purchasePayments.data ?? []) as DbRow[],
      purchaseReceipts: (purchaseReceipts.data ?? []) as DbRow[],
      sellThroughRows: (sellThroughRows.data ?? []) as DbRow[],
      replenishmentRows: (replenishmentRows.data ?? []) as DbRow[],
    },
    error: null,
  };
}

function buildMaps(data: BaseData) {
  return {
    products: new Map(data.products.map((row) => [String(row.id), row])),
    skus: new Map(data.skus.map((row) => [String(row.id), row])),
    batches: new Map(data.batches.map((row) => [String(row.id), row])),
    locations: new Map(data.locations.map((row) => [String(row.id), row])),
    retailers: new Map(data.retailers.map((row) => [String(row.id), row])),
    branches: new Map(data.branches.map((row) => [String(row.id), row])),
    suppliers: new Map(data.suppliers.map((row) => [String(row.id), row])),
    manufacturers: new Map(data.manufacturers.map((row) => [String(row.id), row])),
    purchaseOrders: new Map(data.purchaseOrders.map((row) => [String(row.id), row])),
    purchaseLines: new Map(data.purchaseOrderLines.map((row) => [String(row.id), row])),
  };
}

function costForBatch(batch: DbRow | undefined, sku: DbRow | undefined, movementCostByBatch: Map<string, number>) {
  const batchId = text(batch, "id");
  const batchUnitCost = positive(batch, "unit_cost");
  if (batchUnitCost !== null) return { unitCost: batchUnitCost, basis: "Batch unit cost" };
  const purchaseCost = positive(batch, "purchase_cost");
  if (purchaseCost !== null) return { unitCost: purchaseCost, basis: "Batch purchase cost" };
  if (batchId && movementCostByBatch.has(batchId)) return { unitCost: movementCostByBatch.get(batchId) ?? null, basis: "Weighted movement cost" };
  const skuCost = positive(sku, "cost_per_unit");
  if (skuCost !== null) return { unitCost: skuCost, basis: "SKU cost per unit" };
  return { unitCost: null, basis: "Missing cost" };
}

function stockCondition(batch: DbRow | undefined, location: DbRow | undefined, today: string): InventoryCondition {
  const locationType = text(location, "location_type") ?? "";
  const qualityStatus = text(batch, "quality_status") ?? "pending";
  const expiresOn = dateText(batch, "expires_on");
  if (qualityStatus === "rejected" || qualityStatus === "recalled") return "rejected";
  if (locationType === "expired_stock" || (expiresOn !== null && expiresOn < today)) return "expired";
  if (locationType === "damaged_stock") return "damaged";
  if (["quarantine", "quarantine_stock"].includes(locationType) || qualityStatus === "quarantined") return "quarantined";
  if (qualityStatus === "approved") return "sellable";
  return "pending";
}

function buildMovementRows(data: BaseData, filters: ReportFilters): MovementReportRow[] {
  const maps = buildMaps(data);
  const query = normalizeQuery(filters.q);
  return data.movements
    .map((row) => {
      const product = maps.products.get(String(row.product_id));
      const sku = row.sku_id ? maps.skus.get(String(row.sku_id)) : null;
      const batch = maps.batches.get(String(row.batch_id));
      const source = row.source_location_id ? maps.locations.get(String(row.source_location_id)) : null;
      const destination = row.destination_location_id ? maps.locations.get(String(row.destination_location_id)) : null;
      return {
        id: String(row.id),
        movementNumber: num(row, "movement_number"),
        movementType: String(row.movement_type ?? "unknown"),
        status: String(row.status ?? "draft"),
        productId: String(row.product_id),
        productName: String(product?.name ?? "Unknown product"),
        skuId: text(row, "sku_id"),
        skuCode: String(sku?.sku_code ?? "—"),
        batchId: String(row.batch_id),
        batchNumber: String(batch?.batch_number ?? "—"),
        sourceLocationId: text(row, "source_location_id"),
        sourceLocationName: source ? String(source.name) : null,
        destinationLocationId: text(row, "destination_location_id"),
        destinationLocationName: destination ? String(destination.name) : null,
        quantity: num(row, "quantity"),
        unitCost: positive(row, "unit_cost"),
        referenceType: text(row, "reference_type"),
        referenceId: text(row, "reference_id"),
        reason: text(row, "reason"),
        createdAt: String(row.created_at),
        postedAt: text(row, "posted_at"),
      } satisfies MovementReportRow;
    })
    .filter((row) => row.status === "posted")
    .filter((row) => isAll(filters.movementType) || row.movementType === filters.movementType)
    .filter((row) => !filters.from || (row.postedAt ?? row.createdAt) >= `${filters.from}T00:00:00`)
    .filter((row) => !filters.to || (row.postedAt ?? row.createdAt) <= `${filters.to}T23:59:59`)
    .filter((row) => isAll(filters.productId) || row.productId === filters.productId)
    .filter((row) => isAll(filters.skuId) || row.skuId === filters.skuId)
    .filter((row) => isAll(filters.batchId) || row.batchId === filters.batchId)
    .filter((row) => isAll(filters.locationId) || row.sourceLocationId === filters.locationId || row.destinationLocationId === filters.locationId)
    .filter((row) => matchesQuery([row.productName, row.skuCode, row.batchNumber, row.sourceLocationName, row.destinationLocationName, row.referenceType, row.reason], query));
}

function buildInventoryRows(data: BaseData, filters: ReportFilters, today: string): InventoryReportRow[] {
  const maps = buildMaps(data);
  const query = normalizeQuery(filters.q);
  const lastMovementByBalance = new Map<string, string>();
  const movementCostTotals = new Map<string, { costQuantity: number; costTotal: number }>();

  data.movements.forEach((row) => {
    if (String(row.status) !== "posted") return;
    const createdAt = String(row.posted_at ?? row.created_at);
    [text(row, "source_location_id"), text(row, "destination_location_id")].filter(Boolean).forEach((locationId) => {
      const key = `${row.product_id}:${row.batch_id}:${locationId}`;
      if (!lastMovementByBalance.has(key) || createdAt > String(lastMovementByBalance.get(key))) lastMovementByBalance.set(key, createdAt);
    });
    const unitCost = positive(row, "unit_cost");
    if (unitCost !== null) {
      const batchId = String(row.batch_id);
      const existing = movementCostTotals.get(batchId) ?? { costQuantity: 0, costTotal: 0 };
      existing.costQuantity += num(row, "quantity");
      existing.costTotal += num(row, "quantity") * unitCost;
      movementCostTotals.set(batchId, existing);
    }
  });

  const movementCostByBatch = new Map<string, number>();
  movementCostTotals.forEach((value, batchId) => {
    if (value.costQuantity > 0) movementCostByBatch.set(batchId, value.costTotal / value.costQuantity);
  });

  return data.balances
    .map((row, index) => {
      const product = maps.products.get(String(row.product_id));
      const batch = maps.batches.get(String(row.batch_id));
      const skuId = String(batch?.sku_id ?? row.sku_id ?? "");
      const sku = maps.skus.get(skuId);
      const location = maps.locations.get(String(row.location_id));
      const retailer = location?.retailer_id ? maps.retailers.get(String(location.retailer_id)) : null;
      const branch = location?.branch_id ? maps.branches.get(String(location.branch_id)) : null;
      const condition = stockCondition(batch, location, today);
      const quantityOnHand = num(row, "quantity_on_hand");
      const cost = costForBatch(batch, sku, movementCostByBatch);
      const expiresOn = dateText(batch, "expires_on");
      const unitCost = cost.unitCost;

      return {
        id: `${row.product_id}-${row.batch_id}-${row.location_id}-${index}`,
        productId: String(row.product_id),
        productCode: String(product?.product_code ?? "—"),
        productName: String(product?.name ?? "Unknown product"),
        skuId: String(sku?.id ?? skuId),
        skuCode: String(sku?.sku_code ?? "—"),
        skuName: String(sku?.sellable_name ?? "Unknown SKU"),
        batchId: String(row.batch_id),
        batchNumber: String(batch?.batch_number ?? "—"),
        locationId: String(row.location_id),
        locationCode: String(location?.code ?? "—"),
        locationName: String(location?.name ?? "Unknown location"),
        locationType: String(location?.location_type ?? "unknown"),
        retailerId: text(location, "retailer_id"),
        retailerName: retailer ? String(retailer.name) : null,
        branchId: text(location, "branch_id"),
        branchName: branch ? String(branch.name) : null,
        quantityOnHand,
        availableQuantity: condition === "sellable" ? quantityOnHand : 0,
        condition,
        qualityStatus: String(batch?.quality_status ?? "pending"),
        expiresOn,
        daysUntilExpiry: daysBetween(today, expiresOn),
        minimumStockLevel: num(product, "minimum_stock_level"),
        reorderLevel: num(product, "reorder_level"),
        unitCost,
        costBasis: cost.basis,
        totalValue: unitCost === null ? null : unitCost * quantityOnHand,
        lastMovementAt: lastMovementByBalance.get(`${row.product_id}:${row.batch_id}:${row.location_id}`) ?? null,
      } satisfies InventoryReportRow;
    })
    .filter((row) => row.quantityOnHand !== 0)
    .filter((row) => matchesQuery([row.productName, row.productCode, row.skuName, row.skuCode, row.batchNumber, row.locationName, row.locationCode, row.retailerName, row.branchName], query))
    .filter((row) => isAll(filters.productId) || row.productId === filters.productId)
    .filter((row) => isAll(filters.skuId) || row.skuId === filters.skuId)
    .filter((row) => isAll(filters.batchId) || row.batchId === filters.batchId)
    .filter((row) => isAll(filters.locationId) || row.locationId === filters.locationId)
    .filter((row) => isAll(filters.retailerId) || row.retailerId === filters.retailerId)
    .filter((row) => isAll(filters.branchId) || row.branchId === filters.branchId)
    .filter((row) => isAll(filters.condition) || row.condition === filters.condition);
}

function buildIncomingBySku(data: BaseData) {
  const map = new Map<string, number>();
  data.inboundRows.forEach((row) => {
    if (!incomingStatuses.has(String(row.status))) return;
    addMapValue(map, `${row.product_id}:${row.sku_id}`, num(row, "quantity_outstanding"));
  });
  return map;
}

function buildInventorySummary(rows: InventoryReportRow[], data: BaseData) {
  const incomingBySku = buildIncomingBySku(data);
  const conditionTotals: Record<InventoryCondition, number> = { sellable: 0, damaged: 0, quarantined: 0, rejected: 0, expired: 0, pending: 0 };
  rows.forEach((row) => {
    conditionTotals[row.condition] += row.quantityOnHand;
  });

  const byProductMap = new Map<string, { id: string; productName: string; skuCode: string; quantity: number; available: number; incoming: number; projected: number }>();
  rows.forEach((row) => {
    const key = `${row.productId}:${row.skuId}`;
    const existing = byProductMap.get(key) ?? { id: key, productName: row.productName, skuCode: row.skuCode, quantity: 0, available: 0, incoming: incomingBySku.get(key) ?? 0, projected: 0 };
    existing.quantity += row.quantityOnHand;
    existing.available += row.availableQuantity;
    existing.projected = existing.quantity + existing.incoming;
    byProductMap.set(key, existing);
  });

  data.inboundRows.forEach((row) => {
    if (!incomingStatuses.has(String(row.status))) return;
    const key = `${row.product_id}:${row.sku_id}`;
    if (!byProductMap.has(key)) {
      const product = data.products.find((productRow) => String(productRow.id) === String(row.product_id));
      const sku = data.skus.find((skuRow) => String(skuRow.id) === String(row.sku_id));
      byProductMap.set(key, {
        id: key,
        productName: String(product?.name ?? row.product_name ?? "Unknown product"),
        skuCode: String(sku?.sku_code ?? row.sku_code ?? "—"),
        quantity: 0,
        available: 0,
        incoming: num(row, "quantity_outstanding"),
        projected: num(row, "quantity_outstanding"),
      });
    }
  });

  const byLocationMap = new Map<string, { id: string; locationName: string; locationType: string; retailerName: string | null; quantity: number; available: number }>();
  rows.forEach((row) => {
    const existing = byLocationMap.get(row.locationId) ?? { id: row.locationId, locationName: row.locationName, locationType: row.locationType, retailerName: row.retailerName, quantity: 0, available: 0 };
    existing.quantity += row.quantityOnHand;
    existing.available += row.availableQuantity;
    byLocationMap.set(row.locationId, existing);
  });

  const lowStock: ReportModel["inventory"]["lowStock"] = [];
  byProductMap.forEach((row) => {
    const source = rows.find((inventoryRow) => `${inventoryRow.productId}:${inventoryRow.skuId}` === row.id);
    if (!source) return;
    const severity = row.quantity <= 0 ? "out_of_stock" : source.minimumStockLevel > 0 && row.quantity <= source.minimumStockLevel ? "minimum" : source.reorderLevel > 0 && row.quantity <= source.reorderLevel ? "reorder" : null;
    if (severity) lowStock.push({ id: row.id, productName: row.productName, skuCode: row.skuCode, locationName: null, quantity: row.quantity, reorderLevel: source.reorderLevel, minimumStockLevel: source.minimumStockLevel, severity });
  });

  rows.forEach((row) => {
    const severity = row.quantityOnHand <= 0 ? "out_of_stock" : row.minimumStockLevel > 0 && row.quantityOnHand <= row.minimumStockLevel ? "minimum" : null;
    if (severity) lowStock.push({ id: `${row.id}:location`, productName: row.productName, skuCode: row.skuCode, locationName: row.locationName, quantity: row.quantityOnHand, reorderLevel: row.reorderLevel, minimumStockLevel: row.minimumStockLevel, severity });
  });

  const incomingStock = Array.from(incomingBySku.values()).reduce((sum, value) => sum + value, 0);
  const physicalStock = rows.reduce((sum, row) => sum + row.quantityOnHand, 0);
  const availableStock = rows.reduce((sum, row) => sum + row.availableQuantity, 0);

  return {
    physicalStock,
    availableStock,
    incomingStock,
    projectedStock: physicalStock + incomingStock,
    conditionTotals,
    byProductSku: Array.from(byProductMap.values()).sort((a, b) => b.quantity - a.quantity),
    byLocation: Array.from(byLocationMap.values()).sort((a, b) => b.quantity - a.quantity),
    lowStock: lowStock.sort((a, b) => a.quantity - b.quantity).slice(0, 30),
  };
}

function buildSalesRows(data: BaseData, filters: ReportFilters, range: { from: string; to: string }): SalesReportRow[] {
  const maps = buildMaps(data);
  const query = normalizeQuery(filters.q);
  const orderRows = data.salesOrders
    .map((row) => {
      const product = maps.products.get(String(row.product_id));
      const sku = maps.skus.get(String(row.sku_id));
      const retailer = row.retailer_id ? maps.retailers.get(String(row.retailer_id)) : null;
      const branch = row.branch_id ? maps.branches.get(String(row.branch_id)) : null;
      const isRefunded = String(row.status) === "refunded";
      const quantity = num(row, "quantity");
      const grossValue = num(row, "total_value");
      const discount = num(row, "discount");
      return {
        id: String(row.id),
        recordType: "sales_order" as const,
        reference: String(row.order_number),
        date: String(row.sale_date),
        channel: String(row.sales_channel),
        status: String(row.status),
        productId: String(row.product_id),
        productName: String(product?.name ?? "Unknown product"),
        skuId: String(row.sku_id),
        skuCode: String(sku?.sku_code ?? "—"),
        retailerId: text(row, "retailer_id"),
        retailerName: retailer ? String(retailer.name) : null,
        branchId: text(row, "branch_id"),
        branchName: branch ? String(branch.name) : null,
        unitsSold: ["fulfilled", "refunded"].includes(String(row.status)) ? quantity : 0,
        returnedUnits: isRefunded ? quantity : 0,
        damagedUnits: 0,
        expiredUnits: 0,
        grossValue: ["fulfilled", "refunded"].includes(String(row.status)) ? grossValue : 0,
        discounts: ["fulfilled", "refunded"].includes(String(row.status)) ? discount : 0,
        refunds: isRefunded ? grossValue : 0,
        netValue: ["fulfilled", "refunded"].includes(String(row.status)) ? grossValue - (isRefunded ? grossValue : 0) : 0,
        averageSellingPrice: quantity > 0 ? num(row, "selling_price") : null,
        note: String(row.status) === "pending" || String(row.status) === "cancelled" ? "Excluded from completed revenue." : isRefunded ? "Refunded order is shown as gross revenue with equal refund, net zero." : "Fulfilled order included once.",
      } satisfies SalesReportRow;
    });

  const retailerRows = data.retailerReports.map((row) => {
    const product = maps.products.get(String(row.product_id));
    const sku = maps.skus.get(String(row.sku_id));
    const retailer = maps.retailers.get(String(row.retailer_id));
    const branch = maps.branches.get(String(row.branch_id));
    return {
      id: String(row.id),
      recordType: "retailer_report" as const,
      reference: String(row.report_number),
      date: String(row.report_date),
      channel: "retailer_sell_through",
      status: String(row.status),
      productId: String(row.product_id),
      productName: String(product?.name ?? "Unknown product"),
      skuId: String(row.sku_id),
      skuCode: String(sku?.sku_code ?? "—"),
      retailerId: text(row, "retailer_id"),
      retailerName: retailer ? String(retailer.name) : null,
      branchId: text(row, "branch_id"),
      branchName: branch ? String(branch.name) : null,
      unitsSold: String(row.status) === "posted" ? num(row, "quantity_sold") : 0,
      returnedUnits: String(row.status) === "posted" ? num(row, "returns_quantity") : 0,
      damagedUnits: String(row.status) === "posted" ? num(row, "damaged_quantity") : 0,
      expiredUnits: String(row.status) === "posted" ? num(row, "expired_quantity") : 0,
      grossValue: null,
      discounts: null,
      refunds: null,
      netValue: null,
      averageSellingPrice: null,
      note: String(row.status) === "posted" ? "Retailer sell-through reports record units only in Stage 5; no revenue is invented." : "Pending/cancelled retailer reports are excluded from completed sell-through.",
    } satisfies SalesReportRow;
  });

  return [...orderRows, ...retailerRows]
    .filter((row) => inDateRange(row.date, range.from, range.to))
    .filter((row) => isAll(filters.channel) || row.channel === filters.channel)
    .filter((row) => isAll(filters.status) || row.status === filters.status)
    .filter((row) => isAll(filters.productId) || row.productId === filters.productId)
    .filter((row) => isAll(filters.skuId) || row.skuId === filters.skuId)
    .filter((row) => isAll(filters.retailerId) || row.retailerId === filters.retailerId)
    .filter((row) => isAll(filters.branchId) || row.branchId === filters.branchId)
    .filter((row) => matchesQuery([row.reference, row.productName, row.skuCode, row.retailerName, row.branchName, row.channel], query))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function buildSalesSummary(rows: SalesReportRow[], data: BaseData, today: string) {
  const grossSales = rows.reduce((sum, row) => sum + (row.grossValue ?? 0), 0);
  const discounts = rows.reduce((sum, row) => sum + (row.discounts ?? 0), 0);
  const refunds = rows.reduce((sum, row) => sum + (row.refunds ?? 0), 0);
  const netSales = rows.reduce((sum, row) => sum + (row.netValue ?? 0), 0);
  const completedUnits = rows.filter((row) => row.recordType === "sales_order").reduce((sum, row) => sum + row.unitsSold - row.returnedUnits, 0);
  const retailerReportedUnits = rows.filter((row) => row.recordType === "retailer_report").reduce((sum, row) => sum + row.unitsSold, 0);
  const channelMap = new Map<string, { channel: string; units: number; grossValues: Array<number | null>; netValues: Array<number | null> }>();
  const productMap = new Map<string, { id: string; productName: string; skuCode: string; units: number; netValues: Array<number | null> }>();
  const trendMap = new Map<string, { date: string; units: number; netValue: number }>();

  rows.forEach((row) => {
    const channel = channelMap.get(row.channel) ?? { channel: row.channel, units: 0, grossValues: [], netValues: [] };
    channel.units += row.unitsSold;
    channel.grossValues.push(row.grossValue);
    channel.netValues.push(row.netValue);
    channelMap.set(row.channel, channel);

    const productKey = `${row.productId}:${row.skuId}`;
    const product = productMap.get(productKey) ?? { id: productKey, productName: row.productName, skuCode: row.skuCode, units: 0, netValues: [] };
    product.units += row.unitsSold;
    product.netValues.push(row.netValue);
    productMap.set(productKey, product);

    const trend = trendMap.get(row.date) ?? { date: row.date, units: 0, netValue: 0 };
    trend.units += row.unitsSold - row.returnedUnits;
    trend.netValue += row.netValue ?? 0;
    trendMap.set(row.date, trend);
  });

  const completedOrders = data.salesOrders.filter((row) => ["fulfilled", "refunded"].includes(String(row.status)));
  const mondayOffset = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const weekStart = addDays(today, -mondayOffset);
  const monthStart = `${today.slice(0, 7)}-01`;
  const sumSalesInRange = (from: string, to: string) => completedOrders
    .filter((row) => inDateRange(dateText(row, "sale_date"), from, to))
    .reduce((sum, row) => sum + num(row, "total_value") - (String(row.status) === "refunded" ? num(row, "total_value") : 0), 0);

  return {
    grossSales,
    discounts,
    refunds,
    netSales,
    completedUnits,
    retailerReportedUnits,
    channelTotals: Array.from(channelMap.values()).map((row) => ({ channel: row.channel, units: row.units, grossValue: nullAwareSum(row.grossValues), netValue: nullAwareSum(row.netValues) })).sort((a, b) => b.units - a.units),
    productTotals: Array.from(productMap.values()).map((row) => {
      const netValue = nullAwareSum(row.netValues);
      return { id: row.id, productName: row.productName, skuCode: row.skuCode, units: row.units, netValue, averageSellingPrice: netValue === null || row.units <= 0 ? null : netValue / row.units };
    }).sort((a, b) => b.units - a.units),
    trend: Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    todayGross: sumSalesInRange(today, today),
    weekGross: sumSalesInRange(weekStart, today),
    monthGross: sumSalesInRange(monthStart, today),
  };
}

function buildRetailerRows(data: BaseData, filters: ReportFilters): RetailerPerformanceRow[] {
  const query = normalizeQuery(filters.q);
  const replenishmentByBranchSku = new Map(data.replenishmentRows.map((row) => [`${row.branch_id}:${row.sku_id}`, row]));

  return data.sellThroughRows
    .map((row) => {
      const replenishment = replenishmentByBranchSku.get(`${row.branch_id}:${row.sku_id}`);
      const suggestedQuantity = num(replenishment, "suggested_quantity");
      const avgDailySales = positive(replenishment, "avg_daily_sales") ?? 0;
      return {
        id: `${row.branch_id}:${row.sku_id}`,
        retailerId: String(row.retailer_id),
        retailerName: String(row.retailer_name ?? "Retailer"),
        branchId: String(row.branch_id),
        branchCode: String(row.branch_code ?? "—"),
        branchName: String(row.branch_name ?? "Unknown branch"),
        productId: String(row.product_id),
        productCode: String(row.product_code ?? "—"),
        productName: String(row.product_name ?? "Unknown product"),
        skuId: String(row.sku_id),
        skuCode: String(row.sku_code ?? "—"),
        skuName: String(row.sellable_name ?? "Unknown SKU"),
        openingStock: num(row, "opening_stock"),
        deliveries: num(row, "deliveries"),
        unitsSold: num(row, "sold"),
        returns: num(row, "returns_sent_back"),
        damaged: num(row, "damaged"),
        expired: num(row, "expired"),
        currentStock: num(row, "current_stock"),
        sellThroughPercent: num(row, "sell_through_percent"),
        averageDailySales: avgDailySales,
        lastReportDate: dateText(row, "last_report_date"),
        daysSinceLastReport: num(row, "days_since_last_report"),
        lowStockStatus: suggestedQuantity > 0 ? String(replenishment?.recommendation_status ?? "replenishment suggested") : "healthy",
        suggestedReplenishmentQuantity: suggestedQuantity,
      } satisfies RetailerPerformanceRow;
    })
    .filter((row) => isAll(filters.retailerId) || row.retailerId === filters.retailerId)
    .filter((row) => isAll(filters.branchId) || row.branchId === filters.branchId)
    .filter((row) => isAll(filters.productId) || row.productId === filters.productId)
    .filter((row) => isAll(filters.skuId) || row.skuId === filters.skuId)
    .filter((row) => matchesQuery([row.retailerName, row.branchName, row.productName, row.skuCode], query))
    .sort((a, b) => b.suggestedReplenishmentQuantity - a.suggestedReplenishmentQuantity);
}

function buildPurchasingRows(data: BaseData, filters: ReportFilters, range: { from: string; to: string }): PurchasingReportRow[] {
  const maps = buildMaps(data);
  const query = normalizeQuery(filters.q);
  const lineCostMap = new Map(data.purchaseOrderLines.map((row) => [String(row.id), row]));

  return data.inboundRows
    .map((row) => {
      const line = lineCostMap.get(String(row.line_id));
      const order = maps.purchaseOrders.get(String(row.purchase_order_id));
      const manufacturer = order?.manufacturer_id ? maps.manufacturers.get(String(order.manufacturer_id)) : null;
      return {
        id: String(row.line_id),
        poNumber: String(row.po_number),
        status: String(row.status),
        orderDate: String(row.order_date),
        expectedDeliveryDate: dateText(row, "expected_delivery_date"),
        supplierId: text(row, "supplier_id"),
        supplierName: text(row, "supplier_name"),
        manufacturerId: text(order, "manufacturer_id"),
        manufacturerName: manufacturer ? String(manufacturer.name) : null,
        receivingLocationName: String(row.receiving_location_name ?? "Unknown location"),
        productId: String(row.product_id),
        productName: String(row.product_name),
        skuId: String(row.sku_id),
        skuCode: String(row.sku_code),
        quantityOrdered: num(row, "quantity_ordered"),
        quantityReceived: num(row, "quantity_received"),
        quantityOutstanding: num(row, "quantity_outstanding"),
        daysOverdue: num(row, "days_overdue"),
        unitCost: positive(line, "unit_cost"),
        lineValue: positive(line, "line_total"),
      } satisfies PurchasingReportRow;
    })
    .filter((row) => inDateRange(row.orderDate, range.from, range.to) || (row.expectedDeliveryDate !== null && inDateRange(row.expectedDeliveryDate, range.from, range.to)) || row.quantityOutstanding > 0)
    .filter((row) => isAll(filters.status) || row.status === filters.status)
    .filter((row) => isAll(filters.supplierId) || row.supplierId === filters.supplierId || row.manufacturerId === filters.supplierId)
    .filter((row) => isAll(filters.productId) || row.productId === filters.productId)
    .filter((row) => isAll(filters.skuId) || row.skuId === filters.skuId)
    .filter((row) => matchesQuery([row.poNumber, row.supplierName, row.manufacturerName, row.productName, row.skuCode, row.receivingLocationName], query))
    .sort((a, b) => (b.expectedDeliveryDate ?? b.orderDate).localeCompare(a.expectedDeliveryDate ?? a.orderDate));
}

function buildPurchasingSummary(rows: PurchasingReportRow[], data: BaseData, access: ReportAccess) {
  const ordersById = new Map(data.purchaseOrders.map((row) => [String(row.id), row]));
  const paymentsByOrder = new Map<string, number>();
  data.purchasePayments.forEach((row) => addMapValue(paymentsByOrder, String(row.purchase_order_id), num(row, "amount")));

  const orderLineById = new Map(data.purchaseOrderLines.map((row) => [String(row.id), row]));
  const orderIdByLine = new Map(data.purchaseOrderLines.map((row) => [String(row.id), String(row.purchase_order_id)]));
  const receivedLeadTimes = new Map<string, number[]>();
  data.purchaseReceipts.forEach((row) => {
    if (String(row.status) !== "posted") return;
    const orderId = text(row, "purchase_order_id") ?? orderIdByLine.get(String(row.purchase_order_line_id));
    if (!orderId) return;
    const order = ordersById.get(orderId);
    const lead = daysBetween(dateText(order, "order_date"), dateText(row, "received_on"));
    if (lead === null) return;
    const supplierKey = text(order, "supplier_id") ?? text(order, "manufacturer_id") ?? "unknown";
    const list = receivedLeadTimes.get(supplierKey) ?? [];
    list.push(lead);
    receivedLeadTimes.set(supplierKey, list);
  });

  const supplierMap = new Map<string, SupplierPerformanceRow>();
  rows.forEach((row) => {
    const id = row.supplierId ?? row.manufacturerId ?? "unknown";
    const existing = supplierMap.get(id) ?? {
      id,
      supplierName: row.supplierName ?? row.manufacturerName ?? "Unassigned supplier/manufacturer",
      orderedQuantity: 0,
      receivedQuantity: 0,
      outstandingQuantity: 0,
      openOrders: 0,
      overdueLines: 0,
      averageLeadTimeDays: null,
      totalValue: access.financial ? 0 : null,
      amountPaid: access.financial ? 0 : null,
      balanceRemaining: access.financial ? 0 : null,
    };
    existing.orderedQuantity += row.quantityOrdered;
    existing.receivedQuantity += row.quantityReceived;
    existing.outstandingQuantity += row.quantityOutstanding;
    if (!finalPoStatuses.has(row.status)) existing.openOrders += 1;
    if (row.daysOverdue > 0 && row.quantityOutstanding > 0) existing.overdueLines += 1;
    if (access.financial) existing.totalValue = (existing.totalValue ?? 0) + (row.lineValue ?? 0);
    supplierMap.set(id, existing);
  });

  supplierMap.forEach((row) => {
    const leadTimes = receivedLeadTimes.get(row.id) ?? [];
    row.averageLeadTimeDays = leadTimes.length ? leadTimes.reduce((sum, value) => sum + value, 0) / leadTimes.length : null;
    if (access.financial) {
      const orderIds = rows.filter((candidate) => (candidate.supplierId ?? candidate.manufacturerId ?? "unknown") === row.id).map((candidate) => {
        const line = orderLineById.get(candidate.id);
        return text(line, "purchase_order_id");
      }).filter((value): value is string => Boolean(value));
      const paid = Array.from(new Set(orderIds)).reduce((sum, orderId) => sum + (paymentsByOrder.get(orderId) ?? 0), 0);
      row.amountPaid = paid;
      row.balanceRemaining = Math.max(0, (row.totalValue ?? 0) - paid);
    }
  });

  const openOrderIds = new Set(rows.filter((row) => openPoStatuses.has(row.status)).map((row) => row.poNumber));
  const incomingUnits = rows.filter((row) => incomingStatuses.has(row.status)).reduce((sum, row) => sum + row.quantityOutstanding, 0);
  const totalOrderValue = access.financial ? rows.reduce((sum, row) => sum + (row.lineValue ?? 0), 0) : null;
  const totalPaid = access.financial ? data.purchasePayments.reduce((sum, row) => sum + num(row, "amount"), 0) : null;

  return {
    supplierRows: Array.from(supplierMap.values()).sort((a, b) => b.outstandingQuantity - a.outstandingQuantity),
    openOrders: openOrderIds.size,
    incomingUnits,
    overdueLines: rows.filter((row) => row.daysOverdue > 0 && row.quantityOutstanding > 0).length,
    outstandingPayments: access.financial && totalOrderValue !== null && totalPaid !== null ? Math.max(0, totalOrderValue - totalPaid) : null,
    totalOrderValue,
    totalPaid,
  };
}

function buildValuation(rows: InventoryReportRow[]) {
  const valueRows = rows.filter((row) => row.quantityOnHand !== 0);
  const missingCostRows = valueRows.filter((row) => row.unitCost === null).length;
  const totalValue = nullAwareSum(valueRows.map((row) => row.totalValue));
  const sellableValue = nullAwareSum(valueRows.filter((row) => row.condition === "sellable").map((row) => row.totalValue));
  const restrictedValue = nullAwareSum(valueRows.filter((row) => row.condition !== "sellable").map((row) => row.totalValue));

  const productMap = new Map<string, { id: string; productName: string; skuCode: string; quantity: number; values: Array<number | null>; unitCost: number | null; missingCost: boolean }>();
  const locationMap = new Map<string, { id: string; locationName: string; quantity: number; values: Array<number | null>; missingCostRows: number }>();
  const conditionMap = new Map<InventoryCondition, { condition: InventoryCondition; quantity: number; values: Array<number | null>; missingCostRows: number }>();

  valueRows.forEach((row) => {
    const productKey = `${row.productId}:${row.skuId}`;
    const product = productMap.get(productKey) ?? { id: productKey, productName: row.productName, skuCode: row.skuCode, quantity: 0, values: [], unitCost: row.unitCost, missingCost: false };
    product.quantity += row.quantityOnHand;
    product.values.push(row.totalValue);
    product.missingCost ||= row.unitCost === null;
    if (product.unitCost === null) product.unitCost = row.unitCost;
    productMap.set(productKey, product);

    const location = locationMap.get(row.locationId) ?? { id: row.locationId, locationName: row.locationName, quantity: 0, values: [], missingCostRows: 0 };
    location.quantity += row.quantityOnHand;
    location.values.push(row.totalValue);
    location.missingCostRows += row.unitCost === null ? 1 : 0;
    locationMap.set(row.locationId, location);

    const condition = conditionMap.get(row.condition) ?? { condition: row.condition, quantity: 0, values: [], missingCostRows: 0 };
    condition.quantity += row.quantityOnHand;
    condition.values.push(row.totalValue);
    condition.missingCostRows += row.unitCost === null ? 1 : 0;
    conditionMap.set(row.condition, condition);
  });

  return {
    rows: valueRows,
    totalValue,
    sellableValue,
    restrictedValue,
    missingCostRows,
    byProductSku: Array.from(productMap.values()).map((row) => ({ id: row.id, productName: row.productName, skuCode: row.skuCode, quantity: row.quantity, unitCost: row.unitCost, value: nullAwareSum(row.values), missingCost: row.missingCost })).sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
    byLocation: Array.from(locationMap.values()).map((row) => ({ id: row.id, locationName: row.locationName, quantity: row.quantity, value: nullAwareSum(row.values), missingCostRows: row.missingCostRows })).sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
    byCondition: Array.from(conditionMap.values()).map((row) => ({ condition: row.condition, quantity: row.quantity, value: nullAwareSum(row.values), missingCostRows: row.missingCostRows })).sort((a, b) => b.quantity - a.quantity),
  };
}

function buildExpiry(rows: InventoryReportRow[], movements: MovementReportRow[], data: BaseData, filters: ReportFilters) {
  const windowDays = Math.max(0, Number(filters.windowDays ?? 90));
  const expiryRows = rows
    .filter((row) => row.expiresOn !== null)
    .filter((row) => row.daysUntilExpiry !== null && row.daysUntilExpiry <= windowDays)
    .filter((row) => isAll(filters.condition) || row.condition === filters.condition)
    .sort((a, b) => (a.daysUntilExpiry ?? 9999) - (b.daysUntilExpiry ?? 9999));
  const wastageRows = movements.filter((row) => ["damage", "wastage"].includes(row.movementType));
  const activeAgreements = data.agreements.filter((row) => String(row.status) === "active");
  const agreementByRetailer = new Map<string, DbRow>();
  activeAgreements.forEach((row) => {
    if (!agreementByRetailer.has(String(row.retailer_id))) agreementByRetailer.set(String(row.retailer_id), row);
  });
  const retailerShelfLifeRisks = rows
    .filter((row) => row.retailerId && row.branchId && row.daysUntilExpiry !== null)
    .map((row) => {
      const agreement = row.retailerId ? agreementByRetailer.get(row.retailerId) : undefined;
      const requiredShelfLifeDays = num(agreement, "minimum_shelf_life_days");
      return { row, requiredShelfLifeDays };
    })
    .filter(({ row, requiredShelfLifeDays }) => requiredShelfLifeDays > 0 && (row.daysUntilExpiry ?? 0) < requiredShelfLifeDays)
    .map(({ row, requiredShelfLifeDays }) => ({
      id: row.id,
      retailerName: row.retailerName ?? "Retailer",
      branchName: row.branchName ?? "Branch",
      productName: row.productName,
      skuCode: row.skuCode,
      batchNumber: row.batchNumber,
      daysUntilExpiry: row.daysUntilExpiry ?? 0,
      requiredShelfLifeDays,
      quantity: row.quantityOnHand,
    }));

  const affectedValue = nullAwareSum([...expiryRows, ...rows.filter((row) => ["damaged", "quarantined", "rejected", "expired"].includes(row.condition))].map((row) => row.totalValue));
  const missingCostRows = [...expiryRows, ...rows.filter((row) => ["damaged", "quarantined", "rejected", "expired"].includes(row.condition))].filter((row) => row.unitCost === null).length;

  return {
    rows: expiryRows,
    wastageRows,
    retailerShelfLifeRisks,
    expiredQuantity: rows.filter((row) => row.condition === "expired").reduce((sum, row) => sum + row.quantityOnHand, 0),
    approachingQuantity: expiryRows.filter((row) => (row.daysUntilExpiry ?? -1) >= 0).reduce((sum, row) => sum + row.quantityOnHand, 0),
    affectedValue,
    missingCostRows,
  };
}

function buildTraceability(data: BaseData, inventoryRows: InventoryReportRow[], salesRows: SalesReportRow[], movements: MovementReportRow[], filters: ReportFilters): ReportModel["traceability"] {
  const maps = buildMaps(data);
  const selectedBatchId = !isAll(filters.batchId) ? filters.batchId ?? null : inventoryRows[0]?.batchId ?? text(data.batches[0], "id");
  const batch = selectedBatchId ? maps.batches.get(selectedBatchId) : undefined;
  const product = batch ? maps.products.get(String(batch.product_id)) : undefined;
  const sku = batch ? maps.skus.get(String(batch.sku_id)) : undefined;
  const supplier = batch?.supplier_id ? maps.suppliers.get(String(batch.supplier_id)) : null;
  const manufacturer = batch?.manufacturer_id ? maps.manufacturers.get(String(batch.manufacturer_id)) : null;
  const holdings = selectedBatchId ? inventoryRows.filter((row) => row.batchId === selectedBatchId) : [];
  const relatedSales = selectedBatchId ? salesRows.filter((row) => row.id && row.recordType === "sales_order" ? data.salesOrders.some((order) => String(order.id) === row.id && String(order.batch_id) === selectedBatchId) : data.retailerReports.some((report) => String(report.id) === row.id && String(report.batch_id) === selectedBatchId)) : [];
  const receiptEvents = selectedBatchId ? data.purchaseReceipts.filter((row) => String(row.batch_id) === selectedBatchId).map((row) => ({
    id: `receipt:${row.id}`,
    date: String(row.received_on ?? row.created_at),
    eventType: "Purchase receipt",
    reference: String(row.receipt_number),
    direction: "Inbound",
    location: String(maps.locations.get(String(row.receiving_location_id))?.name ?? "Receiving location"),
    quantity: num(row, "total_received"),
    details: `Accepted ${num(row, "quantity_accepted")}; damaged ${num(row, "quantity_damaged")}; rejected ${num(row, "quantity_rejected")}; quarantined ${num(row, "quantity_quarantined")}.`,
  } satisfies TraceabilityEvent)) : [];
  const movementEvents = selectedBatchId ? movements.filter((row) => row.batchId === selectedBatchId).map((row) => ({
    id: `movement:${row.id}`,
    date: row.postedAt ?? row.createdAt,
    eventType: row.movementType.replaceAll("_", " "),
    reference: row.referenceType ? `${row.referenceType}${row.movementNumber ? ` #${row.movementNumber}` : ""}` : `Movement #${row.movementNumber}`,
    direction: row.sourceLocationName && row.destinationLocationName ? "Transfer" : row.sourceLocationName ? "Outbound" : "Inbound",
    location: [row.sourceLocationName, row.destinationLocationName].filter(Boolean).join(" → ") || "—",
    quantity: row.quantity,
    details: row.reason ?? "Posted immutable movement.",
  } satisfies TraceabilityEvent)) : [];
  const salesEvents = relatedSales.map((row) => ({
    id: `sale:${row.id}`,
    date: row.date,
    eventType: row.recordType === "sales_order" ? "Sale" : "Retailer report",
    reference: row.reference,
    direction: row.refunds ? "Refunded" : row.unitsSold > 0 ? "Outbound" : "Reported",
    location: row.branchName ?? row.retailerName ?? row.channel,
    quantity: row.unitsSold || row.returnedUnits,
    details: row.note,
  } satisfies TraceabilityEvent));

  return {
    selectedBatchId,
    selectedBatch: batch && selectedBatchId ? { id: selectedBatchId, label: String(batch.batch_number), code: String(sku?.sku_code ?? product?.product_code ?? "—"), productId: text(batch, "product_id") } : null,
    holdings,
    relatedSales,
    events: [...receiptEvents, ...movementEvents, ...salesEvents].sort((a, b) => b.date.localeCompare(a.date)),
    supplierOrManufacturer: supplier ? String(supplier.name) : manufacturer ? String(manufacturer.name) : "No supplier/manufacturer recorded",
    production: {
      manufacturedOn: dateText(batch, "manufactured_on"),
      expiresOn: dateText(batch, "expires_on"),
      qualityStatus: String(batch?.quality_status ?? "unknown"),
      status: String(batch?.status ?? "unknown"),
    },
  };
}

function applyFinancialMask(model: ReportModel) {
  if (model.access.financial) return model;
  return {
    ...model,
    purchasing: {
      ...model.purchasing,
      supplierRows: model.purchasing.supplierRows.map((row) => ({ ...row, totalValue: null, amountPaid: null, balanceRemaining: null })),
      outstandingPayments: null,
      totalOrderValue: null,
      totalPaid: null,
    },
    valuation: {
      ...model.valuation,
      rows: [],
      totalValue: null,
      sellableValue: null,
      restrictedValue: null,
      missingCostRows: 0,
      byProductSku: [],
      byLocation: [],
      byCondition: [],
    },
  } satisfies ReportModel;
}

export async function getReportModel(user: CurrentUser, filters: ReportFilters = {}): Promise<ReportModel> {
  const generatedAt = new Date().toISOString();
  const { today, range } = makeRange(filters);
  const access = getReportAccess(user);
  const result = await loadBaseData();
  const data = result.data;
  const maps = buildMaps(data);
  const inventoryRows = buildInventoryRows(data, filters, today);
  const movements = buildMovementRows(data, filters);
  const inventory = { rows: inventoryRows, movements, ...buildInventorySummary(inventoryRows, data) };
  const salesRows = buildSalesRows(data, filters, range);
  const sales = { rows: salesRows, ...buildSalesSummary(salesRows, data, today) };
  const retailerRows = buildRetailerRows(data, filters);
  const purchasingRows = buildPurchasingRows(data, filters, range);
  const purchasingSummary = buildPurchasingSummary(purchasingRows, data, access);
  const valuation = buildValuation(inventoryRows);
  const expiry = buildExpiry(inventoryRows, movements, data, filters);

  const model: ReportModel = {
    generatedAt,
    today,
    range,
    access,
    refs: {
      products: data.products.map((row) => option(row, "name", "product_code")),
      skus: data.skus.map((row) => option(row, "sellable_name", "sku_code", { productId: text(row, "product_id") })),
      batches: data.batches.map((row) => {
        const sku = maps.skus.get(String(row.sku_id));
        return option(row, "batch_number", "batch_number", { productId: text(row, "product_id"), code: String(sku?.sku_code ?? row.batch_number ?? "—") });
      }),
      locations: data.locations.map((row) => option(row, "name", "code", { retailerId: text(row, "retailer_id") })),
      retailers: data.retailers.map((row) => option(row, "name", "code")),
      branches: data.branches.map((row) => option(row, "name", "code", { retailerId: text(row, "retailer_id") })),
      suppliers: [...data.suppliers.map((row) => option(row, "name", "code")), ...data.manufacturers.map((row) => option(row, "name", "code"))],
    },
    inventory,
    sales,
    retailers: {
      rows: retailerRows,
      totalDeliveries: retailerRows.reduce((sum, row) => sum + row.deliveries, 0),
      totalSold: retailerRows.reduce((sum, row) => sum + row.unitsSold, 0),
      averageSellThroughPercent: retailerRows.length ? retailerRows.reduce((sum, row) => sum + row.sellThroughPercent, 0) / retailerRows.length : 0,
      lowStockRows: retailerRows.filter((row) => row.suggestedReplenishmentQuantity > 0 || row.currentStock <= 0).length,
    },
    purchasing: {
      rows: purchasingRows,
      supplierRows: purchasingSummary.supplierRows,
      openOrders: purchasingSummary.openOrders,
      incomingUnits: purchasingSummary.incomingUnits,
      overdueLines: purchasingSummary.overdueLines,
      outstandingPayments: purchasingSummary.outstandingPayments,
      totalOrderValue: purchasingSummary.totalOrderValue,
      totalPaid: purchasingSummary.totalPaid,
    },
    valuation,
    expiry,
    traceability: buildTraceability(data, inventoryRows, salesRows, movements, filters),
    error: result.error,
  };

  return applyFinancialMask(model);
}

export function csvEscape(value: unknown) {
  const raw = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll("\"", "\"\"")}"`;
}

export function toCsv(headers: string[], rows: Array<Array<unknown>>) {
  return [headers.map(csvEscape).join(","), ...rows.map((row) => row.map(csvEscape).join(","))].join("\n");
}

export async function logReportExport(reportType: ReportKind, filters: ReportFilters) {
  if (isDemoMode()) return;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return;
  const safeFilters = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ""));
  await supabase.rpc("log_report_export", { p_report_type: reportType, p_filters: safeFilters });
}

export async function buildReportCsv(user: CurrentUser, reportType: ReportKind, filters: ReportFilters) {
  const model = await getReportModel(user, filters);
  if (!canExportReport(user, reportType)) {
    return { fileName: "restricted.csv", content: toCsv(["Message"], [["Your role cannot export this report."]]), error: "Your role cannot export this report." };
  }

  switch (reportType) {
    case "inventory":
      return {
        fileName: "goodlivin-inventory-report.csv",
        content: toCsv(["Product", "SKU", "Batch", "Location", "Retailer", "Branch", "Condition", "Quality", "Expiry", "Physical stock", "Available stock", "Incoming stock excluded"], model.inventory.rows.map((row) => [row.productName, row.skuCode, row.batchNumber, row.locationName, row.retailerName, row.branchName, row.condition, row.qualityStatus, row.expiresOn, row.quantityOnHand, row.availableQuantity, "Yes"])),
        error: model.error,
      };
    case "sales":
      return {
        fileName: "goodlivin-sales-report.csv",
        content: toCsv(["Reference", "Type", "Date", "Channel", "Status", "Product", "SKU", "Retailer", "Branch", "Units sold", "Returns", "Gross value", "Discounts", "Refunds", "Net value", "Representation"], model.sales.rows.map((row) => [row.reference, row.recordType, row.date, row.channel, row.status, row.productName, row.skuCode, row.retailerName, row.branchName, row.unitsSold, row.returnedUnits, row.grossValue, row.discounts, row.refunds, row.netValue, row.note])),
        error: model.error,
      };
    case "retailers":
      return {
        fileName: "goodlivin-retailer-performance.csv",
        content: toCsv(["Retailer", "Branch", "Product", "SKU", "Opening stock", "Deliveries", "Units sold", "Returns", "Damaged", "Expired", "Current calculated stock", "Sell-through %", "Average daily sales", "Last report date", "Suggested replenishment"], model.retailers.rows.map((row) => [row.retailerName, row.branchName, row.productName, row.skuCode, row.openingStock, row.deliveries, row.unitsSold, row.returns, row.damaged, row.expired, row.currentStock, row.sellThroughPercent, row.averageDailySales, row.lastReportDate, row.suggestedReplenishmentQuantity])),
        error: model.error,
      };
    case "purchasing":
      return {
        fileName: "goodlivin-purchasing-report.csv",
        content: toCsv(["PO", "Status", "Order date", "Expected delivery", "Supplier / manufacturer", "Location", "Product", "SKU", "Ordered", "Received", "Outstanding", "Days overdue", "Unit cost", "Line value"], model.purchasing.rows.map((row) => [row.poNumber, row.status, row.orderDate, row.expectedDeliveryDate, row.supplierName ?? row.manufacturerName, row.receivingLocationName, row.productName, row.skuCode, row.quantityOrdered, row.quantityReceived, row.quantityOutstanding, row.daysOverdue, model.access.financial ? row.unitCost : "Restricted", model.access.financial ? row.lineValue : "Restricted"])),
        error: model.error,
      };
    case "valuation":
      return {
        fileName: "goodlivin-stock-valuation.csv",
        content: toCsv(["Product", "SKU", "Batch", "Location", "Condition", "Quantity", "Unit cost", "Cost basis", "Total value", "Warning"], model.valuation.rows.map((row) => [row.productName, row.skuCode, row.batchNumber, row.locationName, row.condition, row.quantityOnHand, row.unitCost, row.costBasis, row.totalValue, row.unitCost === null ? "Missing cost; not treated as zero" : ""])),
        error: model.error,
      };
    case "expiry":
      return {
        fileName: "goodlivin-expiry-wastage-report.csv",
        content: toCsv(["Product", "SKU", "Batch", "Location", "Retailer", "Branch", "Condition", "Expiry", "Days until expiry", "Quantity", "Unit cost", "Estimated value"], model.expiry.rows.map((row) => [row.productName, row.skuCode, row.batchNumber, row.locationName, row.retailerName, row.branchName, row.condition, row.expiresOn, row.daysUntilExpiry, row.quantityOnHand, model.access.financial ? row.unitCost : "Restricted", model.access.financial ? row.totalValue : "Restricted"])),
        error: model.error,
      };
    case "traceability":
      return {
        fileName: "goodlivin-batch-traceability.csv",
        content: toCsv(["Batch", "Date", "Event", "Reference", "Direction", "Location", "Quantity", "Details"], model.traceability.events.map((row) => [model.traceability.selectedBatch?.label, row.date, row.eventType, row.reference, row.direction, row.location, row.quantity, row.details])),
        error: model.error,
      };
    default:
      return { fileName: "goodlivin-report.csv", content: toCsv(["Message"], [["Unknown report type."]]), error: "Unknown report type." };
  }
}

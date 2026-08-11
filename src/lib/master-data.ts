import { isDemoMode } from "@/lib/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type MasterStatus = "active" | "archived";
export type LocationType =
  | "warehouse"
  | "main_warehouse"
  | "office_stock"
  | "online_order_stock"
  | "event_stock"
  | "retailer_branch"
  | "sample_influencer_stock"
  | "damaged_stock"
  | "quarantine"
  | "quarantine_stock"
  | "expired_stock"
  | "transit"
  | "production";
export type AgreementType = "wholesale" | "consignment";

export type ManufacturerRecord = {
  id: string;
  name: string;
  code: string | null;
  status: MasterStatus;
  notes: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  country: string | null;
  defaultCurrency: string;
  standardLeadTimeDays: number;
  minimumOrderQuantity: number;
  paymentTerms: string | null;
  taxRegistrationDetails: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SupplierRecord = ManufacturerRecord & {
};

export type ProductSkuRecord = {
  id: string;
  productId: string;
  skuCode: string;
  sellableName: string;
  barcode: string | null;
  packSize: number;
  unitDescription: string;
  unitsPerCarton: number;
  costPerUnit: number;
  retailPrice: number;
  wholesalePrice: number;
  status: MasterStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProductRecord = {
  id: string;
  productCode: string;
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  manufacturerId: string | null;
  manufacturerName: string | null;
  supplierId: string | null;
  supplierName: string | null;
  baseUnit: string;
  minimumStockLevel: number;
  reorderLevel: number;
  storageInstructions: string | null;
  imageUrl: string | null;
  status: MasterStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  skus: ProductSkuRecord[];
};

export type LocationRecord = {
  id: string;
  code: string;
  name: string;
  locationType: LocationType;
  retailerId: string | null;
  retailerName: string | null;
  branchId: string | null;
  branchName: string | null;
  addressLine1: string | null;
  city: string | null;
  status: MasterStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BranchRecord = {
  id: string;
  retailerId: string;
  code: string;
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  district: string | null;
  contactName: string | null;
  contactPhone: string | null;
  status: MasterStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RetailerRecord = {
  id: string;
  code: string;
  name: string;
  legalName: string | null;
  taxIdentifier: string | null;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  district: string | null;
  status: MasterStatus;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  branches: BranchRecord[];
};

export type AgreementRecord = {
  id: string;
  retailerId: string;
  retailerName: string | null;
  agreementNumber: string;
  arrangementType: AgreementType;
  effectiveFrom: string;
  effectiveTo: string | null;
  paymentTermsDays: number;
  creditLimit: number;
  retailerMarginPercent: number;
  minimumShelfLifeDays: number;
  status: MasterStatus;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SupplierCatalogRecord = {
  id: string;
  supplierId: string | null;
  supplierName: string | null;
  manufacturerId: string | null;
  manufacturerName: string | null;
  productId: string;
  productCode: string;
  productName: string;
  skuId: string;
  skuCode: string;
  sellableName: string;
  supplierSkuCode: string | null;
  unitCost: number;
  currencyCode: string;
  minimumOrderQuantity: number;
  leadTimeDays: number;
  isDefault: boolean;
  status: MasterStatus;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MasterResult<T> = { data: T; error: string | null };

const DEMO_DATE = "2026-08-01T04:00:00.000Z";
const demoManufacturer: ManufacturerRecord = {
  id: "00000000-0000-0000-0000-000000000201",
  name: "GoodLivin Labs",
  code: "GL-LABS",
  status: "active",
  notes: "Internal demo manufacturer",
  contactName: "GoodLivin production desk",
  contactEmail: "production@example.invalid",
  contactPhone: "+94 11 555 0101",
  addressLine1: "24 Industrial Estate",
  addressLine2: null,
  city: "Colombo",
  country: "Sri Lanka",
  defaultCurrency: "LKR",
  standardLeadTimeDays: 21,
  minimumOrderQuantity: 24,
  paymentTerms: "50% advance",
  taxRegistrationDetails: null,
  createdAt: DEMO_DATE,
  updatedAt: DEMO_DATE,
};
const demoSupplier: SupplierRecord = {
  ...demoManufacturer,
  id: "00000000-0000-0000-0000-000000000202",
  name: "Serendib Wellness Supply",
  code: "SWS",
  contactName: "Tharindu Jayasuriya",
  contactEmail: "supply@example.invalid",
  contactPhone: "+94 11 555 0102",
};
const demoSku: ProductSkuRecord = {
  id: "00000000-0000-0000-0000-000000000211",
  productId: "00000000-0000-0000-0000-000000000210",
  skuCode: "GL-MAG-60",
  sellableName: "Magnesium Complex · 60 capsules",
  barcode: "4790000000011",
  packSize: 60,
  unitDescription: "capsules",
  unitsPerCarton: 24,
  costPerUnit: 2700,
  retailPrice: 4850,
  wholesalePrice: 4100,
  status: "active",
  createdAt: DEMO_DATE,
  updatedAt: DEMO_DATE,
};
const demoProduct: ProductRecord = {
  id: "00000000-0000-0000-0000-000000000210",
  productCode: "GL-MAG",
  name: "GoodLivin Magnesium Complex",
  description: "Daily magnesium support.",
  category: "Supplements",
  brand: "GoodLivin",
  manufacturerId: demoManufacturer.id,
  manufacturerName: demoManufacturer.name,
  supplierId: demoSupplier.id,
  supplierName: demoSupplier.name,
  baseUnit: "unit",
  minimumStockLevel: 240,
  reorderLevel: 480,
  storageInstructions: "Store sealed in a cool, dry place.",
  imageUrl: null,
  status: "active",
  archivedAt: null,
  createdAt: DEMO_DATE,
  updatedAt: DEMO_DATE,
  skus: [demoSku],
};
const demoRetailer: RetailerRecord = {
  id: "00000000-0000-0000-0000-000000000220",
  code: "CARGILLS",
  name: "Cargills Food City",
  legalName: "Cargills Ceylon PLC",
  taxIdentifier: null,
  primaryContactName: "Kavindi Silva",
  primaryContactEmail: "buying@example.invalid",
  primaryContactPhone: "+94 11 555 0202",
  addressLine1: "123 Main Street",
  addressLine2: null,
  city: "Colombo",
  district: "Colombo",
  status: "active",
  notes: "Demo internal retailer record",
  archivedAt: null,
  createdAt: DEMO_DATE,
  updatedAt: DEMO_DATE,
  branches: [],
};
const demoBranch: BranchRecord = {
  id: "00000000-0000-0000-0000-000000000221",
  retailerId: demoRetailer.id,
  code: "COL-CEN",
  name: "Colombo Central",
  addressLine1: "123 Main Street",
  addressLine2: null,
  city: "Colombo",
  district: "Colombo",
  contactName: "Kavindi Silva",
  contactPhone: "+94 11 555 0202",
  status: "active",
  archivedAt: null,
  createdAt: DEMO_DATE,
  updatedAt: DEMO_DATE,
};
const demoLocation: LocationRecord = {
  id: "00000000-0000-0000-0000-000000000230",
  code: "WH-KOT",
  name: "Kotte Main Warehouse",
  locationType: "main_warehouse",
  retailerId: null,
  retailerName: null,
  branchId: null,
  branchName: null,
  addressLine1: "45 Warehouse Road",
  city: "Sri Jayawardenepura Kotte",
  status: "active",
  archivedAt: null,
  createdAt: DEMO_DATE,
  updatedAt: DEMO_DATE,
};

function matches(value: unknown, query: string) {
  return String(value ?? "").toLowerCase().includes(query.toLowerCase());
}

function statusMatches(status: string, requested: string) {
  return requested === "all" || status === requested;
}

function errorMessage(error: { message?: string } | null) {
  return error?.message ?? "The requested records could not be loaded.";
}

function mapManufacturer(row: Record<string, unknown>): ManufacturerRecord {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    code: (row.code as string | null) ?? null,
    status: (row.status as MasterStatus) ?? "active",
    notes: (row.notes as string | null) ?? null,
    contactName: (row.contact_name as string | null) ?? null,
    contactEmail: (row.contact_email as string | null) ?? null,
    contactPhone: (row.contact_phone as string | null) ?? null,
    addressLine1: (row.address_line_1 as string | null) ?? null,
    addressLine2: (row.address_line_2 as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    country: (row.country as string | null) ?? null,
    defaultCurrency: String(row.default_currency ?? "LKR"),
    standardLeadTimeDays: Number(row.standard_lead_time_days ?? 0),
    minimumOrderQuantity: Number(row.minimum_order_quantity ?? 0),
    paymentTerms: (row.payment_terms as string | null) ?? null,
    taxRegistrationDetails: (row.tax_registration_details as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapSupplier(row: Record<string, unknown>): SupplierRecord {
  return mapManufacturer(row);
}

function mapSku(row: Record<string, unknown>): ProductSkuRecord {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    skuCode: String(row.sku_code ?? ""),
    sellableName: String(row.sellable_name ?? ""),
    barcode: (row.barcode as string | null) ?? null,
    packSize: Number(row.pack_size ?? 1),
    unitDescription: String(row.unit_description ?? "unit"),
    unitsPerCarton: Number(row.units_per_carton ?? 1),
    costPerUnit: Number(row.cost_per_unit ?? 0),
    retailPrice: Number(row.retail_price ?? row.unit_price ?? 0),
    wholesalePrice: Number(row.wholesale_price ?? 0),
    status: (row.status as MasterStatus) ?? "active",
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapProduct(row: Record<string, unknown>, skuRows: ProductSkuRecord[], manufacturers: Map<string, string>, suppliers: Map<string, string>): ProductRecord {
  const manufacturerId = (row.manufacturer_id as string | null) ?? null;
  const supplierId = (row.supplier_id as string | null) ?? null;
  return {
    id: String(row.id),
    productCode: String(row.product_code ?? ""),
    name: String(row.name ?? ""),
    description: (row.description as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    brand: (row.brand as string | null) ?? null,
    manufacturerId,
    manufacturerName: manufacturerId ? manufacturers.get(manufacturerId) ?? null : null,
    supplierId,
    supplierName: supplierId ? suppliers.get(supplierId) ?? null : null,
    baseUnit: String(row.base_unit ?? "unit"),
    minimumStockLevel: Number(row.minimum_stock_level ?? 0),
    reorderLevel: Number(row.reorder_level ?? 0),
    storageInstructions: (row.storage_instructions as string | null) ?? null,
    imageUrl: (row.image_url as string | null) ?? null,
    status: (row.status as MasterStatus) ?? "active",
    archivedAt: (row.archived_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    skus: skuRows.filter((sku) => sku.productId === String(row.id)),
  };
}

function mapBranch(row: Record<string, unknown>): BranchRecord {
  return {
    id: String(row.id),
    retailerId: String(row.retailer_id),
    code: String(row.code ?? ""),
    name: String(row.name ?? ""),
    addressLine1: (row.address_line_1 as string | null) ?? null,
    addressLine2: (row.address_line_2 as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    district: (row.district as string | null) ?? null,
    contactName: (row.contact_name as string | null) ?? null,
    contactPhone: (row.contact_phone as string | null) ?? null,
    status: (row.status as MasterStatus) ?? "active",
    archivedAt: (row.archived_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapRetailer(row: Record<string, unknown>, branches: BranchRecord[]): RetailerRecord {
  return {
    id: String(row.id),
    code: String(row.code ?? ""),
    name: String(row.name ?? ""),
    legalName: (row.legal_name as string | null) ?? null,
    taxIdentifier: (row.tax_identifier as string | null) ?? null,
    primaryContactName: (row.primary_contact_name as string | null) ?? null,
    primaryContactEmail: (row.primary_contact_email as string | null) ?? null,
    primaryContactPhone: (row.primary_contact_phone as string | null) ?? null,
    addressLine1: (row.address_line_1 as string | null) ?? null,
    addressLine2: (row.address_line_2 as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    district: (row.district as string | null) ?? null,
    status: (row.status as MasterStatus) ?? "active",
    notes: (row.notes as string | null) ?? null,
    archivedAt: (row.archived_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    branches: branches.filter((branch) => branch.retailerId === String(row.id)),
  };
}

function mapLocation(row: Record<string, unknown>, retailers: Map<string, string>, branches: Map<string, string>): LocationRecord {
  const retailerId = (row.retailer_id as string | null) ?? null;
  const branchId = (row.branch_id as string | null) ?? null;
  return {
    id: String(row.id),
    code: String(row.code ?? ""),
    name: String(row.name ?? ""),
    locationType: (row.location_type as LocationType) ?? "warehouse",
    retailerId,
    retailerName: retailerId ? retailers.get(retailerId) ?? null : null,
    branchId,
    branchName: branchId ? branches.get(branchId) ?? null : null,
    addressLine1: (row.address_line_1 as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    status: (row.status as MasterStatus) ?? "active",
    archivedAt: (row.archived_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapAgreement(row: Record<string, unknown>, retailers: Map<string, string>): AgreementRecord {
  const retailerId = String(row.retailer_id);
  return {
    id: String(row.id),
    retailerId,
    retailerName: retailers.get(retailerId) ?? null,
    agreementNumber: String(row.agreement_number ?? ""),
    arrangementType: (row.arrangement_type as AgreementType) ?? "wholesale",
    effectiveFrom: String(row.effective_from),
    effectiveTo: (row.effective_to as string | null) ?? null,
    paymentTermsDays: Number(row.payment_terms_days ?? 0),
    creditLimit: Number(row.credit_limit ?? 0),
    retailerMarginPercent: Number(row.retailer_margin_percent ?? 0),
    minimumShelfLifeDays: Number(row.minimum_shelf_life_days ?? 0),
    status: (row.status as MasterStatus) ?? "active",
    notes: (row.notes as string | null) ?? null,
    archivedAt: (row.archived_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapSupplierCatalog(row: Record<string, unknown>): SupplierCatalogRecord {
  const product = row.products as Record<string, unknown> | null;
  const sku = row.product_skus as Record<string, unknown> | null;
  const supplier = row.suppliers as Record<string, unknown> | null;
  const manufacturer = row.manufacturers as Record<string, unknown> | null;
  return {
    id: String(row.id),
    supplierId: (row.supplier_id as string | null) ?? null,
    supplierName: supplier?.name ? String(supplier.name) : null,
    manufacturerId: (row.manufacturer_id as string | null) ?? null,
    manufacturerName: manufacturer?.name ? String(manufacturer.name) : null,
    productId: String(row.product_id),
    productCode: String(product?.product_code ?? "—"),
    productName: String(product?.name ?? "Unknown product"),
    skuId: String(row.sku_id),
    skuCode: String(sku?.sku_code ?? "—"),
    sellableName: String(sku?.sellable_name ?? "Unknown SKU"),
    supplierSkuCode: (row.supplier_sku_code as string | null) ?? null,
    unitCost: Number(row.unit_cost ?? 0),
    currencyCode: String(row.currency_code ?? "LKR"),
    minimumOrderQuantity: Number(row.minimum_order_quantity ?? 0),
    leadTimeDays: Number(row.lead_time_days ?? 0),
    isDefault: Boolean(row.is_default),
    status: (row.status as MasterStatus) ?? "active",
    notes: (row.notes as string | null) ?? null,
    archivedAt: (row.archived_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function getProductWorkspace(filters: { q?: string; status?: string }): Promise<MasterResult<{ products: ProductRecord[]; manufacturers: ManufacturerRecord[]; suppliers: SupplierRecord[] }>> {
  if (isDemoMode()) return { data: { products: [demoProduct], manufacturers: [demoManufacturer], suppliers: [demoSupplier] }, error: null };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { data: { products: [], manufacturers: [], suppliers: [] }, error: "Supabase is not configured." };
  const [{ data: productRows, error: productError }, { data: skuRows, error: skuError }, { data: manufacturerRows, error: manufacturerError }, { data: supplierRows, error: supplierError }] = await Promise.all([
    supabase.from("products").select("*").order("name"),
    supabase.from("product_skus").select("*").order("sku_code"),
    supabase.from("manufacturers").select("*").order("name"),
    supabase.from("suppliers").select("*").order("name"),
  ]);
  const firstError = productError ?? skuError ?? manufacturerError ?? supplierError;
  if (firstError) return { data: { products: [], manufacturers: [], suppliers: [] }, error: errorMessage(firstError) };
  const manufacturers = (manufacturerRows ?? []).map((row) => mapManufacturer(row as Record<string, unknown>));
  const suppliers = (supplierRows ?? []).map((row) => mapSupplier(row as Record<string, unknown>));
  const manufacturerMap = new Map(manufacturers.map((row) => [row.id, row.name]));
  const supplierMap = new Map(suppliers.map((row) => [row.id, row.name]));
  const skus = (skuRows ?? []).map((row) => mapSku(row as Record<string, unknown>));
  const query = filters.q?.trim() ?? "";
  const status = filters.status ?? "active";
  const products = (productRows ?? []).map((row) => mapProduct(row as Record<string, unknown>, skus, manufacturerMap, supplierMap)).filter((row) =>
    statusMatches(row.status, status) && (!query || [row.productCode, row.name, row.brand, row.category, row.manufacturerName, row.supplierName].some((value) => matches(value, query)) || row.skus.some((sku) => matches(sku.skuCode, query) || matches(sku.sellableName, query))),
  );
  return { data: { products, manufacturers, suppliers }, error: null };
}

export async function getManufacturerWorkspace(filters: { q?: string; status?: string }): Promise<MasterResult<ManufacturerRecord[]>> {
  if (isDemoMode()) return { data: [demoManufacturer], error: null };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { data: [], error: "Supabase is not configured." };
  const { data, error } = await supabase.from("manufacturers").select("*").order("name");
  if (error) return { data: [], error: errorMessage(error) };
  const query = filters.q?.trim() ?? "";
  return { data: (data ?? []).map((row) => mapManufacturer(row as Record<string, unknown>)).filter((row) => statusMatches(row.status, filters.status ?? "active") && (!query || matches(row.name, query) || matches(row.code, query))), error: null };
}

export async function getSupplierWorkspace(filters: { q?: string; status?: string }): Promise<MasterResult<SupplierRecord[]>> {
  if (isDemoMode()) return { data: [demoSupplier], error: null };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { data: [], error: "Supabase is not configured." };
  const { data, error } = await supabase.from("suppliers").select("*").order("name");
  if (error) return { data: [], error: errorMessage(error) };
  const query = filters.q?.trim() ?? "";
  return { data: (data ?? []).map((row) => mapSupplier(row as Record<string, unknown>)).filter((row) => statusMatches(row.status, filters.status ?? "active") && (!query || [row.name, row.code, row.contactName, row.contactEmail].some((value) => matches(value, query)))), error: null };
}

export async function getSupplierProductCatalog(filters: { owner: "supplier" | "manufacturer"; q?: string; status?: string }): Promise<MasterResult<SupplierCatalogRecord[]>> {
  if (isDemoMode()) return { data: [], error: null };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { data: [], error: "Supabase is not configured." };
  const { data, error } = await supabase
    .from("supplier_product_catalog")
    .select("*, products(product_code, name), product_skus(sku_code, sellable_name), suppliers(name), manufacturers(name)")
    .order("updated_at", { ascending: false });
  if (error) return { data: [], error: errorMessage(error) };
  const query = filters.q?.trim() ?? "";
  const status = filters.status ?? "active";
  return {
    data: (data ?? [])
      .map((row) => mapSupplierCatalog(row as Record<string, unknown>))
      .filter((row) => (filters.owner === "supplier" ? row.supplierId : row.manufacturerId))
      .filter((row) => statusMatches(row.status, status))
      .filter((row) => !query || [row.supplierName, row.manufacturerName, row.productCode, row.productName, row.skuCode, row.sellableName, row.supplierSkuCode].some((value) => matches(value, query))),
    error: null,
  };
}

export async function getLocationWorkspace(filters: { q?: string; status?: string; type?: string }): Promise<MasterResult<{ locations: LocationRecord[]; retailers: RetailerRecord[]; branches: BranchRecord[] }>> {
  if (isDemoMode()) return { data: { locations: [demoLocation], retailers: [demoRetailer], branches: [demoBranch] }, error: null };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { data: { locations: [], retailers: [], branches: [] }, error: "Supabase is not configured." };
  const [{ data: locationRows, error: locationError }, { data: retailerRows, error: retailerError }, { data: branchRows, error: branchError }] = await Promise.all([
    supabase.from("inventory_locations").select("*").order("name"),
    supabase.from("retailers").select("*").order("name"),
    supabase.from("retailer_branches").select("*").order("name"),
  ]);
  const firstError = locationError ?? retailerError ?? branchError;
  if (firstError) return { data: { locations: [], retailers: [], branches: [] }, error: errorMessage(firstError) };
  const retailers = (retailerRows ?? []).map((row) => mapRetailer(row as Record<string, unknown>, []));
  const branches = (branchRows ?? []).map((row) => mapBranch(row as Record<string, unknown>));
  const retailerMap = new Map(retailers.map((row) => [row.id, row.name]));
  const branchMap = new Map(branches.map((row) => [row.id, row.name]));
  const query = filters.q?.trim() ?? "";
  const locations = (locationRows ?? []).map((row) => mapLocation(row as Record<string, unknown>, retailerMap, branchMap)).filter((row) =>
    statusMatches(row.status, filters.status ?? "active") && (!filters.type || filters.type === "all" || row.locationType === filters.type) && (!query || [row.code, row.name, row.city, row.retailerName, row.branchName].some((value) => matches(value, query))),
  );
  return { data: { locations, retailers, branches }, error: null };
}

export async function getRetailerWorkspace(filters: { q?: string; status?: string }): Promise<MasterResult<{ retailers: RetailerRecord[]; branches: BranchRecord[] }>> {
  if (isDemoMode()) return { data: { retailers: [{ ...demoRetailer, branches: [demoBranch] }], branches: [demoBranch] }, error: null };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { data: { retailers: [], branches: [] }, error: "Supabase is not configured." };
  const [{ data: retailerRows, error: retailerError }, { data: branchRows, error: branchError }] = await Promise.all([
    supabase.from("retailers").select("*").order("name"),
    supabase.from("retailer_branches").select("*").order("name"),
  ]);
  const firstError = retailerError ?? branchError;
  if (firstError) return { data: { retailers: [], branches: [] }, error: errorMessage(firstError) };
  const branches = (branchRows ?? []).map((row) => mapBranch(row as Record<string, unknown>));
  const query = filters.q?.trim() ?? "";
  const retailers = (retailerRows ?? []).map((row) => mapRetailer(row as Record<string, unknown>, branches)).filter((row) => statusMatches(row.status, filters.status ?? "active") && (!query || [row.code, row.name, row.legalName, row.primaryContactName].some((value) => matches(value, query)) || row.branches.some((branch) => matches(branch.name, query) || matches(branch.code, query))));
  return { data: { retailers, branches }, error: null };
}

export async function getAgreementWorkspace(filters: { q?: string; status?: string; arrangement?: string }): Promise<MasterResult<{ agreements: AgreementRecord[]; retailers: RetailerRecord[] }>> {
  if (isDemoMode()) return { data: { agreements: [{ id: "00000000-0000-0000-0000-000000000240", retailerId: demoRetailer.id, retailerName: demoRetailer.name, agreementNumber: "AGR-CARG-001", arrangementType: "wholesale", effectiveFrom: "2026-08-01", effectiveTo: "2027-07-31", paymentTermsDays: 30, creditLimit: 100000, retailerMarginPercent: 18, minimumShelfLifeDays: 120, status: "active", notes: "Demo agreement", archivedAt: null, createdAt: DEMO_DATE, updatedAt: DEMO_DATE }], retailers: [demoRetailer] }, error: null };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { data: { agreements: [], retailers: [] }, error: "Supabase is not configured." };
  const [{ data: agreementRows, error: agreementError }, { data: retailerRows, error: retailerError }] = await Promise.all([
    supabase.from("retailer_commercial_agreements").select("*").order("effective_from", { ascending: false }),
    supabase.from("retailers").select("*").order("name"),
  ]);
  const firstError = agreementError ?? retailerError;
  if (firstError) return { data: { agreements: [], retailers: [] }, error: errorMessage(firstError) };
  const retailers = (retailerRows ?? []).map((row) => mapRetailer(row as Record<string, unknown>, []));
  const retailerMap = new Map(retailers.map((row) => [row.id, row.name]));
  const query = filters.q?.trim() ?? "";
  const agreements = (agreementRows ?? []).map((row) => mapAgreement(row as Record<string, unknown>, retailerMap)).filter((row) =>
    statusMatches(row.status, filters.status ?? "active") && (!filters.arrangement || filters.arrangement === "all" || row.arrangementType === filters.arrangement) && (!query || [row.agreementNumber, row.retailerName, row.arrangementType].some((value) => matches(value, query))),
  );
  return { data: { agreements, retailers }, error: null };
}

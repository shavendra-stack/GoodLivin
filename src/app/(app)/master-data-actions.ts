"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const optionalText = (max = 500) => z.string().trim().max(max).optional().transform((value) => value || null);
const optionalUuid = z.string().uuid().optional().or(z.literal("")).transform((value) => value || null);
const nonNegativeInt = z.coerce.number().int().min(0);
const nonNegativeMoney = z.coerce.number().min(0);

const productSchema = z.object({
  id: optionalUuid,
  productCode: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  category: optionalText(120),
  description: optionalText(2000),
  brand: optionalText(120),
  manufacturerId: optionalUuid,
  supplierId: optionalUuid,
  baseUnit: z.string().trim().min(1).max(40),
  minimumStockLevel: nonNegativeInt,
  reorderLevel: nonNegativeInt,
  storageInstructions: optionalText(1000),
  imageUrl: z.string().trim().max(800).optional().or(z.literal("")),
});

const skuSchema = z.object({
  id: optionalUuid,
  productId: z.string().uuid(),
  skuCode: z.string().trim().min(1).max(80),
  sellableName: z.string().trim().min(1).max(160),
  barcode: optionalText(80),
  packSize: z.coerce.number().int().min(1),
  unitDescription: z.string().trim().min(1).max(80),
  unitsPerCarton: z.coerce.number().int().min(1),
  costPerUnit: nonNegativeMoney,
  retailPrice: nonNegativeMoney,
  wholesalePrice: nonNegativeMoney,
});

const partnerFields = { id: optionalUuid, name: z.string().trim().min(1).max(160), code: optionalText(80), contactName: optionalText(160), contactEmail: optionalText(200), contactPhone: optionalText(80), addressLine1: optionalText(200), addressLine2: optionalText(200), city: optionalText(120), country: optionalText(120), defaultCurrency: z.string().trim().length(3), standardLeadTimeDays: nonNegativeInt, minimumOrderQuantity: nonNegativeInt, paymentTerms: optionalText(500), taxRegistrationDetails: optionalText(500), notes: optionalText(2000) };
const manufacturerSchema = z.object(partnerFields);
const supplierSchema = z.object(partnerFields);
const locationSchema = z.object({
  id: optionalUuid,
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  locationType: z.enum(["warehouse", "main_warehouse", "office_stock", "online_order_stock", "event_stock", "retailer_branch", "sample_influencer_stock", "damaged_stock", "quarantine", "quarantine_stock", "expired_stock", "transit", "production"]),
  retailerId: optionalUuid,
  branchId: optionalUuid,
  addressLine1: optionalText(200),
  city: optionalText(120),
});
const retailerSchema = z.object({ id: optionalUuid, code: z.string().trim().min(1).max(80), name: z.string().trim().min(1).max(160), legalName: optionalText(200), taxIdentifier: optionalText(100), primaryContactName: optionalText(160), primaryContactEmail: optionalText(200), primaryContactPhone: optionalText(80), addressLine1: optionalText(200), addressLine2: optionalText(200), city: optionalText(120), district: optionalText(120), notes: optionalText(2000) });
const branchSchema = z.object({ id: optionalUuid, retailerId: z.string().uuid(), code: z.string().trim().min(1).max(80), name: z.string().trim().min(1).max(160), addressLine1: optionalText(200), addressLine2: optionalText(200), city: optionalText(120), district: optionalText(120), contactName: optionalText(160), contactPhone: optionalText(80) });
const agreementSchema = z.object({
  id: optionalUuid,
  retailerId: z.string().uuid(),
  agreementNumber: z.string().trim().min(1).max(80),
  arrangementType: z.enum(["wholesale", "consignment"]),
  effectiveFrom: z.string().date(),
  effectiveTo: z.string().date().optional().or(z.literal("")),
  paymentTermsDays: nonNegativeInt,
  creditLimit: nonNegativeMoney,
  retailerMarginPercent: z.coerce.number().min(0).max(100),
  minimumShelfLifeDays: nonNegativeInt,
  notes: optionalText(2000),
});
const catalogSchema = z.object({
  id: optionalUuid,
  ownerType: z.enum(["supplier", "manufacturer"]),
  supplierId: optionalUuid,
  manufacturerId: optionalUuid,
  productId: z.string().uuid(),
  skuId: z.string().uuid(),
  supplierSkuCode: optionalText(120),
  unitCost: nonNegativeMoney,
  currencyCode: z.string().trim().length(3),
  minimumOrderQuantity: nonNegativeInt,
  leadTimeDays: nonNegativeInt,
  isDefault: z.string().optional().transform((value) => value === "on" || value === "true"),
  notes: optionalText(2000),
});
const catalogArchiveSchema = z.object({
  id: z.string().uuid(),
  ownerType: z.enum(["supplier", "manufacturer"]),
});

type PermissionArea = "products" | "retailers" | "locations" | "agreements";

async function requirePermission(area: PermissionArea, path: string) {
  const user = await getCurrentUser();
  const allowed: Record<PermissionArea, string[]> = {
    products: ["director_admin", "inventory_manager"],
    retailers: ["director_admin", "sales_manager"],
    locations: ["director_admin", "inventory_manager"],
    agreements: ["director_admin", "sales_manager", "finance_team"],
  };
  if (!user || !user.roles.some((role) => allowed[area].includes(role))) redirect(`${path}?error=not-authorized`);
  if (isDemoMode()) redirect(`${path}?demo=1`);
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(`${path}?error=not-configured`);
  return supabase;
}

function mutationError(error: { code?: string; message?: string }) {
  if (error.code === "23505") return "duplicate-code";
  if (error.code === "23514") return "validation";
  if (error.code === "23503") return "reference";
  if (["42P01", "42703", "42883", "PGRST202", "PGRST205"].includes(error.code ?? "")) return "database";
  return "server";
}

function validationRedirect(path: string): never {
  redirect(`${path}?error=validation`);
}

function catalogPath(ownerType: "supplier" | "manufacturer") {
  return ownerType === "supplier" ? "/products/suppliers" : "/products/manufacturers";
}

export async function saveProduct(formData: FormData) {
  const path = "/products";
  const supabase = await requirePermission("products", path);
  const parsed = productSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) validationRedirect(path);
  const value = parsed.data;
  const payload = {
    product_code: value.productCode,
    name: value.name,
    category: value.category,
    description: value.description,
    brand: value.brand,
    manufacturer_id: value.manufacturerId,
    supplier_id: value.supplierId,
    base_unit: value.baseUnit,
    minimum_stock_level: value.minimumStockLevel,
    reorder_level: value.reorderLevel,
    storage_instructions: value.storageInstructions,
    image_url: value.imageUrl || null,
  };
  const result = value.id ? await supabase.from("products").update(payload).eq("id", value.id) : await supabase.from("products").insert(payload);
  if (result.error) redirect(`${path}?error=${mutationError(result.error)}`);
  revalidatePath(path);
  redirect(`${path}?saved=product`);
}

export async function archiveProduct(formData: FormData) {
  const path = "/products";
  const supabase = await requirePermission("products", path);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) validationRedirect(path);
  const { error } = await supabase.from("products").update({ status: "archived", archived_at: new Date().toISOString() }).eq("id", id.data);
  if (error) redirect(`${path}?error=${mutationError(error)}`);
  revalidatePath(path);
  redirect(`${path}?saved=archived`);
}

export async function saveSku(formData: FormData) {
  const path = "/products";
  const supabase = await requirePermission("products", path);
  const parsed = skuSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) validationRedirect(path);
  const value = parsed.data;
  const payload = {
    product_id: value.productId,
    sku_code: value.skuCode,
    sellable_name: value.sellableName,
    barcode: value.barcode,
    pack_size: value.packSize,
    unit_description: value.unitDescription,
    units_per_carton: value.unitsPerCarton,
    cost_per_unit: value.costPerUnit,
    retail_price: value.retailPrice,
    wholesale_price: value.wholesalePrice,
    unit_price: value.retailPrice,
  };
  const result = value.id ? await supabase.from("product_skus").update(payload).eq("id", value.id) : await supabase.from("product_skus").insert(payload);
  if (result.error) redirect(`${path}?error=${mutationError(result.error)}`);
  revalidatePath(path);
  redirect(`${path}?saved=sku`);
}

export async function archiveSku(formData: FormData) {
  const path = "/products";
  const supabase = await requirePermission("products", path);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) validationRedirect(path);
  const { error } = await supabase.from("product_skus").update({ status: "archived", archived_at: new Date().toISOString() }).eq("id", id.data);
  if (error) redirect(`${path}?error=${mutationError(error)}`);
  revalidatePath(path);
  redirect(`${path}?saved=archived`);
}

export async function saveManufacturer(formData: FormData) {
  const path = "/products/manufacturers";
  const supabase = await requirePermission("products", path);
  const parsed = manufacturerSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) validationRedirect(path);
  const value = parsed.data;
  const payload = { name: value.name, code: value.code, contact_name: value.contactName, contact_email: value.contactEmail, contact_phone: value.contactPhone, address_line_1: value.addressLine1, address_line_2: value.addressLine2, city: value.city, country: value.country, default_currency: value.defaultCurrency.toUpperCase(), standard_lead_time_days: value.standardLeadTimeDays, minimum_order_quantity: value.minimumOrderQuantity, payment_terms: value.paymentTerms, tax_registration_details: value.taxRegistrationDetails, notes: value.notes };
  const result = value.id ? await supabase.from("manufacturers").update(payload).eq("id", value.id) : await supabase.from("manufacturers").insert(payload);
  if (result.error) redirect(`${path}?error=${mutationError(result.error)}`);
  revalidatePath("/products");
  revalidatePath(path);
  redirect(`${path}?saved=manufacturer`);
}

export async function archiveManufacturer(formData: FormData) {
  const path = "/products/manufacturers";
  const supabase = await requirePermission("products", path);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) validationRedirect(path);
  const { error } = await supabase.from("manufacturers").update({ status: "archived", archived_at: new Date().toISOString() }).eq("id", id.data);
  if (error) redirect(`${path}?error=${mutationError(error)}`);
  revalidatePath("/products");
  revalidatePath(path);
  redirect(`${path}?saved=archived`);
}

export async function saveSupplier(formData: FormData) {
  const path = "/products/suppliers";
  const supabase = await requirePermission("products", path);
  const parsed = supplierSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) validationRedirect(path);
  const value = parsed.data;
  const payload = { name: value.name, code: value.code, contact_name: value.contactName, contact_email: value.contactEmail, contact_phone: value.contactPhone, address_line_1: value.addressLine1, address_line_2: value.addressLine2, city: value.city, country: value.country, default_currency: value.defaultCurrency.toUpperCase(), standard_lead_time_days: value.standardLeadTimeDays, minimum_order_quantity: value.minimumOrderQuantity, payment_terms: value.paymentTerms, tax_registration_details: value.taxRegistrationDetails, notes: value.notes };
  const result = value.id ? await supabase.from("suppliers").update(payload).eq("id", value.id) : await supabase.from("suppliers").insert(payload);
  if (result.error) redirect(`${path}?error=${mutationError(result.error)}`);
  revalidatePath("/products");
  revalidatePath(path);
  redirect(`${path}?saved=supplier`);
}

export async function archiveSupplier(formData: FormData) {
  const path = "/products/suppliers";
  const supabase = await requirePermission("products", path);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) validationRedirect(path);
  const { error } = await supabase.from("suppliers").update({ status: "archived", archived_at: new Date().toISOString() }).eq("id", id.data);
  if (error) redirect(`${path}?error=${mutationError(error)}`);
  revalidatePath("/products");
  revalidatePath(path);
  redirect(`${path}?saved=archived`);
}

export async function saveSupplierCatalogItem(formData: FormData) {
  const parsed = catalogSchema.safeParse(Object.fromEntries(formData.entries()));
  const path = parsed.success ? catalogPath(parsed.data.ownerType) : "/products/suppliers";
  if (!parsed.success) validationRedirect(path);
  const supabase = await requirePermission("products", path);
  const value = parsed.data;
  const supplierId = value.ownerType === "supplier" ? value.supplierId : null;
  const manufacturerId = value.ownerType === "manufacturer" ? value.manufacturerId : null;
  if (value.ownerType === "supplier" && !supplierId) validationRedirect(path);
  if (value.ownerType === "manufacturer" && !manufacturerId) validationRedirect(path);
  const { error } = await supabase.rpc("save_supplier_catalog_item", {
    p_catalog_id: value.id,
    p_supplier_id: supplierId,
    p_manufacturer_id: manufacturerId,
    p_product_id: value.productId,
    p_sku_id: value.skuId,
    p_supplier_sku_code: value.supplierSkuCode,
    p_unit_cost: value.unitCost,
    p_currency_code: value.currencyCode,
    p_minimum_order_quantity: value.minimumOrderQuantity,
    p_lead_time_days: value.leadTimeDays,
    p_is_default: value.isDefault,
    p_notes: value.notes,
  });
  if (error) redirect(`${path}?error=${mutationError(error)}`);
  revalidatePath(path);
  revalidatePath("/purchase-orders");
  revalidatePath("/inbound");
  redirect(`${path}?saved=catalog`);
}

export async function archiveSupplierCatalogItem(formData: FormData) {
  const parsed = catalogArchiveSchema.safeParse(Object.fromEntries(formData.entries()));
  const path = parsed.success ? catalogPath(parsed.data.ownerType) : "/products/suppliers";
  if (!parsed.success) validationRedirect(path);
  const supabase = await requirePermission("products", path);
  const { error } = await supabase.rpc("archive_supplier_catalog_item", { p_catalog_id: parsed.data.id });
  if (error) redirect(`${path}?error=${mutationError(error)}`);
  revalidatePath(path);
  revalidatePath("/purchase-orders");
  revalidatePath("/inbound");
  redirect(`${path}?saved=archived`);
}

export async function saveLocation(formData: FormData) {
  const path = "/inventory";
  const supabase = await requirePermission("locations", path);
  const parsed = locationSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) validationRedirect(path);
  const value = parsed.data;
  const isBranch = value.locationType === "retailer_branch";
  if (isBranch && (!value.retailerId || !value.branchId)) validationRedirect(path);
  const payload = { code: value.code, name: value.name, location_type: value.locationType, retailer_id: isBranch ? value.retailerId : null, branch_id: isBranch ? value.branchId : null, address_line_1: value.addressLine1, city: value.city };
  const result = value.id ? await supabase.from("inventory_locations").update(payload).eq("id", value.id) : await supabase.from("inventory_locations").insert(payload);
  if (result.error) redirect(`${path}?error=${mutationError(result.error)}`);
  revalidatePath(path);
  redirect(`${path}?saved=location`);
}

export async function archiveLocation(formData: FormData) {
  const path = "/inventory";
  const supabase = await requirePermission("locations", path);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) validationRedirect(path);
  const { error } = await supabase.from("inventory_locations").update({ status: "archived", archived_at: new Date().toISOString() }).eq("id", id.data);
  if (error) redirect(`${path}?error=${mutationError(error)}`);
  revalidatePath(path);
  redirect(`${path}?saved=archived`);
}

export async function saveRetailer(formData: FormData) {
  const path = "/retailers";
  const supabase = await requirePermission("retailers", path);
  const parsed = retailerSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) validationRedirect(path);
  const value = parsed.data;
  const payload = { code: value.code, name: value.name, legal_name: value.legalName, tax_identifier: value.taxIdentifier, primary_contact_name: value.primaryContactName, primary_contact_email: value.primaryContactEmail, primary_contact_phone: value.primaryContactPhone, address_line_1: value.addressLine1, address_line_2: value.addressLine2, city: value.city, district: value.district, notes: value.notes };
  const result = value.id ? await supabase.from("retailers").update(payload).eq("id", value.id) : await supabase.from("retailers").insert(payload);
  if (result.error) redirect(`${path}?error=${mutationError(result.error)}`);
  revalidatePath(path);
  revalidatePath("/inventory");
  revalidatePath("/retailers/agreements");
  redirect(`${path}?saved=retailer`);
}

export async function archiveRetailer(formData: FormData) {
  const path = "/retailers";
  const supabase = await requirePermission("retailers", path);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) validationRedirect(path);
  const { error } = await supabase.from("retailers").update({ status: "archived", archived_at: new Date().toISOString() }).eq("id", id.data);
  if (error) redirect(`${path}?error=${mutationError(error)}`);
  revalidatePath(path);
  revalidatePath("/inventory");
  revalidatePath("/retailers/agreements");
  redirect(`${path}?saved=archived`);
}

export async function saveBranch(formData: FormData) {
  const path = "/retailers";
  const supabase = await requirePermission("retailers", path);
  const parsed = branchSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) validationRedirect(path);
  const value = parsed.data;
  const payload = { retailer_id: value.retailerId, code: value.code, name: value.name, address_line_1: value.addressLine1, address_line_2: value.addressLine2, city: value.city, district: value.district, contact_name: value.contactName, contact_phone: value.contactPhone };
  const result = value.id ? await supabase.from("retailer_branches").update(payload).eq("id", value.id) : await supabase.from("retailer_branches").insert(payload);
  if (result.error) redirect(`${path}?error=${mutationError(result.error)}`);
  revalidatePath(path);
  revalidatePath("/inventory");
  redirect(`${path}?saved=branch`);
}

export async function archiveBranch(formData: FormData) {
  const path = "/retailers";
  const supabase = await requirePermission("retailers", path);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) validationRedirect(path);
  const { error } = await supabase.from("retailer_branches").update({ status: "archived", archived_at: new Date().toISOString() }).eq("id", id.data);
  if (error) redirect(`${path}?error=${mutationError(error)}`);
  revalidatePath(path);
  revalidatePath("/inventory");
  redirect(`${path}?saved=archived`);
}

export async function saveAgreement(formData: FormData) {
  const path = "/retailers/agreements";
  const supabase = await requirePermission("agreements", path);
  const parsed = agreementSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) validationRedirect(path);
  const value = parsed.data;
  if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) validationRedirect(path);
  const payload = { retailer_id: value.retailerId, agreement_number: value.agreementNumber, arrangement_type: value.arrangementType, effective_from: value.effectiveFrom, effective_to: value.effectiveTo || null, payment_terms_days: value.paymentTermsDays, credit_limit: value.creditLimit, retailer_margin_percent: value.retailerMarginPercent, minimum_shelf_life_days: value.minimumShelfLifeDays, notes: value.notes };
  const result = value.id ? await supabase.from("retailer_commercial_agreements").update(payload).eq("id", value.id) : await supabase.from("retailer_commercial_agreements").insert(payload);
  if (result.error) redirect(`${path}?error=${mutationError(result.error)}`);
  revalidatePath(path);
  revalidatePath("/retailers");
  redirect(`${path}?saved=agreement`);
}

export async function archiveAgreement(formData: FormData) {
  const path = "/retailers/agreements";
  const supabase = await requirePermission("agreements", path);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) validationRedirect(path);
  const { error } = await supabase.from("retailer_commercial_agreements").update({ status: "archived", archived_at: new Date().toISOString() }).eq("id", id.data);
  if (error) redirect(`${path}?error=${mutationError(error)}`);
  revalidatePath(path);
  revalidatePath("/retailers");
  redirect(`${path}?saved=archived`);
}

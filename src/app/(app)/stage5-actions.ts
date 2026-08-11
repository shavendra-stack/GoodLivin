"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
const optionalUuid = z.string().uuid().optional().or(z.literal("")).transform((value) => value || null);
const textValue = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal("")).transform((value) => value || null);
const positiveInt = z.coerce.number().int().positive();
const nonNegativeInt = z.coerce.number().int().min(0);
const money = z.coerce.number().min(0);

async function requireStage5(path: string, roles: string[]) {
  const user = await getCurrentUser();
  if (!user || !user.roles.some((role) => roles.includes(role))) redirect(`${path}?error=not-authorized`);
  if (isDemoMode()) redirect(`${path}?error=demo`);
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(`${path}?error=not-configured`);
  return supabase;
}

function errorCode(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";
  if (error.code === "23505" || message.includes("duplicate") || message.includes("unique")) return "duplicate";
  if (message.includes("insufficient") || message.includes("negative inventory")) return "insufficient";
  if (message.includes("fefo")) return "fefo";
  if (message.includes("permission") || message.includes("only ") || message.includes("do not have")) return "not-authorized";
  if (message.includes("expired") || message.includes("approved") || message.includes("archived") || message.includes("active") || message.includes("relationship")) return "reference";
  if (error.code === "23514" || message.includes("required") || message.includes("invalid") || message.includes("quantity") || message.includes("reason")) return "validation";
  if (error.code === "42883" || error.code === "PGRST202" || error.code === "PGRST205") return "database";
  console.error("[goodlivin:stage5-action] operation failed", { code: error.code ?? null, message: error.message ?? null });
  return "server";
}

function fail(path: string, error: { code?: string; message?: string }): never {
  redirect(`${path}?error=${errorCode(error)}`);
}

const saleSchema = z.object({
  orderNumber: textValue(100), saleDate: z.string().date(), salesChannel: z.enum(["online_store", "retailer_branch", "direct_sale", "event_pop_up"]), fulfilmentLocationId: uuid, productId: uuid, skuId: uuid, batchId: optionalUuid, quantity: positiveInt, sellingPrice: money, discount: money, retailerId: optionalUuid, branchId: optionalUuid, customerName: optionalText(160), customerContact: optionalText(160), notes: optionalText(2000),
});

export async function createSalesOrder(formData: FormData) {
  const path = "/sales";
  const supabase = await requireStage5(path, ["director_admin", "inventory_manager", "sales_manager"]);
  const parsed = saleSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect(`${path}?error=validation`);
  const value = parsed.data;
  const { error } = await supabase.rpc("create_sales_order", { p_order_number: value.orderNumber, p_sale_date: value.saleDate, p_sales_channel: value.salesChannel, p_fulfilment_location_id: value.fulfilmentLocationId, p_product_id: value.productId, p_sku_id: value.skuId, p_batch_id: value.batchId, p_quantity: value.quantity, p_selling_price: value.sellingPrice, p_discount: value.discount, p_retailer_id: value.retailerId, p_branch_id: value.branchId, p_customer_name: value.customerName, p_customer_contact: value.customerContact, p_notes: value.notes });
  if (error) fail(path, error);
  revalidatePath(path); revalidatePath("/inventory");
  redirect(`${path}?saved=sale`);
}

async function orderAction(formData: FormData, operation: "confirm" | "fulfil" | "cancel" | "refund") {
  const path = "/sales";
  const roles = operation === "fulfil" ? ["director_admin", "inventory_manager", "warehouse_staff"] : operation === "refund" ? ["director_admin", "inventory_manager", "warehouse_staff"] : ["director_admin", "inventory_manager", "sales_manager"];
  const supabase = await requireStage5(path, roles);
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) redirect(`${path}?error=validation`);
  let result;
  if (operation === "confirm") result = await supabase.rpc("confirm_sales_order", { p_sales_order_id: id.data });
  if (operation === "fulfil") result = await supabase.rpc("fulfil_sales_order", { p_sales_order_id: id.data, p_override_reason: optionalText(1000).parse(formData.get("overrideReason") ?? "") });
  if (operation === "cancel") {
    const reason = textValue(1000).safeParse(formData.get("reason") ?? "");
    if (!reason.success) redirect(`${path}?error=validation`);
    result = await supabase.rpc("cancel_sales_order", { p_sales_order_id: id.data, p_reason: reason.data });
  }
  if (operation === "refund") {
    const condition = z.enum(["sellable", "damaged", "quarantined", "expired"]).safeParse(formData.get("condition"));
    const destination = uuid.safeParse(formData.get("destinationLocationId"));
    const reason = textValue(1000).safeParse(formData.get("reason") ?? "");
    if (!condition.success || !destination.success || !reason.success) redirect(`${path}?error=validation`);
    result = await supabase.rpc("refund_sales_order", { p_sales_order_id: id.data, p_condition: condition.data, p_destination_location_id: destination.data, p_reason: reason.data });
  }
  if (result?.error) fail(path, result.error);
  revalidatePath(path); revalidatePath("/returns"); revalidatePath("/inventory"); revalidatePath("/movements");
  redirect(`${path}?saved=${operation}`);
}

export async function confirmSalesOrder(formData: FormData) { return orderAction(formData, "confirm"); }
export async function fulfilSalesOrder(formData: FormData) { return orderAction(formData, "fulfil"); }
export async function cancelSalesOrder(formData: FormData) { return orderAction(formData, "cancel"); }
export async function refundSalesOrder(formData: FormData) { return orderAction(formData, "refund"); }

const reportSchema = z.object({
  reportNumber: textValue(100), reportDate: z.string().date(), periodStart: z.string().date(), periodEnd: z.string().date(), retailerId: uuid, branchId: uuid, productId: uuid, skuId: uuid, batchId: optionalUuid, quantitySold: nonNegativeInt, returnsQuantity: nonNegativeInt, damagedQuantity: nonNegativeInt, expiredQuantity: nonNegativeInt, returnLocationId: optionalUuid, damagedLocationId: optionalUuid, expiredLocationId: optionalUuid, notes: optionalText(2000),
});

export async function createRetailerSalesReport(formData: FormData) {
  const path = "/sales";
  const supabase = await requireStage5(path, ["director_admin", "inventory_manager", "sales_manager"]);
  const parsed = reportSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect(`${path}?error=validation`);
  const value = parsed.data;
  const { error } = await supabase.rpc("create_retailer_sales_report", { p_report_number: value.reportNumber, p_report_date: value.reportDate, p_period_start: value.periodStart, p_period_end: value.periodEnd, p_retailer_id: value.retailerId, p_branch_id: value.branchId, p_product_id: value.productId, p_sku_id: value.skuId, p_batch_id: value.batchId, p_quantity_sold: value.quantitySold, p_returns_quantity: value.returnsQuantity, p_damaged_quantity: value.damagedQuantity, p_expired_quantity: value.expiredQuantity, p_return_location_id: value.returnLocationId, p_damaged_location_id: value.damagedLocationId, p_expired_location_id: value.expiredLocationId, p_attachment_id: null, p_notes: value.notes });
  if (error) fail(path, error);
  revalidatePath(path); revalidatePath("/sell-through");
  redirect(`${path}?saved=report`);
}

export async function postRetailerSalesReport(formData: FormData) {
  const path = "/sales";
  const supabase = await requireStage5(path, ["director_admin", "inventory_manager"]);
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) redirect(`${path}?error=validation`);
  const { error } = await supabase.rpc("post_retailer_sales_report", { p_report_id: id.data, p_override_reason: optionalText(1000).parse(formData.get("overrideReason") ?? "") });
  if (error) fail(path, error);
  revalidatePath(path); revalidatePath("/sell-through"); revalidatePath("/inventory"); revalidatePath("/movements");
  redirect(`${path}?saved=report-posted`);
}

export async function cancelRetailerSalesReport(formData: FormData) {
  const path = "/sales";
  const supabase = await requireStage5(path, ["director_admin", "inventory_manager", "sales_manager"]);
  const id = uuid.safeParse(formData.get("id"));
  const reason = textValue(1000).safeParse(formData.get("reason") ?? "");
  if (!id.success || !reason.success) redirect(`${path}?error=validation`);
  const { error } = await supabase.rpc("cancel_retailer_sales_report", { p_report_id: id.data, p_reason: reason.data });
  if (error) fail(path, error);
  revalidatePath(path); revalidatePath("/sell-through");
  redirect(`${path}?saved=report-cancelled`);
}

const returnSchema = z.object({
  returnNumber: textValue(100), returnType: z.enum(["customer", "retailer"]), returnDate: z.string().date(), retailerId: optionalUuid, branchId: optionalUuid, sourceLocationId: optionalUuid, destinationLocationId: uuid, productId: uuid, skuId: uuid, batchId: uuid, quantity: positiveInt, condition: z.enum(["sellable", "damaged", "quarantined", "expired"]), reason: textValue(2000),
});

export async function createInventoryReturn(formData: FormData) {
  const path = "/returns";
  const supabase = await requireStage5(path, ["director_admin", "inventory_manager", "warehouse_staff"]);
  const parsed = returnSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect(`${path}?error=validation`);
  const value = parsed.data;
  const { error } = await supabase.rpc("create_inventory_return", { p_return_number: value.returnNumber, p_return_type: value.returnType, p_return_date: value.returnDate, p_retailer_id: value.retailerId, p_branch_id: value.branchId, p_source_location_id: value.sourceLocationId, p_destination_location_id: value.destinationLocationId, p_product_id: value.productId, p_sku_id: value.skuId, p_batch_id: value.batchId, p_quantity: value.quantity, p_condition: value.condition, p_reason: value.reason });
  if (error) fail(path, error);
  revalidatePath(path);
  redirect(`${path}?saved=return`);
}

export async function postInventoryReturn(formData: FormData) {
  const path = "/returns";
  const supabase = await requireStage5(path, ["director_admin", "inventory_manager", "warehouse_staff"]);
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) redirect(`${path}?error=validation`);
  const { error } = await supabase.rpc("post_inventory_return", { p_return_id: id.data, p_override_reason: optionalText(1000).parse(formData.get("overrideReason") ?? "") });
  if (error) fail(path, error);
  revalidatePath(path); revalidatePath("/inventory"); revalidatePath("/movements");
  redirect(`${path}?saved=return-posted`);
}

const reconciliationSchema = z.object({ reconciliationNumber: textValue(100), countDate: z.string().date(), retailerId: uuid, branchId: uuid, productId: uuid, skuId: uuid, batchId: uuid, countedQuantity: nonNegativeInt, reason: textValue(2000) });

export async function createRetailerReconciliation(formData: FormData) {
  const path = "/sell-through";
  const supabase = await requireStage5(path, ["director_admin", "inventory_manager"]);
  const parsed = reconciliationSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect(`${path}?error=validation`);
  const value = parsed.data;
  const { error } = await supabase.rpc("create_retailer_reconciliation", { p_reconciliation_number: value.reconciliationNumber, p_count_date: value.countDate, p_retailer_id: value.retailerId, p_branch_id: value.branchId, p_product_id: value.productId, p_sku_id: value.skuId, p_batch_id: value.batchId, p_counted_quantity: value.countedQuantity, p_reason: value.reason });
  if (error) fail(path, error);
  revalidatePath(path);
  redirect(`${path}?saved=reconciliation`);
}

export async function postRetailerReconciliation(formData: FormData) {
  const path = "/sell-through";
  const supabase = await requireStage5(path, ["director_admin", "inventory_manager"]);
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) redirect(`${path}?error=validation`);
  const { error } = await supabase.rpc("post_retailer_reconciliation", { p_reconciliation_id: id.data });
  if (error) fail(path, error);
  revalidatePath(path); revalidatePath("/inventory"); revalidatePath("/movements");
  redirect(`${path}?saved=reconciliation-posted`);
}

const targetSchema = z.object({ retailerId: uuid, branchId: uuid, productId: uuid, skuId: uuid, minimumStock: nonNegativeInt, targetStock: nonNegativeInt, leadTimeDays: nonNegativeInt });

export async function saveReplenishmentTarget(formData: FormData) {
  const path = "/replenishment";
  const supabase = await requireStage5(path, ["director_admin", "inventory_manager", "sales_manager"]);
  const parsed = targetSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success || parsed.data.targetStock < parsed.data.minimumStock) redirect(`${path}?error=validation`);
  const value = parsed.data;
  const { error } = await supabase.rpc("save_replenishment_target", { p_retailer_id: value.retailerId, p_branch_id: value.branchId, p_product_id: value.productId, p_sku_id: value.skuId, p_minimum_stock: value.minimumStock, p_target_stock: value.targetStock, p_lead_time_days: value.leadTimeDays });
  if (error) fail(path, error);
  revalidatePath(path); revalidatePath("/sell-through");
  redirect(`${path}?saved=target`);
}

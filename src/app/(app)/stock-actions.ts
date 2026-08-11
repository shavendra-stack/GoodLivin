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

const receiptSchema = z.object({
  receiptNumber: textValue(100), supplierId: optionalUuid, manufacturerId: optionalUuid, receivingLocationId: uuid, receivedOn: z.string().date(), productId: uuid, skuId: uuid, batchId: uuid,
  quantity: z.coerce.number().int().positive(), unitCost: z.coerce.number().nonnegative(), attachmentId: optionalUuid, inspectionStatus: z.enum(["passed", "pending", "failed"]), notes: optionalText(2000),
});
const transferSchema = z.object({ transferNumber: textValue(100), sourceLocationId: uuid, destinationLocationId: uuid, transferDate: z.string().date(), productId: uuid, skuId: uuid, batchId: uuid, quantity: z.coerce.number().int().positive(), attachmentId: optionalUuid, notes: optionalText(2000) });
const adjustmentSchema = z.object({ adjustmentNumber: textValue(100), adjustmentType: z.enum(["physical_count", "damaged_stock", "expired_stock", "sample_influencer_stock", "promotional_event", "return", "other"]), direction: z.enum(["in", "out"]), locationId: uuid, productId: uuid, skuId: uuid, batchId: uuid, quantity: z.coerce.number().int().positive(), unitCost: z.coerce.number().nonnegative(), reason: textValue(2000) });

type Operation = "receiving" | "prepare" | "post";

async function requireOperation(operation: Operation, path: string) {
  const user = await getCurrentUser();
  const allowed = operation === "post" ? ["director_admin", "inventory_manager"] : ["director_admin", "inventory_manager", "warehouse_staff"];
  if (!user || !user.roles.some((role) => allowed.includes(role))) redirect(`${path}?error=not-authorized`);
  if (isDemoMode()) redirect(`${path}?demo=1`);
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(`${path}?error=not-configured`);
  return supabase;
}

function operationError(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";
  if (["PGRST202", "PGRST205", "42P01", "42703", "42883"].includes(error.code ?? "")) return "database";
  if (error.code === "23505" || message.includes("duplicate") || message.includes("unique")) return "duplicate";
  if (message.includes("insufficient stock") || message.includes("negative inventory")) return "insufficient";
  if (message.includes("shelf-life") || message.includes("shelf life") || message.includes("retailer agreement")) return "shelf-life";
  if (message.includes("fefo")) return "fefo";
  if (message.includes("permission") || message.includes("only inventory") || message.includes("do not have")) return "not-authorized";
  if (message.includes("approved") || message.includes("expired") || message.includes("archived")) return "reference";
  if (error.code === "23514" || message.includes("quantity") || message.includes("cost") || message.includes("reason")) return "validation";
  return "server";
}

function logOperationError(operation: string, error: { code?: string; message?: string; details?: string | null; hint?: string | null }) {
  console.error(`[goodlivin:${operation}] Supabase operation failed`, {
    code: error.code ?? null,
    message: error.message ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
  });
}

function validationRedirect(path: string): never { redirect(`${path}?error=validation`); }

export async function receiveStock(formData: FormData) {
  const path = "/receiving";
  const supabase = await requireOperation("receiving", path);
  const parsed = receiptSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) validationRedirect(path);
  const value = parsed.data;
  const { error } = await supabase.rpc("receive_stock_receipt", {
    p_receipt_number: value.receiptNumber, p_supplier_id: value.supplierId, p_manufacturer_id: value.manufacturerId, p_receiving_location_id: value.receivingLocationId,
    p_received_on: value.receivedOn, p_product_id: value.productId, p_sku_id: value.skuId, p_batch_id: value.batchId, p_quantity: value.quantity, p_unit_cost: value.unitCost,
    p_attachment_id: value.attachmentId, p_inspection_status: value.inspectionStatus, p_notes: value.notes,
  });
  if (error) {
    logOperationError("receive-stock", error);
    redirect(`${path}?error=${operationError(error)}`);
  }
  revalidatePath(path); revalidatePath("/inventory"); revalidatePath("/movements"); revalidatePath("/batches");
  redirect(`${path}?saved=receipt`);
}

export async function createTransfer(formData: FormData) {
  const path = "/transfers";
  const supabase = await requireOperation("prepare", path);
  const parsed = transferSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) validationRedirect(path);
  const value = parsed.data;
  const { error } = await supabase.rpc("create_stock_transfer", {
    p_transfer_number: value.transferNumber, p_source_location_id: value.sourceLocationId, p_destination_location_id: value.destinationLocationId, p_transfer_date: value.transferDate,
    p_product_id: value.productId, p_sku_id: value.skuId, p_batch_id: value.batchId, p_quantity: value.quantity, p_attachment_id: value.attachmentId, p_notes: value.notes,
  });
  if (error) redirect(`${path}?error=${operationError(error)}`);
  revalidatePath(path); revalidatePath("/inventory");
  redirect(`${path}?saved=transfer`);
}

export async function dispatchTransfer(formData: FormData) {
  const path = "/transfers";
  const supabase = await requireOperation("post", path);
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) validationRedirect(path);
  const overrideReason = optionalText(1000).safeParse(formData.get("overrideReason") ?? "");
  if (!overrideReason.success) validationRedirect(path);
  const { error } = await supabase.rpc("dispatch_stock_transfer", { p_transfer_id: id.data, p_override_reason: overrideReason.data });
  if (error) redirect(`${path}?error=${operationError(error)}`);
  revalidatePath(path); revalidatePath("/inventory"); revalidatePath("/movements");
  redirect(`${path}?saved=dispatched`);
}

export async function receiveTransfer(formData: FormData) {
  const path = "/transfers";
  const supabase = await requireOperation("post", path);
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) validationRedirect(path);
  const { error } = await supabase.rpc("receive_stock_transfer", { p_transfer_id: id.data });
  if (error) redirect(`${path}?error=${operationError(error)}`);
  revalidatePath(path); revalidatePath("/inventory"); revalidatePath("/movements");
  redirect(`${path}?saved=received`);
}

export async function cancelTransfer(formData: FormData) {
  const path = "/transfers";
  const supabase = await requireOperation("prepare", path);
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) validationRedirect(path);
  const { error } = await supabase.rpc("cancel_stock_transfer", { p_transfer_id: id.data });
  if (error) redirect(`${path}?error=${operationError(error)}`);
  revalidatePath(path);
  redirect(`${path}?saved=cancelled`);
}

export async function createAdjustment(formData: FormData) {
  const path = "/adjustments";
  const supabase = await requireOperation("prepare", path);
  const parsed = adjustmentSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) validationRedirect(path);
  const value = parsed.data;
  const { error } = await supabase.rpc("create_stock_adjustment", {
    p_adjustment_number: value.adjustmentNumber, p_adjustment_type: value.adjustmentType, p_direction: value.direction, p_location_id: value.locationId,
    p_product_id: value.productId, p_sku_id: value.skuId, p_batch_id: value.batchId, p_quantity: value.quantity, p_unit_cost: value.unitCost, p_reason: value.reason,
  });
  if (error) redirect(`${path}?error=${operationError(error)}`);
  revalidatePath(path); revalidatePath("/inventory"); revalidatePath("/movements");
  redirect(`${path}?saved=adjustment`);
}

export async function postAdjustment(formData: FormData) {
  const path = "/adjustments";
  const supabase = await requireOperation("post", path);
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) validationRedirect(path);
  const { error } = await supabase.rpc("post_stock_adjustment", { p_adjustment_id: id.data });
  if (error) redirect(`${path}?error=${operationError(error)}`);
  revalidatePath(path); revalidatePath("/inventory"); revalidatePath("/movements");
  redirect(`${path}?saved=approved`);
}

export async function cancelAdjustment(formData: FormData) {
  const path = "/adjustments";
  const supabase = await requireOperation("prepare", path);
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) validationRedirect(path);
  const { error } = await supabase.rpc("cancel_stock_adjustment", { p_adjustment_id: id.data });
  if (error) redirect(`${path}?error=${operationError(error)}`);
  revalidatePath(path);
  redirect(`${path}?saved=cancelled`);
}

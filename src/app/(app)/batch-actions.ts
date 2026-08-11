"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/config";
import { createAttachmentFromForm } from "@/lib/attachments";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { QUALITY_STATUSES } from "@/lib/batches";

const optionalText = (max = 1000) => z.string().trim().max(max).optional().transform((value) => value || null);
const optionalUuid = z.string().uuid().optional().or(z.literal("")).transform((value) => value || null);
const optionalDate = z.string().date().optional().or(z.literal("")).transform((value) => value || null);

const batchSchema = z.object({
  id: optionalUuid,
  productId: z.string().uuid(),
  skuId: z.string().uuid(),
  batchNumber: z.string().trim().min(1).max(100),
  manufacturerId: optionalUuid,
  supplierId: optionalUuid,
  manufacturedOn: optionalDate,
  expiresOn: z.string().date(),
  receivedOn: optionalDate,
  initialQuantity: z.coerce.number().int().min(0),
  unitCost: z.coerce.number().min(0),
  qualityStatus: z.enum(QUALITY_STATUSES),
  attachmentId: optionalUuid,
  notes: optionalText(2000),
  correctionReason: optionalText(1000),
});

function mutationError(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";
  if (error.code === "23505") return "duplicate-code";
  if (error.code === "23514") return "validation";
  if (error.code === "23503") return "reference";
  if (message.includes("storage") || message.includes("bucket") || message.includes("attachment") || message.includes("mime") || message.includes("file")) return "attachment";
  if (message.includes("correction reason")) return "batch-correction-required";
  if (message.includes("archived")) return "archived-reference";
  if (message.includes("warehouse staff")) return "operations-only";
  if (message.includes("stock transactions")) return "batch-has-movements";
  return "server";
}

function validationRedirect(path: string): never {
  redirect(`${path}?error=validation`);
}

async function requireBatchMutation(path: string) {
  const user = await getCurrentUser();
  const canManage = Boolean(user?.roles.some((role) => role === "director_admin" || role === "inventory_manager"));
  const canOperate = Boolean(user?.roles.includes("warehouse_staff"));
  if (!user || (!canManage && !canOperate)) redirect(`${path}?error=not-authorized`);
  if (isDemoMode()) redirect(`${path}?demo=1`);
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(`${path}?error=not-configured`);
  return { user, supabase, canManage, canOperate };
}

async function requireBatchManager(path: string) {
  const user = await getCurrentUser();
  const canManage = Boolean(user?.roles.some((role) => role === "director_admin" || role === "inventory_manager"));
  if (!user || !canManage) redirect(`${path}?error=not-authorized`);
  if (isDemoMode()) redirect(`${path}?demo=1`);
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(`${path}?error=not-configured`);
  return supabase;
}

function protectedFieldsChanged(existing: Record<string, unknown>, value: z.infer<typeof batchSchema>) {
  return String(existing.product_id) !== value.productId
    || String(existing.sku_id) !== value.skuId
    || String(existing.batch_number) !== value.batchNumber
    || (existing.manufacturer_id as string | null) !== value.manufacturerId
    || (existing.supplier_id as string | null) !== value.supplierId
    || (existing.manufactured_on as string | null) !== value.manufacturedOn
    || String(existing.expires_on) !== value.expiresOn
    || (existing.received_on as string | null) !== value.receivedOn
    || Number(existing.initial_quantity ?? 0) !== value.initialQuantity
    || Number(existing.unit_cost ?? existing.purchase_cost ?? 0) !== value.unitCost
    || String(existing.quality_status ?? "pending") !== value.qualityStatus;
}

export async function saveBatch(formData: FormData) {
  const path = "/batches";
  const { supabase, canManage, canOperate } = await requireBatchMutation(path);
  const parsed = batchSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) validationRedirect(path);
  const value = parsed.data;

  if (value.manufacturedOn && value.expiresOn <= value.manufacturedOn) validationRedirect(path);
  if (value.receivedOn && value.manufacturedOn && value.receivedOn < value.manufacturedOn) validationRedirect(path);

  let existing: Record<string, unknown> | null = null;
  let hasMovements = false;
  if (value.id) {
    const { data } = await supabase.from("product_batches").select("*").eq("id", value.id).maybeSingle();
    existing = (data as Record<string, unknown> | null) ?? null;
    const movementResult = await supabase.from("stock_movements").select("id", { count: "exact", head: true }).eq("batch_id", value.id);
    hasMovements = (movementResult.count ?? 0) > 0;
  }

  if (existing && hasMovements && protectedFieldsChanged(existing, value) && !value.correctionReason) {
    redirect(`${path}?error=batch-correction-required`);
  }

  const batchId = value.id ?? crypto.randomUUID();
  const uploaded = await createAttachmentFromForm(supabase, formData, "product_batch", batchId);
  if (uploaded.error) redirect(`${path}?error=${uploaded.error}`);
  const attachmentId = uploaded.id ?? value.attachmentId;

  const fullPayload = {
    id: batchId,
    product_id: value.productId,
    sku_id: value.skuId,
    batch_number: value.batchNumber,
    manufacturer_id: value.manufacturerId,
    supplier_id: value.supplierId,
    manufactured_on: value.manufacturedOn,
    expires_on: value.expiresOn,
    received_on: value.receivedOn,
    initial_quantity: value.initialQuantity,
    unit_cost: canManage ? value.unitCost : 0,
    purchase_cost: canManage ? value.unitCost : 0,
    quality_status: canManage ? value.qualityStatus : "pending",
    attachment_id: attachmentId,
    notes: value.notes,
    correction_reason: value.correctionReason,
  };
  const operationalPayload = {
    received_on: value.receivedOn,
    initial_quantity: value.initialQuantity,
    attachment_id: attachmentId,
    notes: value.notes,
    correction_reason: value.correctionReason,
  };

  const result = value.id
    ? await supabase.from("product_batches").update(canOperate && !canManage ? operationalPayload : fullPayload).eq("id", value.id)
    : await supabase.from("product_batches").insert(fullPayload);
  if (result.error) redirect(`${path}?error=${mutationError(result.error)}`);
  revalidatePath(path);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  redirect(`${path}?saved=batch`);
}

export async function archiveBatch(formData: FormData) {
  const path = "/batches";
  const supabase = await requireBatchManager(path);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) validationRedirect(path);
  const { error } = await supabase.from("product_batches").update({ status: "archived", archived_at: new Date().toISOString() }).eq("id", id.data);
  if (error) redirect(`${path}?error=${mutationError(error)}`);
  revalidatePath(path);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  redirect(`${path}?saved=archived`);
}

export async function markNotificationRead(formData: FormData) {
  const path = "/notifications";
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isDemoMode()) redirect(`${path}?demo=1`);
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(`${path}?error=not-configured`);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) redirect(`${path}?error=validation`);
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id.data);
  if (error) redirect(`${path}?error=server`);
  revalidatePath(path);
  redirect(`${path}?saved=read`);
}

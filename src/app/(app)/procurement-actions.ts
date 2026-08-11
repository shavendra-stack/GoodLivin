"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/config";
import { createAttachmentFromForm } from "@/lib/attachments";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
const optionalUuid = z.string().uuid().optional().or(z.literal("")).transform((value) => value || null);
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal("")).transform((value) => value || null);
const money = z.coerce.number().min(0);
const date = z.string().date();

async function procurementClient(path: string, action: "view" | "manage" | "payments" | "receive" | "approve") {
  const user = await getCurrentUser();
  const roles = {
    view: ["director_admin", "inventory_manager", "warehouse_staff", "finance_team", "sales_manager", "auditor_read_only"],
    manage: ["director_admin", "inventory_manager"], payments: ["director_admin", "finance_team"], receive: ["director_admin", "inventory_manager", "warehouse_staff"], approve: ["director_admin"],
  }[action];
  if (!user || !user.roles.some((role) => roles.includes(role))) redirect(`${path}?error=not-authorized`);
  if (isDemoMode()) redirect(`${path}?demo=1`);
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(`${path}?error=not-configured`);
  return supabase;
}

function errorCode(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";
  if (error.code === "23505" || message.includes("unique") || message.includes("duplicate")) return "duplicate";
  if (error.code === "23514" || message.includes("quantity") || message.includes("cost") || message.includes("required") || message.includes("invalid")) return "validation";
  if (message.includes("storage") || message.includes("bucket") || message.includes("attachment")) return "attachment";
  if (error.code === "42501" || message.includes("permission") || message.includes("row-level") || message.includes("only director") || message.includes("not permitted")) return "not-authorized";
  if (message.includes("archived") || message.includes("active") || message.includes("eligible")) return "reference";
  if (message.includes("exceeds") || message.includes("overpayment") || message.includes("variance")) return "variance";
  if (["42P01", "42703", "42883", "PGRST202", "PGRST205"].includes(error.code ?? "")) return "database";
  return "server";
}

const lineSchema = z.object({ productId: uuid, skuId: uuid, quantityOrdered: z.coerce.number().int().positive(), unitCost: money, discountAmount: money, notes: optionalText(1000) });

export async function savePurchaseOrder(formData: FormData) {
  const path = "/purchase-orders";
  const supabase = await procurementClient(path, "manage");
  const rawLines = String(formData.get("lines") ?? "[]");
  let rawLineItems: unknown;
  try {
    rawLineItems = JSON.parse(rawLines);
  } catch {
    redirect(`${path}?error=validation`);
  }
  const parsedLines = z.array(lineSchema).min(1).safeParse(rawLineItems);
  const parsed = z.object({ id: optionalUuid, supplierId: optionalUuid, manufacturerId: optionalUuid, orderDate: date, expectedProductionCompletionDate: z.string().date().optional().or(z.literal("")), expectedDeliveryDate: z.string().date().optional().or(z.literal("")), receivingLocationId: uuid, currencyCode: z.string().trim().length(3), paymentTerms: optionalText(200), depositRequired: money, discountAmount: money, taxAmount: money, shippingAmount: money, additionalCosts: money, notes: optionalText(3000) }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success || !parsedLines.success) redirect(`${path}?error=validation`);
  const value = parsed.data;
  const lines = parsedLines.data.map((line) => ({ product_id: line.productId, sku_id: line.skuId, quantity_ordered: line.quantityOrdered, unit_cost: line.unitCost, discount_amount: line.discountAmount, notes: line.notes }));
  const { error } = await supabase.rpc("save_purchase_order", { p_purchase_order_id: value.id, p_supplier_id: value.supplierId, p_manufacturer_id: value.manufacturerId, p_order_date: value.orderDate, p_expected_production_completion_date: value.expectedProductionCompletionDate || null, p_expected_delivery_date: value.expectedDeliveryDate || null, p_receiving_location_id: value.receivingLocationId, p_currency_code: value.currencyCode, p_payment_terms: value.paymentTerms, p_deposit_required: value.depositRequired, p_discount_amount: value.discountAmount, p_tax_amount: value.taxAmount, p_shipping_amount: value.shippingAmount, p_additional_costs: value.additionalCosts, p_notes: value.notes, p_lines: lines });
  if (error) redirect(`${path}?error=${errorCode(error)}`);
  revalidatePath(path); revalidatePath("/inbound");
  redirect(`${path}?saved=created`);
}

export async function changePurchaseOrderStatus(formData: FormData) {
  const id = uuid.safeParse(formData.get("id")); const status = z.string().min(1).safeParse(formData.get("status")); const path = "/purchase-orders";
  if (!id.success || !status.success) redirect(`${path}?error=validation`);
  const action = status.data === "approved" ? "approve" : "manage";
  const supabase = await procurementClient(path, action);
  const reason = optionalText(1000).parse(formData.get("reason") ?? "");
  const { error } = await supabase.rpc("change_purchase_order_status", { p_purchase_order_id: id.data, p_status: status.data, p_reason: reason });
  if (error) redirect(`${path}?error=${errorCode(error)}`);
  revalidatePath(path); revalidatePath(`/purchase-orders/${id.data}`); revalidatePath("/inbound");
  redirect(`${path}?saved=status`);
}

export async function recordPurchaseOrderPayment(formData: FormData) {
  const path = `/purchase-orders/${String(formData.get("id") ?? "")}`;
  const supabase = await procurementClient(path, "payments");
  const parsed = z.object({ id: uuid, paymentNumber: z.string().trim().min(1).max(100), paymentType: z.enum(["deposit", "intermediate", "final", "other"]), paymentDate: date, amount: money.refine((value) => value > 0), currencyCode: z.string().length(3), paymentMethod: z.string().trim().min(1).max(80), referenceNumber: optionalText(100), attachmentId: optionalUuid, overpaymentReason: optionalText(1000) }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect(`${path}?error=validation`);
  const value = parsed.data;
  const uploaded = await createAttachmentFromForm(supabase, formData, "purchase_order_payment", value.id);
  if (uploaded.error) redirect(`${path}?error=${uploaded.error}`);
  const { error } = await supabase.rpc("record_purchase_order_payment", { p_purchase_order_id: value.id, p_payment_number: value.paymentNumber, p_payment_type: value.paymentType, p_payment_date: value.paymentDate, p_amount: value.amount, p_currency_code: value.currencyCode, p_payment_method: value.paymentMethod, p_reference_number: value.referenceNumber, p_attachment_id: value.attachmentId ?? uploaded.id, p_overpayment_reason: value.overpaymentReason });
  if (error) redirect(`${path}?error=${errorCode(error)}`);
  revalidatePath(path); revalidatePath("/purchase-orders");
  redirect(`${path}?saved=payment`);
}

export async function receivePurchaseOrderLine(formData: FormData) {
  const path = "/purchase-orders/receiving";
  const supabase = await procurementClient(path, "receive");
  const parsed = z.object({ purchaseOrderId: uuid, purchaseOrderLineId: uuid, receiptNumber: z.string().trim().min(1).max(100), receivedOn: date, receivingLocationId: uuid, batchId: optionalUuid, batchNumber: optionalText(100), manufacturedOn: z.string().date().optional().or(z.literal("")), expiresOn: z.string().date().optional().or(z.literal("")), quantityAccepted: z.coerce.number().int().min(0), quantityDamaged: z.coerce.number().int().min(0), quantityRejected: z.coerce.number().int().min(0), quantityQuarantined: z.coerce.number().int().min(0), attachmentId: optionalUuid, notes: optionalText(2000), varianceReason: optionalText(1000) }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect(`${path}?error=validation`);
  const value = parsed.data;
  const uploaded = await createAttachmentFromForm(supabase, formData, "purchase_order_receipt", value.purchaseOrderId);
  if (uploaded.error) redirect(`${path}?error=${uploaded.error}`);
  const { error } = await supabase.rpc("receive_purchase_order_line", { p_purchase_order_id: value.purchaseOrderId, p_purchase_order_line_id: value.purchaseOrderLineId, p_receipt_number: value.receiptNumber, p_received_on: value.receivedOn, p_receiving_location_id: value.receivingLocationId, p_batch_id: value.batchId, p_batch_number: value.batchNumber, p_manufactured_on: value.manufacturedOn || null, p_expires_on: value.expiresOn || null, p_quantity_accepted: value.quantityAccepted, p_quantity_damaged: value.quantityDamaged, p_quantity_rejected: value.quantityRejected, p_quantity_quarantined: value.quantityQuarantined, p_attachment_id: value.attachmentId ?? uploaded.id, p_notes: value.notes, p_variance_reason: value.varianceReason });
  if (error) redirect(`${path}?error=${errorCode(error)}`);
  revalidatePath(path); revalidatePath("/purchase-orders"); revalidatePath(`/purchase-orders/${value.purchaseOrderId}`); revalidatePath("/inbound"); revalidatePath("/inventory"); revalidatePath("/movements"); revalidatePath("/batches");
  redirect(`${path}?saved=receipt`);
}

export async function uploadPurchaseOrderDocument(formData: FormData) {
  const id = uuid.safeParse(formData.get("id"));
  const documentType = z.enum(["quotation", "proforma_invoice", "commercial_invoice", "payment_confirmation", "delivery_note", "certificate_of_analysis", "quality_compliance", "other"]).safeParse(formData.get("documentType"));
  const path = `/purchase-orders/${String(formData.get("id") ?? "")}`;
  if (!id.success || !documentType.success) redirect(`${path}?error=validation`);
  const supabase = await procurementClient(path, "manage");
  const uploaded = await createAttachmentFromForm(supabase, formData, "purchase_order", id.data);
  if (uploaded.error || !uploaded.id) redirect(`${path}?error=${uploaded.error ?? "validation"}`);
  const { error } = await supabase.rpc("attach_purchase_order_document", { p_purchase_order_id: id.data, p_attachment_id: uploaded.id, p_document_type: documentType.data });
  if (error) redirect(`${path}?error=${errorCode(error)}`);
  revalidatePath(path);
  redirect(`${path}?saved=document`);
}

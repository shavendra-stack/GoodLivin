"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/config";
import { ROLE_CODES, type RoleCode } from "@/lib/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ALERT_PRIORITIES } from "@/lib/alerts";

const uuidSchema = z.string().uuid();
const prioritySchema = z.enum(ALERT_PRIORITIES);
const roleSchema = z.enum(ROLE_CODES).refine((role) => role !== "retailer_user", "Retailer alerts are managed internally by GoodLivin.");

async function requireAlertAction(path: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isDemoMode()) redirect(`${path}?demo=1`);
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(`${path}?error=${encodeURIComponent("Supabase is not configured.")}`);
  return { user, supabase };
}

function redirectWithError(path: string, error: { message?: string } | null | unknown): never {
  const message = typeof error === "object" && error && "message" in error
    ? String((error as { message?: string }).message ?? "The alert action could not be completed.")
    : "The alert action could not be completed.";
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function parseId(formData: FormData, path: string) {
  const parsed = uuidSchema.safeParse(formData.get("id"));
  if (!parsed.success) redirect(`${path}?error=${encodeURIComponent("A valid alert ID is required.")}`);
  return parsed.data;
}

function parseNullableInteger(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseRecipientRoles(formData: FormData) {
  const roles = formData.getAll("recipientRoles")
    .map((value) => String(value))
    .filter((value) => value.length > 0);
  const parsed = z.array(roleSchema).min(1).safeParse(roles);
  return parsed.success ? parsed.data : null;
}

function automationErrorsMessage(errors: unknown) {
  if (!Array.isArray(errors) || errors.length === 0) return "The alert check was recorded as failed.";
  const messages = errors
    .map((error) => {
      if (typeof error === "string") return error;
      if (typeof error === "object" && error && "message" in error) return String((error as { message?: unknown }).message ?? "");
      return "";
    })
    .map((message) => message.trim())
    .filter(Boolean);
  return messages.length > 0 ? messages.join(" ") : "The alert check was recorded as failed.";
}

export async function runAlertCheck() {
  const path = "/notifications/automation";
  const { supabase } = await requireAlertAction(path);
  const { data: runId, error } = await supabase.rpc("stage8_run_operational_alert_check", { p_source: "manual" });
  if (error) redirectWithError(path, error);

  if (typeof runId === "string") {
    const { data: run, error: runError } = await supabase
      .from("alert_automation_runs")
      .select("status, records_checked, alerts_created, alerts_updated, alerts_resolved, errors")
      .eq("id", runId)
      .maybeSingle();
    if (runError) redirectWithError(path, runError);
    if (run?.status && run.status !== "succeeded") {
      redirect(`${path}?error=${encodeURIComponent(`Alert check failed: ${automationErrorsMessage(run.errors)}`)}`);
    }

    const checked = Number(run?.records_checked ?? 0).toLocaleString();
    const created = Number(run?.alerts_created ?? 0).toLocaleString();
    const updated = Number(run?.alerts_updated ?? 0).toLocaleString();
    const resolved = Number(run?.alerts_resolved ?? 0).toLocaleString();
    revalidatePath("/notifications");
    revalidatePath("/notifications/automation");
    revalidatePath("/notifications/approvals");
    revalidatePath("/dashboard");
    redirect(`${path}?saved=${encodeURIComponent(`Alert check succeeded: ${checked} checked, ${created} created, ${updated} updated, ${resolved} resolved.`)}`);
  }

  revalidatePath("/notifications");
  revalidatePath("/notifications/automation");
  revalidatePath("/notifications/approvals");
  revalidatePath("/dashboard");
  redirect(`${path}?saved=${encodeURIComponent("Alert check completed.")}`);
}

export async function markAlertRead(formData: FormData) {
  const path = "/notifications";
  const { supabase } = await requireAlertAction(path);
  const id = parseId(formData, path);
  const read = formData.get("read") !== "false";
  const { error } = await supabase.rpc("mark_operational_alert_read", { p_alert_id: id, p_read: read });
  if (error) redirectWithError(path, error);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  redirect(`${path}?saved=${encodeURIComponent(read ? "Marked as read." : "Marked as unread.")}`);
}

export async function acknowledgeAlert(formData: FormData) {
  const path = "/notifications";
  const { supabase } = await requireAlertAction(path);
  const id = parseId(formData, path);
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const { error } = await supabase.rpc("acknowledge_operational_alert", { p_alert_id: id, p_reason: reason });
  if (error) redirectWithError(path, error);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  redirect(`${path}?saved=${encodeURIComponent("Alert acknowledged.")}`);
}

export async function snoozeAlert(formData: FormData) {
  const path = "/notifications";
  const { supabase } = await requireAlertAction(path);
  const id = parseId(formData, path);
  const until = String(formData.get("snoozedUntil") ?? "");
  const parsedUntil = new Date(until);
  if (!until || Number.isNaN(parsedUntil.getTime()) || parsedUntil <= new Date()) {
    redirect(`${path}?error=${encodeURIComponent("Choose a future snooze date and time.")}`);
  }
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const { error } = await supabase.rpc("snooze_operational_alert", { p_alert_id: id, p_snoozed_until: parsedUntil.toISOString(), p_reason: reason });
  if (error) redirectWithError(path, error);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  redirect(`${path}?saved=${encodeURIComponent("Alert snoozed.")}`);
}

export async function resolveAlert(formData: FormData) {
  const path = "/notifications";
  const { supabase } = await requireAlertAction(path);
  const id = parseId(formData, path);
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) redirect(`${path}?error=${encodeURIComponent("A resolution reason is required.")}`);
  const { error } = await supabase.rpc("resolve_operational_alert", { p_alert_id: id, p_reason: reason });
  if (error) redirectWithError(path, error);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  redirect(`${path}?saved=${encodeURIComponent("Alert resolved.")}`);
}

export async function reopenAlert(formData: FormData) {
  const path = "/notifications";
  const { supabase } = await requireAlertAction(path);
  const id = parseId(formData, path);
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) redirect(`${path}?error=${encodeURIComponent("A reopen reason is required.")}`);
  const { error } = await supabase.rpc("reopen_operational_alert", { p_alert_id: id, p_reason: reason });
  if (error) redirectWithError(path, error);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  redirect(`${path}?saved=${encodeURIComponent("Alert reopened.")}`);
}

export async function assignAlert(formData: FormData) {
  const path = "/notifications";
  const { supabase } = await requireAlertAction(path);
  const id = parseId(formData, path);
  const role = roleSchema.safeParse(formData.get("assignedRole"));
  if (!role.success) redirect(`${path}?error=${encodeURIComponent("Choose a valid internal GoodLivin role.")}`);
  const userId = String(formData.get("assignedUserId") ?? "").trim();
  const parsedUserId = userId ? uuidSchema.safeParse(userId) : null;
  if (parsedUserId && !parsedUserId.success) redirect(`${path}?error=${encodeURIComponent("Assigned user ID must be a valid UID.")}`);
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const { error } = await supabase.rpc("assign_operational_alert", {
    p_alert_id: id,
    p_assigned_role: role.data,
    p_assigned_user_id: parsedUserId?.success ? parsedUserId.data : null,
    p_reason: reason,
  });
  if (error) redirectWithError(path, error);
  revalidatePath("/notifications");
  redirect(`${path}?saved=${encodeURIComponent("Alert assignment updated.")}`);
}

export async function saveAlertRule(formData: FormData) {
  const path = "/notifications/rules";
  const { supabase } = await requireAlertAction(path);
  const id = parseId(formData, path);
  const priority = prioritySchema.safeParse(formData.get("priority"));
  if (!priority.success) redirect(`${path}?error=${encodeURIComponent("Choose a valid priority.")}`);
  const roles = parseRecipientRoles(formData);
  if (!roles) redirect(`${path}?error=${encodeURIComponent("Choose at least one internal recipient role.")}`);

  const payload = {
    p_rule_id: id,
    p_enabled: formData.get("enabled") === "on",
    p_priority: priority.data,
    p_minimum_stock_level: parseNullableInteger(formData.get("minimumStockLevel")),
    p_target_stock_level: parseNullableInteger(formData.get("targetStockLevel")),
    p_reorder_point: parseNullableInteger(formData.get("reorderPoint")),
    p_expiry_warning_days: parseNullableInteger(formData.get("expiryWarningDays")),
    p_minimum_shelf_life_days: parseNullableInteger(formData.get("minimumShelfLifeDays")),
    p_retailer_sales_report_overdue_days: parseNullableInteger(formData.get("retailerSalesReportOverdueDays")),
    p_supplier_order_reminder_days: parseNullableInteger(formData.get("supplierOrderReminderDays")),
    p_purchase_order_payment_reminder_days: parseNullableInteger(formData.get("purchaseOrderPaymentReminderDays")),
    p_recipient_roles: roles satisfies RoleCode[],
  };
  const { error } = await supabase.rpc("save_operational_alert_rule", payload);
  if (error) redirectWithError(path, error);
  revalidatePath("/notifications");
  revalidatePath("/notifications/rules");
  redirect(`${path}?saved=${encodeURIComponent("Alert rule saved.")}`);
}

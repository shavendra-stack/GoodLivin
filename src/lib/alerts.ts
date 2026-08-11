import { isDemoMode } from "@/lib/config";
import { type CurrentUser, DEMO_USER } from "@/lib/auth";
import { ROLE_CODES, ROLE_LABELS, type RoleCode } from "@/lib/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const ALERT_PRIORITIES = ["informational", "low", "medium", "high", "critical"] as const;
export const ALERT_STATUSES = ["open", "acknowledged", "snoozed", "resolved"] as const;
export const ALERT_TYPES = [
  "stock.low_stock",
  "stock.out_of_stock",
  "expiry.approaching",
  "expiry.expired",
  "batch.quality_action",
  "retailer.replenishment",
  "retailer.sales_report_overdue",
  "purchase_order.approval_request",
  "purchase_order.not_sent",
  "purchase_order.delivery_due",
  "purchase_order.overdue",
  "purchase_order.outstanding_receipt",
  "purchase_order.payment_due",
  "inventory.adjustment_review",
  "inventory.discrepancy",
  "transfer.approval_request",
  "approval.pending",
] as const;

export type AlertPriority = (typeof ALERT_PRIORITIES)[number];
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export type OperationalAlert = {
  id: string;
  alertKey: string;
  alertType: string;
  priority: AlertPriority;
  title: string;
  explanation: string;
  recommendedAction: string;
  status: AlertStatus;
  dueAt: string | null;
  relatedTable: string | null;
  relatedRecordId: string | null;
  productId: string | null;
  skuId: string | null;
  batchId: string | null;
  locationId: string | null;
  retailerId: string | null;
  branchId: string | null;
  supplierId: string | null;
  purchaseOrderId: string | null;
  assignedRole: RoleCode | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionReason: string | null;
  metadata: Record<string, unknown>;
  lastEvaluatedAt: string;
  createdAt: string;
  updatedAt: string;
  href: string;
  isUnread: boolean;
  isSnoozedForUser: boolean;
  snoozedUntil: string | null;
  canManage: boolean;
  canAcknowledge: boolean;
};

export type AlertRule = {
  id: string;
  ruleCode: string;
  alertType: string;
  name: string;
  description: string | null;
  priority: AlertPriority;
  enabled: boolean;
  minimumStockLevel: number | null;
  targetStockLevel: number | null;
  reorderPoint: number | null;
  expiryWarningDays: number | null;
  minimumShelfLifeDays: number | null;
  retailerSalesReportOverdueDays: number | null;
  supplierOrderReminderDays: number | null;
  purchaseOrderPaymentReminderDays: number | null;
  recipientRoles: RoleCode[];
  updatedAt: string;
};

export type AlertEvent = {
  id: string;
  alertId: string | null;
  eventType: string;
  actorUserId: string | null;
  reason: string | null;
  createdAt: string;
};

export type AutomationRun = {
  id: string;
  automationName: string;
  triggerSource: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  recordsChecked: number;
  alertsCreated: number;
  alertsUpdated: number;
  alertsResolved: number;
  errors: unknown[];
  retryCount: number;
  triggeredBy: string | null;
};

export type ApprovalInboxRow = {
  id: string;
  requestType: string;
  recordType: string;
  recordId: string;
  requestedBy: string | null;
  requesterName: string | null;
  submittedAt: string;
  approvalStatus: string;
  reason: string | null;
  financialImpact: number | null;
  stockImpactQuantity: number | null;
  relatedTable: string | null;
  relatedRecordId: string | null;
  href: string;
};

export type AlertWorkspace = {
  alerts: OperationalAlert[];
  rules: AlertRule[];
  automationRuns: AutomationRun[];
  events: AlertEvent[];
  summary: {
    total: number;
    unread: number;
    open: number;
    critical: number;
    dueSoon: number;
    resolved: number;
  };
  error: string | null;
};

export type AlertFilters = {
  q?: string;
  status?: string;
  priority?: string;
  type?: string;
  assigned?: string;
};

const demoAlertId = "00000000-0000-0000-0000-000000000801";

const demoRules: AlertRule[] = [
  {
    id: "00000000-0000-0000-0000-000000000811",
    ruleCode: "expiry.warning.default",
    alertType: "expiry.approaching",
    name: "Expiry warning default",
    description: "Demo expiry alert threshold.",
    priority: "medium",
    enabled: true,
    minimumStockLevel: null,
    targetStockLevel: null,
    reorderPoint: null,
    expiryWarningDays: 90,
    minimumShelfLifeDays: null,
    retailerSalesReportOverdueDays: null,
    supplierOrderReminderDays: null,
    purchaseOrderPaymentReminderDays: null,
    recipientRoles: ["director_admin", "inventory_manager"],
    updatedAt: "2026-08-04T04:00:00.000Z",
  },
];

const demoRun: AutomationRun = {
  id: "00000000-0000-0000-0000-000000000821",
  automationName: "stage8_operational_alert_check",
  triggerSource: "manual",
  startedAt: "2026-08-04T04:00:00.000Z",
  completedAt: "2026-08-04T04:00:04.000Z",
  status: "succeeded",
  recordsChecked: 12,
  alertsCreated: 1,
  alertsUpdated: 2,
  alertsResolved: 0,
  errors: [],
  retryCount: 0,
  triggeredBy: DEMO_USER.id,
};

function emptyWorkspace(error: string | null = null): AlertWorkspace {
  return {
    alerts: [],
    rules: [],
    automationRuns: [],
    events: [],
    summary: { total: 0, unread: 0, open: 0, critical: 0, dueSoon: 0, resolved: 0 },
    error,
  };
}

function errorMessage(error: { message?: string; code?: string; details?: string | null; hint?: string | null } | null) {
  if (!error) return "Alert data could not be loaded.";
  if (error.code !== "PGRST205") {
    console.error("[goodlivin:alerts] Supabase query failed", {
      code: error.code ?? null,
      message: error.message ?? null,
      details: error.details ?? null,
      hint: error.hint ?? null,
    });
  }
  if (error.message?.includes("approval_records") || error.message?.includes("operational_approval_inbox")) {
    return "The approval inbox database grant is not active yet. Run supabase/migrations/202608030012_stage8_approval_inbox_grant_fix.sql in Supabase, then refresh.";
  }
  return error.message?.includes("operational_alerts")
    ? "Stage 8 alert tables are not available yet. Run the Stage 8 migration in Supabase, then refresh this page."
    : error.message ?? "Alert data could not be loaded.";
}

function nullable(row: Record<string, unknown>, key: string) {
  return row[key] == null ? null : String(row[key]);
}

function num(row: Record<string, unknown>, key: string) {
  return row[key] == null ? null : Number(row[key]);
}

function normalizePriority(value: unknown): AlertPriority {
  return ALERT_PRIORITIES.includes(value as AlertPriority) ? value as AlertPriority : "medium";
}

function normalizeStatus(value: unknown): AlertStatus {
  return ALERT_STATUSES.includes(value as AlertStatus) ? value as AlertStatus : "open";
}

function normalizeRoles(value: unknown): RoleCode[] {
  if (!Array.isArray(value)) return [];
  return value.filter((role): role is RoleCode => ROLE_CODES.includes(role as RoleCode));
}

export function alertTypeLabel(type: string) {
  return type
    .replaceAll(".", " · ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function priorityRank(priority: string) {
  return ({ informational: 1, low: 2, medium: 3, high: 4, critical: 5 } as Record<string, number>)[priority] ?? 0;
}

export function canManageAlertType(roles: string[], alertType: string) {
  if (roles.includes("director_admin")) return true;
  if (roles.includes("auditor_read_only") || roles.includes("retailer_user")) return false;
  if (roles.includes("inventory_manager") && /^(stock|batch|expiry|inventory|transfer|receiving)\./.test(alertType)) return true;
  if (roles.includes("inventory_manager") && ["retailer.replenishment", "approval.pending"].includes(alertType)) return true;
  if (roles.includes("inventory_manager") && alertType.startsWith("purchase_order.") && !alertType.includes("payment")) return true;
  if (roles.includes("sales_manager") && /^(retailer|sales)\./.test(alertType)) return true;
  if (roles.includes("sales_manager") && alertType === "approval.pending") return true;
  if (roles.includes("finance_team") && (alertType.includes("payment") || alertType.startsWith("finance.") || alertType === "approval.pending")) return true;
  return false;
}

export function canAcknowledgeAlert(roles: string[]) {
  return roles.some((role) => ["director_admin", "inventory_manager", "warehouse_staff", "finance_team", "sales_manager"].includes(role));
}

export function alertHref(alert: Pick<OperationalAlert, "relatedTable" | "relatedRecordId" | "batchId" | "purchaseOrderId" | "retailerId">) {
  const table = alert.relatedTable;
  const id = alert.relatedRecordId;
  if (table === "product_batches" && (id || alert.batchId)) return `/batches/${id ?? alert.batchId}`;
  if (table === "purchase_orders" && (id || alert.purchaseOrderId)) return `/purchase-orders/${id ?? alert.purchaseOrderId}`;
  if (table === "replenishment_targets" || table === "retailer_branches") return "/replenishment";
  if (table === "stock_transfers") return "/transfers";
  if (table === "stock_adjustments") return "/adjustments";
  if (table === "retailer_stock_reconciliations") return "/sell-through";
  if (table === "approval_records") return "/notifications/approvals";
  if (table === "product_skus") return "/inventory";
  if (alert.retailerId) return "/retailers";
  return "/notifications";
}

export function isSnoozedUntilFuture(snoozedUntil: string | null, priority: AlertPriority, now = new Date()) {
  if (!snoozedUntil || priority === "critical") return false;
  const parsed = new Date(snoozedUntil);
  return !Number.isNaN(parsed.getTime()) && parsed > now;
}

function matchesAlert(alert: OperationalAlert, filters: AlertFilters) {
  const query = filters.q?.trim().toLowerCase() ?? "";
  const matchesQuery = !query || [
    alert.title,
    alert.explanation,
    alert.recommendedAction,
    alert.alertType,
    alert.assignedRole ? ROLE_LABELS[alert.assignedRole] : null,
  ].some((value) => String(value ?? "").toLowerCase().includes(query));
  const matchesStatus = !filters.status || filters.status === "active" ? alert.status !== "resolved" : filters.status === "all" || alert.status === filters.status;
  const matchesPriority = !filters.priority || filters.priority === "all" || alert.priority === filters.priority;
  const matchesType = !filters.type || filters.type === "all" || alert.alertType === filters.type;
  const matchesAssigned = !filters.assigned || filters.assigned === "all" || alert.assignedRole === filters.assigned || (filters.assigned === "me" && alert.assignedUserId !== null);
  return matchesQuery && matchesStatus && matchesPriority && matchesType && matchesAssigned;
}

function buildSummary(alerts: OperationalAlert[]) {
  const dueSoon = alerts.filter((alert) => alert.dueAt && new Date(alert.dueAt) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)).length;
  return {
    total: alerts.length,
    unread: alerts.filter((alert) => alert.isUnread && alert.status !== "resolved" && !alert.isSnoozedForUser).length,
    open: alerts.filter((alert) => alert.status !== "resolved").length,
    critical: alerts.filter((alert) => alert.priority === "critical" && alert.status !== "resolved").length,
    dueSoon,
    resolved: alerts.filter((alert) => alert.status === "resolved").length,
  };
}

function mapRule(row: Record<string, unknown>): AlertRule {
  return {
    id: String(row.id),
    ruleCode: String(row.rule_code),
    alertType: String(row.alert_type),
    name: String(row.name),
    description: nullable(row, "description"),
    priority: normalizePriority(row.priority),
    enabled: Boolean(row.enabled),
    minimumStockLevel: num(row, "minimum_stock_level"),
    targetStockLevel: num(row, "target_stock_level"),
    reorderPoint: num(row, "reorder_point"),
    expiryWarningDays: num(row, "expiry_warning_days"),
    minimumShelfLifeDays: num(row, "minimum_shelf_life_days"),
    retailerSalesReportOverdueDays: num(row, "retailer_sales_report_overdue_days"),
    supplierOrderReminderDays: num(row, "supplier_order_reminder_days"),
    purchaseOrderPaymentReminderDays: num(row, "purchase_order_payment_reminder_days"),
    recipientRoles: normalizeRoles(row.recipient_roles),
    updatedAt: String(row.updated_at),
  };
}

function mapRun(row: Record<string, unknown>): AutomationRun {
  return {
    id: String(row.id),
    automationName: String(row.automation_name),
    triggerSource: String(row.trigger_source),
    startedAt: String(row.started_at),
    completedAt: nullable(row, "completed_at"),
    status: String(row.status),
    recordsChecked: Number(row.records_checked ?? 0),
    alertsCreated: Number(row.alerts_created ?? 0),
    alertsUpdated: Number(row.alerts_updated ?? 0),
    alertsResolved: Number(row.alerts_resolved ?? 0),
    errors: Array.isArray(row.errors) ? row.errors : [],
    retryCount: Number(row.retry_count ?? 0),
    triggeredBy: nullable(row, "triggered_by"),
  };
}

function mapEvent(row: Record<string, unknown>): AlertEvent {
  return {
    id: String(row.id),
    alertId: nullable(row, "alert_id"),
    eventType: String(row.event_type),
    actorUserId: nullable(row, "actor_user_id"),
    reason: nullable(row, "reason"),
    createdAt: String(row.created_at),
  };
}

function buildDemoWorkspace(filters: AlertFilters): AlertWorkspace {
  const demoAlert: OperationalAlert = {
    id: demoAlertId,
    alertKey: "demo:expiry",
    alertType: "expiry.approaching",
    priority: "medium",
    title: "Expiry watch: GL-MAG-2607",
    explanation: "Demo Magnesium Complex stock is within the configured expiry watch window.",
    recommendedAction: "Prioritize FEFO allocation and review retailer shelf-life requirements.",
    status: "open",
    dueAt: "2026-09-15T00:00:00.000Z",
    relatedTable: "product_batches",
    relatedRecordId: "00000000-0000-0000-0000-000000000241",
    productId: "00000000-0000-0000-0000-000000000210",
    skuId: "00000000-0000-0000-0000-000000000211",
    batchId: "00000000-0000-0000-0000-000000000241",
    locationId: null,
    retailerId: null,
    branchId: null,
    supplierId: null,
    purchaseOrderId: null,
    assignedRole: "inventory_manager",
    assignedUserId: null,
    assignedUserName: null,
    acknowledgedBy: null,
    acknowledgedAt: null,
    resolvedBy: null,
    resolvedAt: null,
    resolutionReason: null,
    metadata: { physical_stock: 1200, available_stock: 1200, days_remaining: 42 },
    lastEvaluatedAt: "2026-08-04T04:00:00.000Z",
    createdAt: "2026-08-04T04:00:00.000Z",
    updatedAt: "2026-08-04T04:00:00.000Z",
    href: "/batches/00000000-0000-0000-0000-000000000241",
    isUnread: true,
    isSnoozedForUser: false,
    snoozedUntil: null,
    canManage: true,
    canAcknowledge: true,
  };
  const alerts = [demoAlert].filter((alert) => matchesAlert(alert, filters));
  return { alerts, rules: demoRules, automationRuns: [demoRun], events: [], summary: buildSummary(alerts), error: null };
}

export async function getAlertWorkspace(user: CurrentUser, filters: AlertFilters = {}): Promise<AlertWorkspace> {
  if (isDemoMode()) return buildDemoWorkspace(filters);
  const supabase = await createServerSupabaseClient();
  if (!supabase) return emptyWorkspace("Supabase is not configured.");

  const [alertsResult, rulesResult, runsResult] = await Promise.all([
    supabase.from("operational_alerts").select("*").order("created_at", { ascending: false }).limit(300),
    supabase.from("operational_alert_rules").select("*").order("alert_type").order("name"),
    supabase.from("alert_automation_runs").select("*").order("started_at", { ascending: false }).limit(20),
  ]);
  const firstError = alertsResult.error ?? rulesResult.error ?? runsResult.error;
  if (firstError) return emptyWorkspace(errorMessage(firstError));

  const alertRows = (alertsResult.data ?? []) as Record<string, unknown>[];
  const alertIds = alertRows.map((row) => String(row.id));
  const userIds = new Set(alertRows.map((row) => nullable(row, "assigned_user_id")).filter((value): value is string => Boolean(value)));

  const [recipientResult, eventResult, profileResult] = await Promise.all([
    alertIds.length > 0 ? supabase.from("operational_alert_recipients").select("*").in("alert_id", alertIds) : Promise.resolve({ data: [], error: null }),
    alertIds.length > 0 ? supabase.from("operational_alert_events").select("id, alert_id, event_type, actor_user_id, reason, created_at").in("alert_id", alertIds).order("created_at", { ascending: false }).limit(200) : Promise.resolve({ data: [], error: null }),
    userIds.size > 0 ? supabase.from("profiles").select("user_id, display_name, email").in("user_id", Array.from(userIds)) : Promise.resolve({ data: [], error: null }),
  ]);
  if (recipientResult.error) return emptyWorkspace(errorMessage(recipientResult.error));

  const profileMap = new Map((profileResult.data ?? []).map((row) => [String(row.user_id), String(row.display_name ?? row.email ?? "Team member")]));
  const recipientsByAlert = new Map<string, Record<string, unknown>[]>();
  ((recipientResult.data ?? []) as Record<string, unknown>[]).forEach((row) => {
    const alertId = String(row.alert_id);
    recipientsByAlert.set(alertId, [...(recipientsByAlert.get(alertId) ?? []), row]);
  });

  const alerts = alertRows.map((row) => {
    const alertId = String(row.id);
    const priority = normalizePriority(row.priority);
    const ownRecipients = (recipientsByAlert.get(alertId) ?? []).filter((recipient) =>
      recipient.recipient_user_id === user.id || user.roles.includes(String(recipient.recipient_role_code) as RoleCode),
    );
    const personalRecipient = ownRecipients.find((recipient) => recipient.recipient_user_id === user.id);
    const readAt = personalRecipient?.read_at ?? ownRecipients.find((recipient) => recipient.read_at)?.read_at ?? null;
    const snoozedUntil = String(personalRecipient?.snoozed_until ?? ownRecipients.find((recipient) => recipient.snoozed_until)?.snoozed_until ?? "") || null;
    const alert: OperationalAlert = {
      id: alertId,
      alertKey: String(row.alert_key),
      alertType: String(row.alert_type),
      priority,
      title: String(row.title),
      explanation: String(row.explanation),
      recommendedAction: String(row.recommended_action),
      status: normalizeStatus(row.status),
      dueAt: nullable(row, "due_at"),
      relatedTable: nullable(row, "related_table"),
      relatedRecordId: nullable(row, "related_record_id"),
      productId: nullable(row, "product_id"),
      skuId: nullable(row, "sku_id"),
      batchId: nullable(row, "batch_id"),
      locationId: nullable(row, "location_id"),
      retailerId: nullable(row, "retailer_id"),
      branchId: nullable(row, "branch_id"),
      supplierId: nullable(row, "supplier_id"),
      purchaseOrderId: nullable(row, "purchase_order_id"),
      assignedRole: ROLE_CODES.includes(row.assigned_role as RoleCode) ? row.assigned_role as RoleCode : null,
      assignedUserId: nullable(row, "assigned_user_id"),
      assignedUserName: row.assigned_user_id ? profileMap.get(String(row.assigned_user_id)) ?? null : null,
      acknowledgedBy: nullable(row, "acknowledged_by"),
      acknowledgedAt: nullable(row, "acknowledged_at"),
      resolvedBy: nullable(row, "resolved_by"),
      resolvedAt: nullable(row, "resolved_at"),
      resolutionReason: nullable(row, "resolution_reason"),
      metadata: (row.metadata as Record<string, unknown> | null) ?? {},
      lastEvaluatedAt: String(row.last_evaluated_at),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      href: "/notifications",
      isUnread: !readAt,
      isSnoozedForUser: isSnoozedUntilFuture(snoozedUntil, priority),
      snoozedUntil,
      canManage: canManageAlertType(user.roles, String(row.alert_type)),
      canAcknowledge: canAcknowledgeAlert(user.roles),
    };
    return { ...alert, href: alertHref(alert) };
  }).filter((alert) => matchesAlert(alert, filters)).sort((left, right) => {
    if (left.status === "resolved" && right.status !== "resolved") return 1;
    if (right.status === "resolved" && left.status !== "resolved") return -1;
    return priorityRank(right.priority) - priorityRank(left.priority) || right.createdAt.localeCompare(left.createdAt);
  });

  return {
    alerts,
    rules: ((rulesResult.data ?? []) as Record<string, unknown>[]).map((row) => mapRule(row)),
    automationRuns: ((runsResult.data ?? []) as Record<string, unknown>[]).map((row) => mapRun(row)),
    events: ((eventResult.data ?? []) as Record<string, unknown>[]).map((row) => mapEvent(row)),
    summary: buildSummary(alerts),
    error: eventResult.error ? errorMessage(eventResult.error) : null,
  };
}

export async function getUnreadAlertCount(user: CurrentUser) {
  if (isDemoMode()) return 1;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return 0;
  const { data: alerts, error: alertError } = await supabase
    .from("operational_alerts")
    .select("id, priority, status")
    .neq("status", "resolved")
    .limit(200);
  if (alertError || !alerts || alerts.length === 0) return 0;
  const alertIds = alerts.map((alert) => String(alert.id));
  const { data: recipients, error: recipientError } = await supabase
    .from("operational_alert_recipients")
    .select("alert_id, recipient_user_id, recipient_role_code, read_at, snoozed_until")
    .in("alert_id", alertIds);
  if (recipientError) return 0;
  return alerts.filter((alert) => {
    const ownRecipients = (recipients ?? []).filter((recipient) =>
      recipient.alert_id === alert.id && (recipient.recipient_user_id === user.id || user.roles.includes(String(recipient.recipient_role_code) as RoleCode)),
    );
    const personalRecipient = ownRecipients.find((recipient) => recipient.recipient_user_id === user.id);
    const readAt = personalRecipient?.read_at ?? ownRecipients.find((recipient) => recipient.read_at)?.read_at ?? null;
    const snoozedUntil = String(personalRecipient?.snoozed_until ?? ownRecipients.find((recipient) => recipient.snoozed_until)?.snoozed_until ?? "") || null;
    return !readAt && !isSnoozedUntilFuture(snoozedUntil, normalizePriority(alert.priority));
  }).length;
}

export async function getApprovalInbox(user: CurrentUser): Promise<{ rows: ApprovalInboxRow[]; error: string | null }> {
  if (isDemoMode()) {
    return {
      rows: [{
        id: "00000000-0000-0000-0000-000000000831",
        requestType: "purchase_order_approval",
        recordType: "purchase_orders",
        recordId: "00000000-0000-0000-0000-000000000832",
        requestedBy: DEMO_USER.id,
        requesterName: DEMO_USER.displayName,
        submittedAt: "2026-08-04T04:00:00.000Z",
        approvalStatus: "pending_approval",
        reason: "Purchase order GL-PO-DEMO awaiting Director/Admin approval",
        financialImpact: 125000,
        stockImpactQuantity: null,
        relatedTable: "purchase_orders",
        relatedRecordId: "00000000-0000-0000-0000-000000000832",
        href: "/purchase-orders/00000000-0000-0000-0000-000000000832",
      }],
      error: null,
    };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return { rows: [], error: "Supabase is not configured." };
  const result = await supabase.from("operational_approval_inbox").select("*").order("submitted_at", { ascending: false }).limit(200);
  if (result.error) return { rows: [], error: errorMessage(result.error) };

  const rows = (result.data ?? []) as Record<string, unknown>[];
  const requesterIds = Array.from(new Set(rows.map((row) => nullable(row, "requested_by")).filter((value): value is string => Boolean(value))));
  const profiles = requesterIds.length > 0 ? await supabase.from("profiles").select("user_id, display_name, email").in("user_id", requesterIds) : { data: [] };
  const profileMap = new Map((profiles.data ?? []).map((row) => [String(row.user_id), String(row.display_name ?? row.email ?? "Team member")]));

  const canSeeFinance = user.roles.some((role) => ["director_admin", "finance_team", "auditor_read_only"].includes(role));
  return {
    rows: rows.map((row) => {
      const relatedTable = nullable(row, "related_table");
      const relatedRecordId = nullable(row, "related_record_id");
      const requestType = String(row.request_type);
      const href = relatedTable === "purchase_orders" && relatedRecordId ? `/purchase-orders/${relatedRecordId}`
        : relatedTable === "stock_transfers" ? "/transfers"
          : relatedTable === "stock_adjustments" ? "/adjustments"
            : "/notifications/approvals";
      return {
        id: String(row.id),
        requestType,
        recordType: String(row.record_type),
        recordId: String(row.record_id),
        requestedBy: nullable(row, "requested_by"),
        requesterName: row.requested_by ? profileMap.get(String(row.requested_by)) ?? null : null,
        submittedAt: String(row.submitted_at),
        approvalStatus: String(row.approval_status),
        reason: nullable(row, "reason"),
        financialImpact: canSeeFinance ? num(row, "financial_impact") : null,
        stockImpactQuantity: num(row, "stock_impact_quantity"),
        relatedTable,
        relatedRecordId,
        href,
      } satisfies ApprovalInboxRow;
    }),
    error: null,
  };
}

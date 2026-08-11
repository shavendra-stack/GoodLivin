export const ROLE_CODES = [
  "director_admin",
  "inventory_manager",
  "warehouse_staff",
  "finance_team",
  "sales_manager",
  "retailer_user",
  "auditor_read_only",
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export const ROLE_LABELS: Record<RoleCode, string> = {
  director_admin: "Director / Admin",
  inventory_manager: "Inventory Manager",
  warehouse_staff: "Warehouse Staff",
  finance_team: "Finance Team",
  sales_manager: "Sales Manager",
  retailer_user: "Retailer User",
  auditor_read_only: "Auditor / Read-only",
};

export const ROLE_DESCRIPTIONS: Record<RoleCode, string> = {
  director_admin: "Full operational control, approvals, and administrative access.",
  inventory_manager: "Inventory, batches, transfers, counts, and replenishment oversight.",
  warehouse_staff: "Day-to-day warehouse handling and stock-count execution.",
  finance_team: "Commercial agreements, costs, and financial reporting access.",
  sales_manager: "Retailer relationships, agreements, and sales-facing workflows.",
  retailer_user: "Scoped access to the assigned retailer and its branches.",
  auditor_read_only: "Read-only visibility for review and audit activities.",
};

export function roleLabel(role: string | null | undefined) {
  return role && role in ROLE_LABELS ? ROLE_LABELS[role as RoleCode] : "Unassigned";
}

export function hasRole(roles: string[], role: RoleCode) {
  return roles.includes(role);
}

export function canManageUsers(roles: string[]) {
  return roles.includes("director_admin");
}

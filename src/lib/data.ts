import { isDemoMode } from "@/lib/config";
import { DEMO_USER } from "@/lib/auth";
import { ROLE_CODES, ROLE_DESCRIPTIONS, ROLE_LABELS, type RoleCode } from "@/lib/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { displayNameFromProfile } from "@/lib/utils";

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: RoleCode | null;
  retailerId: string | null;
  createdAt: string;
};

export type RoleSummary = {
  code: RoleCode;
  label: string;
  description: string;
  userCount: number;
};

export const DEMO_ADMIN_USERS: AdminUser[] = [
  {
    id: DEMO_USER.id,
    email: DEMO_USER.email,
    displayName: DEMO_USER.displayName,
    role: "director_admin",
    retailerId: null,
    createdAt: "2026-07-18T04:30:00.000Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    email: "warehouse@goodlivin.demo",
    displayName: "Nimal Fernando",
    role: "warehouse_staff",
    retailerId: null,
    createdAt: "2026-07-21T06:15:00.000Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    email: "retail.user@goodlivin.demo",
    displayName: "Kavindi Silva",
    role: "retailer_user",
    retailerId: "00000000-0000-0000-0000-000000000101",
    createdAt: "2026-07-24T03:10:00.000Z",
  },
];

export async function getAdminUsers(): Promise<AdminUser[]> {
  if (isDemoMode()) return DEMO_ADMIN_USERS;

  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];

  const [{ data: profiles }, { data: assignments }] = await Promise.all([
    supabase.from("profiles").select("user_id, email, display_name, retailer_id, created_at").order("created_at"),
    supabase.from("user_roles").select("user_id, role_code").order("assigned_at"),
  ]);

  const roleMap = new Map<string, RoleCode>();
  (assignments ?? []).forEach((assignment) => {
    if (!roleMap.has(assignment.user_id)) roleMap.set(assignment.user_id, assignment.role_code as RoleCode);
  });

  return (profiles ?? []).map((profile) => ({
    id: profile.user_id,
    email: profile.email ?? "—",
    displayName: displayNameFromProfile(profile.display_name, profile.email),
    role: roleMap.get(profile.user_id) ?? null,
    retailerId: profile.retailer_id ?? null,
    createdAt: profile.created_at,
  }));
}

export async function getRoleSummaries(): Promise<RoleSummary[]> {
  if (isDemoMode()) {
    return ROLE_CODES.map((code) => ({
      code,
      label: ROLE_LABELS[code],
      description: ROLE_DESCRIPTIONS[code],
      userCount: DEMO_ADMIN_USERS.filter((user) => user.role === code).length,
    }));
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];

  const [{ data: roles }, { data: assignments }] = await Promise.all([
    supabase.from("roles").select("code, label, description").order("sort_order"),
    supabase.from("user_roles").select("role_code"),
  ]);
  const counts = new Map<string, number>();
  (assignments ?? []).forEach(({ role_code }) => counts.set(role_code, (counts.get(role_code) ?? 0) + 1));

  return (roles ?? []).map((role) => ({
    code: role.code as RoleCode,
    label: role.label,
    description: role.description,
    userCount: counts.get(role.code) ?? 0,
  }));
}

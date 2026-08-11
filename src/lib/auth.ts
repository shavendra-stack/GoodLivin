import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { type RoleCode } from "@/lib/roles";
import { displayNameFromProfile } from "@/lib/utils";

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  roles: RoleCode[];
  retailerId: string | null;
  isDemo: boolean;
};

export const DEMO_USER: CurrentUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "director@goodlivin.demo",
  displayName: "Amara Perera",
  roles: ["director_admin"],
  retailerId: null,
  isDemo: true,
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (isDemoMode()) return DEMO_USER;

  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, email, retailer_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("role_code").eq("user_id", user.id),
  ]);

  const roles = (roleRows ?? [])
    .map((row) => row.role_code)
    .filter((role): role is RoleCode => typeof role === "string") as RoleCode[];

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? "",
    displayName: displayNameFromProfile(profile?.display_name, profile?.email ?? user.email, user.user_metadata?.full_name),
    roles,
    retailerId: profile?.retailer_id ?? null,
    isDemo: false,
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

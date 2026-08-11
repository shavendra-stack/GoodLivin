"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getSiteUrl, isDemoMode } from "@/lib/config";
import { ROLE_CODES } from "@/lib/roles";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const assignmentSchema = z.object({
  userId: z.string().uuid(),
  roleCode: z.enum(ROLE_CODES),
});

const inviteSchema = z.object({ email: z.string().email() });

export async function inviteUser(formData: FormData) {
  const actor = await getCurrentUser();
  if (!actor?.roles.includes("director_admin")) redirect("/dashboard");

  const parsed = inviteSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) redirect("/settings/users?error=invalid-email");
  if (isDemoMode()) redirect("/settings/users?demo=1");

  const supabaseAdmin = createAdminSupabaseClient();
  if (!supabaseAdmin) redirect("/settings/users?error=invite-not-configured");

  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(parsed.data.email, { redirectTo: getSiteUrl("/login") });
  if (error) redirect("/settings/users?error=invite-failed");
  redirect("/settings/users?invited=1");
}

export async function assignRole(formData: FormData) {
  const actor = await getCurrentUser();
  if (!actor?.roles.includes("director_admin")) redirect("/dashboard");

  const parsed = assignmentSchema.safeParse({
    userId: formData.get("userId"),
    roleCode: formData.get("roleCode"),
  });
  if (!parsed.success) redirect("/settings/users?error=invalid-role");

  if (isDemoMode()) redirect("/settings/users?demo=1");

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/settings/users?error=not-configured");

  const { error } = await supabase.rpc("set_user_role", {
    target_user_id: parsed.data.userId,
    new_role_code: parsed.data.roleCode,
  });
  if (error) redirect("/settings/users?error=role-update");

  revalidatePath("/settings/users");
  revalidatePath("/settings/roles");
  redirect("/settings/users?updated=1");
}

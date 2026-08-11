"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { FALLBACK_DISPLAY_NAME } from "@/lib/utils";

const fullNameSchema = z.object({
  fullName: z.string().trim().max(160),
});

const targetFullNameSchema = fullNameSchema.extend({
  userId: z.string().uuid(),
});

export async function updateOwnProfile(formData: FormData) {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");

  const parsed = fullNameSchema.safeParse({ fullName: formData.get("fullName") });
  if (!parsed.success) redirect("/profile?error=invalid-name");
  if (isDemoMode()) redirect("/profile?demo=1");

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/profile?error=not-configured");

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.fullName || FALLBACK_DISPLAY_NAME })
    .eq("user_id", actor.id);

  if (error) redirect("/profile?error=save-failed");

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  revalidatePath("/settings/users");
  redirect("/profile?saved=1");
}

export async function updateUserFullName(formData: FormData) {
  const actor = await getCurrentUser();
  if (!actor?.roles.includes("director_admin")) redirect("/dashboard");

  const parsed = targetFullNameSchema.safeParse({
    userId: formData.get("userId"),
    fullName: formData.get("fullName"),
  });
  if (!parsed.success) redirect("/settings/users?error=invalid-name");
  if (isDemoMode()) redirect("/settings/users?demo=1");

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/settings/users?error=not-configured");

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.fullName || FALLBACK_DISPLAY_NAME })
    .eq("user_id", parsed.data.userId);

  if (error) redirect("/settings/users?error=name-update");

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  revalidatePath("/settings/users");
  redirect("/settings/users?nameUpdated=1");
}

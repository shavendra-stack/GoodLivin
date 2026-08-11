import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/config";

export function createBrowserSupabaseClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  return createBrowserClient(config.url, config.anonKey);
}

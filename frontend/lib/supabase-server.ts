import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function resolveSupabaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
}

function resolveServiceRoleKey(): string {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "").trim();
}

export function missingSupabaseServerEnv(): string[] {
  const missing: string[] = [];
  if (!resolveSupabaseUrl()) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!resolveServiceRoleKey()) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return missing;
}

export function createSupabaseServerClient(): SupabaseClient | null {
  const supabaseUrl = resolveSupabaseUrl();
  const serviceRoleKey = resolveServiceRoleKey();
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Bypasses RLS — use only in trusted server code (API routes).
 * Examples: PayFast ITN updates repayments; resolving auth user email for notifications.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns null if SUPABASE_SERVICE_ROLE_KEY is missing (e.g. local dev without key).
 */
export function createServiceRoleClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

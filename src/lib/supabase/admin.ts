import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseUrl, getServiceRoleKey } from "@/lib/env";

/**
 * Service-role Supabase client. BYPASSES Row Level Security — use only in
 * trusted server code (Server Actions / Route Handlers) for privileged
 * operations that cannot be expressed with a user session, e.g.:
 *  - atomic organization registration (create auth user, then rollback on
 *    failure),
 *  - bootstrapping the Super Admin from SUPER_ADMIN_EMAIL.
 *
 * NEVER import this into a client component or expose SUPABASE_SERVICE_ROLE_KEY
 * to the browser. It is a server-only secret.
 */
export function createSupabaseAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createSupabaseAdminClient must never be called in the browser.");
  }
  return createClient(getPublicSupabaseUrl(), getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

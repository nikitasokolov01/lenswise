/**
 * Centralized environment-variable access with clear startup errors.
 *
 * Public values (safe for the browser) are prefixed NEXT_PUBLIC_. Secrets are
 * read ONLY through the server helpers below and must never be prefixed
 * NEXT_PUBLIC_ or imported into a client component.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example and docs/SUPABASE_SETUP.md.`
    );
  }
  return value;
}

/** Public Supabase config (browser-safe). */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

export function getPublicSupabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", publicEnv.supabaseUrl);
}
export function getPublicSupabaseAnonKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", publicEnv.supabaseAnonKey);
}

/** Server-only service-role key. Throws in the browser. */
export function getServiceRoleKey(): string {
  if (typeof window !== "undefined") {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY must never be read in the browser.");
  }
  return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Server-only platform Super Admin email used to bootstrap the platform role. */
export function getSuperAdminEmail(): string | null {
  if (typeof window !== "undefined") return null;
  const value = process.env.LENSWISE_SUPER_ADMIN_EMAIL;
  return value && value.trim() !== "" ? value.trim() : null;
}

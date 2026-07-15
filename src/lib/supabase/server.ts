import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicSupabaseAnonKey, getPublicSupabaseUrl } from "@/lib/env";

/**
 * Server-side Supabase client bound to the request's auth cookies. Use in
 * Server Components, Route Handlers, and Server Actions. Access is always
 * scoped by the signed-in user + Row Level Security.
 *
 * In a plain Server Component, writing cookies is not allowed; those writes
 * are swallowed here and refreshed instead by the middleware
 * (updateSupabaseSession).
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    getPublicSupabaseUrl(),
    getPublicSupabaseAnonKey(),
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            /* called from a Server Component render — safe to ignore. */
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            /* called from a Server Component render — safe to ignore. */
          }
        },
      },
    }
  );
}

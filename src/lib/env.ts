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

/**
 * Public site URL (browser-safe). Used to build Stripe Checkout / Portal
 * success + return URLs. e.g. https://app.lenswise.com (no trailing slash).
 */
export function getSiteUrl(): string {
  const value = required("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL);
  return value.replace(/\/+$/, "");
}

/** Public Stripe publishable key (browser-safe). */
export function getStripePublishableKey(): string {
  return required("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
}

/** Server-only Stripe secret key. Throws in the browser. */
export function getStripeSecretKey(): string {
  if (typeof window !== "undefined") {
    throw new Error("STRIPE_SECRET_KEY must never be read in the browser.");
  }
  return required("STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY);
}

/** Server-only Stripe webhook signing secret. Throws in the browser. */
export function getStripeWebhookSecret(): string {
  if (typeof window !== "undefined") {
    throw new Error("STRIPE_WEBHOOK_SECRET must never be read in the browser.");
  }
  return required("STRIPE_WEBHOOK_SECRET", process.env.STRIPE_WEBHOOK_SECRET);
}

/** Server-only Stripe Price ID for the LensWise Professional plan. */
export function getStripePriceId(): string {
  if (typeof window !== "undefined") {
    throw new Error("STRIPE_PRICE_ID must never be read in the browser.");
  }
  return required("STRIPE_PRICE_ID", process.env.STRIPE_PRICE_ID);
}

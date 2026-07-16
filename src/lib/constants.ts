export const DEFAULT_DEMO_ADMIN_PIN = "1234";

/**
 * The PIN is read from a public env var so it can be configured per
 * deployment without a code change. This is demonstration-level protection
 * only (a client-visible constant) and is NOT secure enough to gate real
 * pricing or business data in production. See README.md.
 */
export function getDemoAdminPin(): string {
  const configured = process.env.NEXT_PUBLIC_DEMO_ADMIN_PIN;
  if (configured && configured.trim().length > 0) {
    return configured.trim();
  }
  return DEFAULT_DEMO_ADMIN_PIN;
}

export function isUsingDefaultPin(): boolean {
  const configured = process.env.NEXT_PUBLIC_DEMO_ADMIN_PIN;
  return !configured || configured.trim().length === 0;
}

export const LOCAL_STORAGE_PRICING_KEY = "optical-quote-calculator:pricing-config:v1";
export const SESSION_STORAGE_ADMIN_UNLOCK_KEY = "optical-quote-calculator:admin-unlocked";

export const PRICING_SETUP_NOTE =
  "Set your office's approved price list in Admin Pricing.";

export const QUOTE_ESTIMATE_DISCLAIMER_DEFAULT =
  "This is an estimate only and may be subject to insurance verification, plan-year benefit changes, and final prescription requirements.";

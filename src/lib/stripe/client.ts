import "server-only";
import Stripe from "stripe";
import { getStripeSecretKey } from "@/lib/env";

/**
 * Server-only Stripe client. The `server-only` import makes the build FAIL if
 * this module is ever imported into a client component, guaranteeing the secret
 * key never reaches the browser. Use in Server Actions and Route Handlers only.
 */
let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
  if (typeof window !== "undefined") {
    throw new Error("The Stripe client must never be constructed in the browser.");
  }
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(getStripeSecretKey(), {
      // Pinned via the installed SDK's default API version; typescript types on.
      typescript: true,
      appInfo: { name: "LensWise", url: "https://lenswise.app" },
    });
  }
  return stripeSingleton;
}

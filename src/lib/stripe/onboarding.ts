import "server-only";
import { getStripe } from "@/lib/stripe/client";
import { getSiteUrl, getStripePriceId } from "@/lib/env";
import { buildOnboardingMetadata, type OnboardingInput } from "@/lib/stripe/onboardingMetadata";

/**
 * Public self-service onboarding via Stripe Checkout. The Supabase Auth user is
 * created first; the ORGANIZATION is created only by the webhook after Checkout
 * completes. The Checkout Session carries the organization/owner details as
 * metadata — the webhook treats these as the source of truth for org creation.
 */

export type { OnboardingInput };
export { buildOnboardingMetadata };

/**
 * Create (or reuse) the Stripe customer for this owner email and open a
 * subscription Checkout Session that begins the 14-day trial. Returns the hosted
 * Checkout URL, or an error message. The organization does not exist yet.
 */
export async function createOnboardingCheckout(
  input: OnboardingInput
): Promise<{ url?: string; error?: string }> {
  try {
    const stripe = getStripe();
    const metadata = buildOnboardingMetadata(input);

    // Reuse an existing customer for this email to avoid duplicates on resume.
    const existing = await stripe.customers.list({ email: input.email, limit: 1 });
    let customerId: string;
    if (existing.data[0]) {
      customerId = existing.data[0].id;
      await stripe.customers.update(customerId, { name: input.practiceName, metadata });
    } else {
      const created = await stripe.customers.create({ email: input.email, name: input.practiceName, metadata });
      customerId = created.id;
    }

    const site = getSiteUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: getStripePriceId(), quantity: 1 }],
      client_reference_id: input.userId,
      allow_promotion_codes: true,
      metadata,
      subscription_data: {
        trial_period_days: 14,
        metadata,
      },
      success_url: `${site}/checkout-success`,
      cancel_url: `${site}/checkout-cancel`,
    });

    if (!session.url) return { error: "Could not start checkout. Please try again." };
    return { url: session.url };
  } catch (err) {
    console.error("[onboarding] checkout failed:", err instanceof Error ? err.message : "unknown");
    return { error: "Could not start checkout. Please try again." };
  }
}

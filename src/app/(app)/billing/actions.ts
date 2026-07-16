"use server";

import { requireBillingManagement } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { getOrCreateStripeCustomer } from "@/lib/stripe/sync";
import { writeBillingAudit } from "@/lib/billing/audit";
import { getSiteUrl, getStripePriceId } from "@/lib/env";

export interface BillingActionResult {
  url?: string;
  error?: string;
}

/**
 * Start (or upgrade to) the LensWise Professional subscription via Stripe
 * Checkout. Owner/Admin only; the organization is resolved from the trusted
 * server context — never from the browser. The webhook (not this redirect) is
 * the source of truth for granting access.
 */
export async function createCheckoutSessionAction(): Promise<BillingActionResult> {
  const ctx = await requireBillingManagement();
  const org = ctx.organization;

  try {
    const admin = createSupabaseAdminClient();
    const customerId = await getOrCreateStripeCustomer(admin, {
      organizationId: org.id,
      organizationName: org.name,
      billingEmail: ctx.billing?.billingEmail ?? null,
      ownerEmail: ctx.user.email,
      existingCustomerId: ctx.billing?.stripeCustomerId ?? null,
    });

    const siteUrl = getSiteUrl();
    // Preserve any remaining free-trial days so mid-trial upgrades are not
    // charged until the trial actually ends. Stripe requires a Checkout
    // trial_end at least 48 hours out; otherwise we omit it and start billing now.
    const trialEndMs = ctx.billing?.trialEnd ? new Date(ctx.billing.trialEnd).getTime() : 0;
    const trialInFuture = Number.isFinite(trialEndMs) && trialEndMs > Date.now() + 48 * 60 * 60 * 1000;

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: getStripePriceId(), quantity: 1 }],
      success_url: `${siteUrl}/billing?checkout=success`,
      cancel_url: `${siteUrl}/billing?checkout=canceled`,
      client_reference_id: org.id,
      allow_promotion_codes: true,
      metadata: { organization_id: org.id, organization_name: org.name },
      subscription_data: {
        metadata: { organization_id: org.id, organization_name: org.name },
        ...(trialInFuture ? { trial_end: Math.floor(trialEndMs / 1000) } : {}),
      },
    });

    await writeBillingAudit(admin, {
      organizationId: org.id,
      actorId: ctx.user.id,
      action: "billing.checkout_created",
      targetType: "checkout_session",
      targetId: session.id,
      metadata: {},
    });

    if (!session.url) return { error: "Could not start checkout. Please try again." };
    return { url: session.url };
  } catch (err) {
    console.error("[billing] checkout session failed:", err instanceof Error ? err.message : "unknown");
    return { error: "Could not start checkout. Please try again." };
  }
}

/**
 * Open the hosted Stripe Customer Portal for payment-method updates, invoice
 * history, cancellation, and resumption. Owner/Admin only. Requires an existing
 * Stripe customer.
 */
export async function createPortalSessionAction(): Promise<BillingActionResult> {
  const ctx = await requireBillingManagement();
  const org = ctx.organization;

  const customerId = ctx.billing?.stripeCustomerId ?? null;
  if (!customerId) {
    return { error: "No billing account exists yet. Start a subscription first." };
  }

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getSiteUrl()}/billing`,
    });
    return { url: session.url };
  } catch (err) {
    console.error("[billing] portal session failed for org", org.id, err instanceof Error ? err.message : "unknown");
    return { error: "Could not open the billing portal. Please try again." };
  }
}

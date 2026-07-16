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
 * Start the LensWise Professional subscription via Stripe Checkout. Owner/Admin
 * only; the organization is resolved from the trusted server context — never
 * from the browser. The webhook (not this redirect) is the source of truth for
 * granting access. Stripe owns the trial: LensWise never calculates trial dates.
 *
 * The 14-day free trial is redeemable ONCE per organization for its lifetime: it
 * is only offered when the org has never redeemed a trial. If it has (even a
 * trial it later canceled), Checkout starts a normal paid subscription with no
 * trial. If the organization already has a live subscription (trialing or
 * active), no new Checkout Session is created — the caller is sent to Manage
 * Billing.
 */
export async function createCheckoutSessionAction(): Promise<BillingActionResult> {
  const ctx = await requireBillingManagement();
  const org = ctx.organization;

  const status = ctx.billing?.status ?? null;
  if (status === "trialing" || status === "active") {
    return { error: "You already have an active subscription. Use Manage Billing to make changes." };
  }

  try {
    const admin = createSupabaseAdminClient();

    // The free trial is redeemable ONCE per organization for its lifetime.
    // Read the redemption marker authoritatively via the service role; if the
    // organization has already redeemed a trial (even one it later canceled),
    // this Checkout starts a normal paid subscription with NO trial.
    const { data: redemption } = await admin
      .from("organization_billing")
      .select("trial_redeemed_at")
      .eq("organization_id", org.id)
      .maybeSingle();
    const trialEligible = !(redemption as { trial_redeemed_at: string | null } | null)?.trial_redeemed_at;

    const customerId = await getOrCreateStripeCustomer(admin, {
      organizationId: org.id,
      organizationName: org.name,
      billingEmail: ctx.billing?.billingEmail ?? null,
      ownerEmail: ctx.user.email,
      existingCustomerId: ctx.billing?.stripeCustomerId ?? null,
    });

    const siteUrl = getSiteUrl();
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: getStripePriceId(), quantity: 1 }],
      success_url: `${siteUrl}/settings?section=billing&checkout=success`,
      cancel_url: `${siteUrl}/settings?section=billing&checkout=canceled`,
      client_reference_id: org.id,
      allow_promotion_codes: true,
      metadata: { organization_id: org.id, organization_name: org.name },
      subscription_data: {
        // Grant the 14-day Stripe trial only if the org has never redeemed one.
        ...(trialEligible ? { trial_period_days: 14 } : {}),
        metadata: { organization_id: org.id, organization_name: org.name },
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
      return_url: `${getSiteUrl()}/settings?section=billing`,
    });
    return { url: session.url };
  } catch (err) {
    console.error("[billing] portal session failed for org", org.id, err instanceof Error ? err.message : "unknown");
    return { error: "Could not open the billing portal. Please try again." };
  }
}

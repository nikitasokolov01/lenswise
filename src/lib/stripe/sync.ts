import "server-only";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe/client";
import { writeBillingAudit } from "@/lib/billing/audit";
import { normalizeStatus, type SubscriptionStatus } from "@/lib/billing/status";

interface OrgCustomerInput {
  organizationId: string;
  organizationName: string;
  billingEmail: string | null;
  ownerEmail: string | null;
  existingCustomerId: string | null;
}

/**
 * Return the organization's Stripe customer id, reusing the stored one when it
 * exists and creating a single new customer otherwise. This prevents duplicate
 * Stripe customers for the same organization. The organization id/name are
 * attached as customer metadata so webhooks can always resolve the org.
 */
export async function getOrCreateStripeCustomer(
  admin: SupabaseClient,
  input: OrgCustomerInput
): Promise<string> {
  if (input.existingCustomerId) return input.existingCustomerId;

  const stripe = getStripe();
  const email = input.billingEmail || input.ownerEmail || undefined;

  const customer = await stripe.customers.create({
    email,
    name: input.organizationName,
    metadata: {
      organization_id: input.organizationId,
      organization_name: input.organizationName,
    },
  });

  await admin
    .from("organization_billing")
    .update({ stripe_customer_id: customer.id, billing_email: email ?? null })
    .eq("organization_id", input.organizationId);

  await writeBillingAudit(admin, {
    organizationId: input.organizationId,
    actorId: null,
    action: "billing.customer_created",
    targetType: "stripe_customer",
    targetId: customer.id,
    metadata: {},
  });

  return customer.id;
}

function customerIdOf(subscription: Stripe.Subscription): string {
  return typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
}

/**
 * Resolve the LensWise organization for a Stripe subscription without trusting
 * any browser input:
 *  1. the stored stripe_customer_id,
 *  2. the subscription's organization_id metadata,
 *  3. the Stripe customer's organization_id metadata.
 */
async function resolveOrg(
  admin: SupabaseClient,
  subscription: Stripe.Subscription,
  customer: Stripe.Customer | Stripe.DeletedCustomer
): Promise<string | null> {
  const customerId = customerIdOf(subscription);

  const { data } = await admin
    .from("organization_billing")
    .select("organization_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (data?.organization_id) return data.organization_id as string;

  if (subscription.metadata?.organization_id) return subscription.metadata.organization_id;

  if (!customer.deleted && customer.metadata?.organization_id) return customer.metadata.organization_id;

  return null;
}

/**
 * Idempotently synchronize a Stripe subscription's ABSOLUTE state onto the
 * organization's billing row — the ONLY place billing state changes. Every
 * value (status, trial_end, current_period_end, cancel_at_period_end,
 * customer/subscription ids, billing_email) comes directly from Stripe; nothing
 * is calculated or invented locally. Because the whole state is overwritten
 * (never incremented) and keyed by organization_id, replaying the same webhook
 * event cannot corrupt billing state. Returns the org id it synchronized, or
 * null when it could not be resolved.
 */
function getCurrentPeriodEnd(
  subscription: Stripe.Subscription
): number | null {
  const topLevelValue = (
    subscription as Stripe.Subscription & {
      current_period_end?: unknown;
    }
  ).current_period_end;

  if (typeof topLevelValue === "number" && Number.isFinite(topLevelValue)) {
    return topLevelValue;
  }

  const firstItem = subscription.items.data[0];

  if (firstItem) {
    const itemValue = (
      firstItem as Stripe.SubscriptionItem & {
        current_period_end?: unknown;
      }
    ).current_period_end;

    if (typeof itemValue === "number" && Number.isFinite(itemValue)) {
      return itemValue;
    }
  }

  return null;
}

function stripeTimestampToIso(
  timestamp: number | null | undefined
): string | null {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp * 1000).toISOString();
}
export async function syncSubscriptionToOrg(
  admin: SupabaseClient,
  subscription: Stripe.Subscription
): Promise<{ organizationId: string; status: SubscriptionStatus } | null> {
  const stripe = getStripe();
  const customerId = customerIdOf(subscription);

  // One customer fetch: used for org-metadata fallback AND billing_email.
  const customer = await stripe.customers.retrieve(customerId);
  const billingEmail = customer.deleted ? null : customer.email ?? null;

  const organizationId = await resolveOrg(admin, subscription, customer);
  if (!organizationId) return null;

  const status = normalizeStatus(subscription.status);
  const firstItem = subscription.items.data[0];
  const priceId = firstItem?.price.id ?? null;

  const currentPeriodEnd = getCurrentPeriodEnd(subscription);

  await admin.from("organization_billing").upsert(
    {
      organization_id: organizationId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      subscription_status: status,
      current_period_end: stripeTimestampToIso(currentPeriodEnd),
      cancel_at_period_end: subscription.cancel_at_period_end,
      trial_end: stripeTimestampToIso(subscription.trial_end),
      // Only overwrite billing_email when Stripe has one, so we never wipe it.
      ...(billingEmail ? { billing_email: billingEmail } : {}),
    },
    { onConflict: "organization_id" }
  );

  // Permanently record the organization's ONE free-trial redemption the first
  // time a subscription with a trial appears. `.is("trial_redeemed_at", null)`
  // guarantees this is set at most once and is never cleared afterward — so
  // canceling/deleting/replacing a subscription can never restore eligibility.
  const usedTrial = subscription.status === "trialing" || subscription.trial_end != null;
  if (usedTrial) {
    await admin
      .from("organization_billing")
      .update({
        trial_redeemed_at: new Date().toISOString(),
        trial_redeemed_subscription_id: subscription.id,
      })
      .eq("organization_id", organizationId)
      .is("trial_redeemed_at", null);
  }

  return { organizationId, status };
}

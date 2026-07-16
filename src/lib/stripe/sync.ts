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
export async function resolveOrgIdForSubscription(
  admin: SupabaseClient,
  subscription: Stripe.Subscription
): Promise<string | null> {
  const customerId = customerIdOf(subscription);

  const { data } = await admin
    .from("organization_billing")
    .select("organization_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (data?.organization_id) return data.organization_id as string;

  const metaOrg = subscription.metadata?.organization_id;
  if (metaOrg) return metaOrg;

  const stripe = getStripe();
  const customer = await stripe.customers.retrieve(customerId);
  if (!customer.deleted && customer.metadata?.organization_id) {
    return customer.metadata.organization_id;
  }
  return null;
}

/**
 * Idempotently synchronize a Stripe subscription's ABSOLUTE state onto the
 * organization's billing row. Because the whole state is overwritten (never
 * incremented), replaying the same webhook event cannot corrupt billing state.
 * Returns the organization id it synchronized, or null when it could not be
 * resolved.
 */
export async function syncSubscriptionToOrg(
  admin: SupabaseClient,
  subscription: Stripe.Subscription
): Promise<{ organizationId: string; status: SubscriptionStatus } | null> {
  const organizationId = await resolveOrgIdForSubscription(admin, subscription);
  if (!organizationId) return null;

  const status = normalizeStatus(subscription.status);
  const priceId = subscription.items.data[0]?.price.id ?? null;

  await admin
    .from("organization_billing")
    .update({
      stripe_customer_id: customerIdOf(subscription),
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      subscription_status: status,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    })
    .eq("organization_id", organizationId);

  return { organizationId, status };
}

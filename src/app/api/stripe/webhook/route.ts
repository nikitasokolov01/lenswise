import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { getStripeWebhookSecret } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncSubscriptionToOrg, provisionOrgFromCheckoutSession } from "@/lib/stripe/sync";
import { writeBillingAudit, type BillingAuditAction } from "@/lib/billing/audit";

// The Stripe SDK requires the Node.js runtime (crypto + raw body).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook endpoint (App Router). The RAW request body is read and the
 * signature verified BEFORE any parsing — the body is never modified first. All
 * synchronization writes the ABSOLUTE subscription state, so replaying an event
 * cannot corrupt billing state (idempotent by construction). Failures are
 * logged without secrets, and HTTP status codes tell Stripe whether to retry.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());
  } catch (err) {
    // Do NOT log the signature or the raw payload.
    console.error("[stripe] webhook signature verification failed:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          // Public onboarding: create the organization from the session metadata
          // FIRST (idempotent), so the subscription sync below can resolve it.
          // No-op for existing organizations resubscribing.
          await provisionOrgFromCheckoutSession(admin, session);
          const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subId);
          await syncAndAudit(admin, subscription, "billing.subscription_activated");
        }
        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncAndAudit(admin, subscription, "billing.subscription_activated");
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.trial_will_end": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncAndAudit(admin, subscription, "billing.subscription_updated");
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncAndAudit(admin, subscription, "billing.subscription_canceled");
        break;
      }

      case "invoice.paid": {
        // Do not invent state from the invoice — confirm from the subscription.
        const subscription = await subscriptionForInvoice(stripe, event.data.object as Stripe.Invoice);
        if (subscription) await syncAndAudit(admin, subscription, "billing.subscription_updated");
        break;
      }

      case "invoice.payment_failed": {
        const subscription = await subscriptionForInvoice(stripe, event.data.object as Stripe.Invoice);
        if (subscription) await syncAndAudit(admin, subscription, "billing.payment_failed");
        break;
      }

      default:
        // Unhandled event types are acknowledged so Stripe does not retry.
        break;
    }
  } catch (err) {
    // Return 500 so Stripe retries transient failures. No secrets are logged.
    console.error(`[stripe] error handling ${event.type}:`, err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

async function subscriptionForInvoice(
  stripe: Stripe,
  invoice: Stripe.Invoice
): Promise<Stripe.Subscription | null> {
  const sub = invoice.subscription;
  if (!sub) return null;
  const subId = typeof sub === "string" ? sub : sub.id;
  return stripe.subscriptions.retrieve(subId);
}

async function syncAndAudit(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  subscription: Stripe.Subscription,
  action: BillingAuditAction
): Promise<void> {
  const result = await syncSubscriptionToOrg(admin, subscription);
  if (!result) {
    console.error("[stripe] could not resolve organization for subscription", subscription.id);
    return;
  }
  await writeBillingAudit(admin, {
    organizationId: result.organizationId,
    actorId: null,
    action,
    targetType: "stripe_subscription",
    targetId: subscription.id,
    metadata: { status: result.status },
  });
}

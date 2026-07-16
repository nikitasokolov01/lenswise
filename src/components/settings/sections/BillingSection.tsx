import { Badge } from "@/components/ui/badge";
import { BillingActions } from "@/components/billing/BillingActions";
import {
  billingAccess,
  isOnTrial,
  isTrialEligible,
  trialDaysRemaining,
  type OrgBilling,
  type SubscriptionStatus,
} from "@/lib/billing/status";

/**
 * Settings → Billing. Stripe remains the single source of truth for the trial,
 * status, and renewal. Reachable even when the subscription is inactive so the
 * organization can reactivate (the Settings guard does not enforce the billing
 * block). Stripe behavior is unchanged from the standalone Billing page.
 */

const PLAN_NAME = "LensWise Professional";

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  unpaid: "Unpaid",
  incomplete: "Incomplete",
  incomplete_expired: "Expired",
};

function statusVariant(status: SubscriptionStatus | null): "default" | "teal" | "warning" {
  if (status === "active" || status === "trialing") return "teal";
  if (status === "past_due") return "warning";
  return "default";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export function BillingSection({ billing, checkout }: { billing: OrgBilling | null; checkout: string | null }) {
  const status: SubscriptionStatus | null = billing?.status ?? null;
  const access = billingAccess(billing);
  const neverSubscribed = status === null;

  const hasLiveSubscription = status === "trialing" || status === "active" || status === "past_due";
  const canStart = !hasLiveSubscription;
  const canManage = Boolean(billing?.stripeCustomerId);

  const trialing = isOnTrial(billing);
  const trialDays = trialDaysRemaining(billing?.trialEnd);
  const statusText = status ? STATUS_LABEL[status] : "No subscription";

  // The free trial is redeemable once per organization. After it's been used,
  // the CTA becomes "Start Subscription" (a normal paid subscription, no trial).
  const trialEligible = isTrialEligible(billing);
  const startLabel = trialEligible ? "Start Free Trial" : "Start Subscription";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-navy-900">Billing</h2>
        <p className="mt-1 text-sm text-navy-500">
          Your LensWise subscription and free trial are managed securely by Stripe — payments, invoices, renewals, and
          cancellation.
        </p>
      </div>

      {checkout === "success" ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          Thanks! Your checkout completed. Your subscription may take a few moments to update here.
        </div>
      ) : null}
      {checkout === "canceled" ? (
        <div className="rounded-md border border-navy-200 bg-navy-50 px-4 py-3 text-sm text-navy-700">
          Checkout was canceled. No changes were made.
        </div>
      ) : null}

      {neverSubscribed && trialEligible ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          Start your 14-day free trial to activate LensWise. You won&apos;t be charged today, and you can cancel anytime
          during the trial.
        </div>
      ) : access === "blocked" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {trialEligible
            ? "Your LensWise subscription is inactive. Renew your subscription to continue using LensWise."
            : "Your LensWise subscription is inactive, and your organization's free trial has already been used. Start a subscription to continue using LensWise."}
        </div>
      ) : null}
      {status === "past_due" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your latest LensWise payment could not be completed. Update your billing information to avoid interruption.
        </div>
      ) : null}

      <section className="rounded-lg border border-navy-100 bg-white p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-navy-900">{PLAN_NAME}</h3>
          <Badge variant={statusVariant(status)}>{statusText}</Badge>
        </div>

        <dl className="mt-4 space-y-2 border-t border-navy-100 pt-4 text-sm">
          <Row label="Plan" value={PLAN_NAME} />
          <Row label="Subscription status" value={statusText} />

          {trialing ? (
            <>
              <Row label="Trial ends" value={formatDate(billing?.trialEnd ?? null)} />
              <Row
                label="Trial days remaining"
                value={trialDays === null ? "—" : trialDays === 1 ? "1 day" : `${trialDays} days`}
              />
            </>
          ) : null}

          {!neverSubscribed ? (
            <>
              <Row
                label={billing?.cancelAtPeriodEnd ? "Access ends" : "Renews on"}
                value={formatDate(billing?.currentPeriodEnd ?? null)}
              />
              <Row
                label="Scheduled to cancel"
                value={billing?.cancelAtPeriodEnd ? "Yes — ends at period end" : "No"}
              />
            </>
          ) : null}

          <Row label="Billing email" value={billing?.billingEmail ?? "—"} />
        </dl>

        <div className="mt-5 border-t border-navy-100 pt-5">
          <BillingActions canStart={canStart} startLabel={startLabel} canManage={canManage} />
          {!canManage && !canStart ? (
            <p className="text-sm text-navy-500">No billing actions are available right now.</p>
          ) : null}
        </div>
      </section>

      <p className="text-xs text-navy-400">
        Payment methods, invoice history, cancellation, and resumption are managed in the secure Stripe Customer Portal.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-navy-500">{label}</dt>
      <dd className="text-right text-navy-800">{value}</dd>
    </div>
  );
}

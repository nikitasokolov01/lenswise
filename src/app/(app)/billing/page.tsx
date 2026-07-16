import { requireBillingManagement } from "@/lib/auth/guards";
import { Badge } from "@/components/ui/badge";
import { BillingActions } from "@/components/billing/BillingActions";
import {
  billingAccess,
  isOnTrial,
  trialDaysRemaining,
  type SubscriptionStatus,
} from "@/lib/billing/status";

export const metadata = { title: "Billing — LensWise" };

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

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: { checkout?: string };
}) {
  const ctx = await requireBillingManagement();
  const billing = ctx.billing;
  const status = billing?.status ?? "trialing";
  const access = billingAccess(billing);

  const hasLiveSubscription =
    Boolean(billing?.stripeSubscriptionId) &&
    (status === "active" || status === "past_due" || status === "trialing");
  const canStart = !hasLiveSubscription;
  const startLabel = isOnTrial(billing) ? `Upgrade to ${PLAN_NAME}` : "Start Subscription";
  const canManage = Boolean(billing?.stripeCustomerId);

  const trialDays = trialDaysRemaining(billing?.trialEnd);
  const checkout = searchParams?.checkout;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Billing</h1>
        <p className="mt-1 text-sm text-navy-500">
          Manage your LensWise subscription. Payments, invoices, and cancellation are handled securely by Stripe.
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

      {access === "blocked" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your LensWise subscription is inactive. Renew your subscription to continue using LensWise.
        </div>
      ) : null}
      {status === "past_due" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your latest LensWise payment could not be completed. Update your billing information to avoid interruption.
        </div>
      ) : null}

      <section className="rounded-lg border border-navy-100 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-900">{PLAN_NAME}</h2>
          <Badge variant={statusVariant(billing?.status ?? null)}>{STATUS_LABEL[status]}</Badge>
        </div>

        <dl className="mt-4 space-y-2 border-t border-navy-100 pt-4 text-sm">
          <Row label="Plan" value={PLAN_NAME} />
          <Row label="Subscription status" value={STATUS_LABEL[status]} />
          {isOnTrial(billing) ? (
            <>
              <Row label="Trial ends" value={formatDate(billing?.trialEnd ?? null)} />
              <Row
                label="Trial days remaining"
                value={trialDays === null ? "—" : trialDays === 1 ? "1 day" : `${trialDays} days`}
              />
            </>
          ) : null}
          <Row
            label={billing?.cancelAtPeriodEnd ? "Access ends" : "Renews on"}
            value={formatDate(billing?.currentPeriodEnd ?? null)}
          />
          <Row
            label="Scheduled to cancel"
            value={billing?.cancelAtPeriodEnd ? "Yes — ends at period end" : "No"}
          />
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

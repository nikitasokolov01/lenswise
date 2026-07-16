/**
 * Pure billing status + access helpers. No secrets, no Stripe SDK — safe to
 * import from both server and client components. The real access enforcement
 * lives in the server-side guards; this module is the single source of truth
 * for how a Stripe subscription status maps to LensWise access.
 */

/** The Stripe subscription statuses LensWise stores verbatim. */
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired";

export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
];

export function isSubscriptionStatus(value: string | null | undefined): value is SubscriptionStatus {
  return !!value && (SUBSCRIPTION_STATUSES as string[]).includes(value);
}

/** Normalize any Stripe status string (incl. 'paused') to a stored status. */
export function normalizeStatus(value: string | null | undefined): SubscriptionStatus {
  if (isSubscriptionStatus(value)) return value;
  // Unknown/unsupported statuses (e.g. 'paused') are treated as blocking.
  return "canceled";
}

/** Snapshot of an organization's billing record (dates as ISO strings). */
export interface OrgBilling {
  status: SubscriptionStatus | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
  billingEmail: string | null;
}

/** full = normal access, warn = access + banner, blocked = no app access. */
export type BillingAccess = "full" | "warn" | "blocked";

/**
 * Access decision from a billing record:
 *  - trialing / active → full
 *  - past_due          → warn (access with a warning banner)
 *  - canceled / unpaid / incomplete / incomplete_expired → blocked
 * A missing record is treated as trialing (grace) — registration always
 * provisions one, and the migration backfills legacy organizations.
 */
export function billingAccess(billing: OrgBilling | null | undefined): BillingAccess {
  const status = billing?.status ?? "trialing";
  if (status === "trialing" || status === "active") return "full";
  if (status === "past_due") return "warn";
  return "blocked";
}

export function isBillingBlocked(billing: OrgBilling | null | undefined): boolean {
  return billingAccess(billing) === "blocked";
}

/** Whole days remaining until the trial ends (0 if past, null if no trial). */
export function trialDaysRemaining(trialEnd: string | null | undefined): number | null {
  if (!trialEnd) return null;
  const end = new Date(trialEnd).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
}

export function isOnTrial(billing: OrgBilling | null | undefined): boolean {
  return (billing?.status ?? "trialing") === "trialing";
}

/** Whether a live (paid) subscription exists that the Customer Portal can manage. */
export function hasManageableSubscription(billing: OrgBilling | null | undefined): boolean {
  return Boolean(billing?.stripeCustomerId);
}

export interface BillingBannerData {
  kind: "trial" | "past_due" | "cancel";
  message: string;
}

/**
 * The single banner to display for the current billing state, or null.
 * Priority: past_due → cancel-at-period-end → trial.
 */
export function billingBanner(billing: OrgBilling | null | undefined): BillingBannerData | null {
  if (!billing) return null;
  const status = billing.status ?? "trialing";

  if (status === "past_due") {
    return {
      kind: "past_due",
      message:
        "Your latest LensWise payment could not be completed. Update your billing information to avoid interruption.",
    };
  }

  if (billing.cancelAtPeriodEnd && billing.currentPeriodEnd) {
    const date = new Date(billing.currentPeriodEnd);
    if (!Number.isNaN(date.getTime())) {
      return {
        kind: "cancel",
        message: `Your LensWise subscription is scheduled to end on ${date.toLocaleDateString()}.`,
      };
    }
  }

  if (status === "trialing") {
    const days = trialDaysRemaining(billing.trialEnd);
    if (days !== null) {
      const label = days === 1 ? "1 day" : `${days} days`;
      return { kind: "trial", message: `Your LensWise trial ends in ${label}.` };
    }
  }

  return null;
}

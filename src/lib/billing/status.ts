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
  /**
   * When the organization redeemed its ONE lifetime free trial (or null if it
   * never has). Set once by the webhook and never cleared — canceling/deleting
   * a subscription does not restore trial eligibility.
   */
  trialRedeemedAt: string | null;
  /**
   * Platform Admin complimentary-access override. When true, the organization
   * has permanent LensWise access regardless of Stripe status. Set only by
   * trusted Platform Super Admin server actions; never by Stripe or the browser.
   */
  lifetimeComplimentary: boolean;
  lifetimeComplimentaryGrantedAt: string | null;
}

/** Whether the organization has the Platform Admin complimentary-access override. */
export function isComplimentary(billing: OrgBilling | null | undefined): boolean {
  return Boolean(billing?.lifetimeComplimentary);
}

/** Whether the organization has already used its one lifetime free trial. */
export function hasRedeemedTrial(billing: OrgBilling | null | undefined): boolean {
  return Boolean(billing?.trialRedeemedAt);
}

/** Whether the organization is still eligible to start its one free trial. */
export function isTrialEligible(billing: OrgBilling | null | undefined): boolean {
  return !hasRedeemedTrial(billing);
}

/** full = normal access, warn = access + banner, blocked = no app access. */
export type BillingAccess = "full" | "warn" | "blocked";

/**
 * Access decision. Checked in priority order:
 *  1. Platform Admin complimentary override → always full (works even when the
 *     Stripe status is null, canceled, unpaid, incomplete, or expired).
 *  2. Stripe status: trialing / active → full; past_due → warn; everything else
 *     (NULL, canceled, unpaid, incomplete, incomplete_expired) → blocked.
 * The organization-disabled override (Platform Admin) is enforced separately in
 * the server guards (requireActiveOrg) and always wins over this — a disabled
 * organization is blocked regardless of complimentary access.
 */
export function billingAccess(billing: OrgBilling | null | undefined): BillingAccess {
  if (billing?.lifetimeComplimentary) return "full";
  const status = billing?.status ?? null;
  if (status === "trialing" || status === "active") return "full";
  if (status === "past_due") return "warn";
  return "blocked";
}

export function isBillingBlocked(billing: OrgBilling | null | undefined): boolean {
  return billingAccess(billing) === "blocked";
}

/**
 * Whole days remaining until the trial ends, computed from Stripe's `trial_end`
 * timestamp only (0 if past, null when there is no Stripe trial). This is a
 * pure display of Stripe's value — LensWise never invents a trial date.
 */
export function trialDaysRemaining(trialEnd: string | null | undefined): number | null {
  if (!trialEnd) return null;
  const end = new Date(trialEnd).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
}

/** True only when Stripe reports the subscription is in its trial. */
export function isOnTrial(billing: OrgBilling | null | undefined): boolean {
  return billing?.status === "trialing";
}

export interface BillingBannerData {
  kind: "trial" | "past_due" | "cancel" | "info";
  message: string;
}

/**
 * The single banner to display for the current billing state, or null.
 * Complimentary organizations never see trial/past-due/cancel WARNING banners
 * (only a calm informational note); otherwise priority is
 * past_due → cancel-at-period-end → trial.
 */
export function billingBanner(billing: OrgBilling | null | undefined): BillingBannerData | null {
  if (!billing) return null;

  // Complimentary access suppresses all payment/trial warnings.
  if (billing.lifetimeComplimentary) {
    return { kind: "info", message: "This organization has lifetime complimentary LensWise access." };
  }

  const status = billing.status;

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

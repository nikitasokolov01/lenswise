import { describe, expect, it } from "vitest";
import { hasRedeemedTrial, isTrialEligible, type OrgBilling } from "@/lib/billing/status";

function billing(overrides: Partial<OrgBilling>): OrgBilling {
  return {
    status: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    trialEnd: null,
    billingEmail: null,
    trialRedeemedAt: null,
    ...overrides,
  };
}

describe("one free trial per organization", () => {
  it("a brand-new organization is eligible for the trial", () => {
    expect(isTrialEligible(billing({}))).toBe(true);
    expect(hasRedeemedTrial(billing({}))).toBe(false);
  });

  it("a missing billing record is treated as eligible (fresh org)", () => {
    expect(isTrialEligible(null)).toBe(true);
    expect(hasRedeemedTrial(undefined)).toBe(false);
  });

  it("once the trial is redeemed, the org is no longer eligible", () => {
    const redeemed = billing({ trialRedeemedAt: "2026-01-01T00:00:00.000Z" });
    expect(hasRedeemedTrial(redeemed)).toBe(true);
    expect(isTrialEligible(redeemed)).toBe(false);
  });

  it("canceling a subscription does not restore eligibility (marker persists)", () => {
    // Simulate an org that trialed, then canceled: status is canceled but the
    // permanent redemption marker remains set.
    const canceledAfterTrial = billing({ status: "canceled", trialRedeemedAt: "2026-01-01T00:00:00.000Z" });
    expect(isTrialEligible(canceledAfterTrial)).toBe(false);
  });
});

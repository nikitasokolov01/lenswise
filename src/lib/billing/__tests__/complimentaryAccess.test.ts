import { describe, expect, it } from "vitest";
import {
  billingAccess,
  billingBanner,
  isComplimentary,
  isTrialEligible,
  type OrgBilling,
  type SubscriptionStatus,
} from "@/lib/billing/status";

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
    lifetimeComplimentary: false,
    lifetimeComplimentaryGrantedAt: null,
    ...overrides,
  };
}

describe("complimentary access — default & storage", () => {
  it("defaults to false for a normal billing record", () => {
    expect(isComplimentary(billing({}))).toBe(false);
    expect(isComplimentary(null)).toBe(false);
  });
});

describe("complimentary access — billing access priority", () => {
  it("grants full access even with a null Stripe status", () => {
    expect(billingAccess(billing({ lifetimeComplimentary: true, status: null }))).toBe("full");
  });

  it("grants full access even with canceled / unpaid / incomplete_expired Stripe status", () => {
    const blockedStatuses: SubscriptionStatus[] = ["canceled", "unpaid", "incomplete", "incomplete_expired"];
    for (const status of blockedStatuses) {
      expect(billingAccess(billing({ lifetimeComplimentary: true, status }))).toBe("full");
    }
  });

  it("grants full access even when past_due (no warn state while complimentary)", () => {
    expect(billingAccess(billing({ lifetimeComplimentary: true, status: "past_due" }))).toBe("full");
  });

  it("a normal (non-complimentary) organization still follows Stripe status", () => {
    expect(billingAccess(billing({ status: "active" }))).toBe("full");
    expect(billingAccess(billing({ status: "trialing" }))).toBe("full");
    expect(billingAccess(billing({ status: "past_due" }))).toBe("warn");
    expect(billingAccess(billing({ status: "canceled" }))).toBe("blocked");
    expect(billingAccess(billing({ status: null }))).toBe("blocked");
  });

  it("revoking complimentary access immediately restores normal Stripe rules", () => {
    const granted = billing({ lifetimeComplimentary: true, status: "canceled" });
    expect(billingAccess(granted)).toBe("full");
    // After revoke, lifetimeComplimentary=false — a canceled org is blocked again.
    const revoked = billing({ lifetimeComplimentary: false, status: "canceled" });
    expect(billingAccess(revoked)).toBe("blocked");
  });
});

describe("complimentary access — banners", () => {
  it("shows a calm informational banner and no payment/trial warnings", () => {
    const banner = billingBanner(billing({ lifetimeComplimentary: true, status: "past_due" }));
    expect(banner).toEqual({
      kind: "info",
      message: "This organization has lifetime complimentary LensWise access.",
    });
  });

  it("a non-complimentary past_due org still shows the warning banner", () => {
    const banner = billingBanner(billing({ status: "past_due" }));
    expect(banner?.kind).toBe("past_due");
  });
});

describe("complimentary access — trial history untouched", () => {
  it("does not change one-time trial eligibility", () => {
    // Already redeemed a trial: complimentary does not reset it.
    const redeemedAndComplimentary = billing({
      lifetimeComplimentary: true,
      trialRedeemedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(isTrialEligible(redeemedAndComplimentary)).toBe(false);

    // Never redeemed: complimentary does not consume the trial either.
    const freshAndComplimentary = billing({ lifetimeComplimentary: true, trialRedeemedAt: null });
    expect(isTrialEligible(freshAndComplimentary)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { buildOnboardingMetadata } from "@/lib/stripe/onboardingMetadata";
import { LENSWISE_PLAN } from "@/lib/marketing/plan";

describe("onboarding checkout metadata", () => {
  it("carries the organization + owner details the webhook needs to create the org", () => {
    const metadata = buildOnboardingMetadata({
      userId: "user-123",
      email: "owner@practice.com",
      practiceName: "Downtown Optical",
      ownerName: "Dr. Rivera",
    });
    expect(metadata).toEqual({
      owner_user_id: "user-123",
      organization_name: "Downtown Optical",
      owner_name: "Dr. Rivera",
      owner_email: "owner@practice.com",
    });
    // The webhook resolves the owner from owner_user_id and names the org from
    // organization_name — both must be present.
    expect(metadata.owner_user_id).toBe("user-123");
    expect(metadata.organization_name).toBe("Downtown Optical");
  });
});

describe("marketing plan config (single source)", () => {
  it("exposes the plan name, price, and feature list for the landing page", () => {
    expect(LENSWISE_PLAN.name).toBe("Professional");
    expect(LENSWISE_PLAN.price).toBe("$49");
    expect(LENSWISE_PLAN.period).toBe("/month");
    expect(LENSWISE_PLAN.features).toContain("Free Trial");
    expect(LENSWISE_PLAN.features).toContain("Office PIN");
  });
});

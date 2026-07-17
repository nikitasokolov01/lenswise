import { describe, expect, it } from "vitest";
import {
  canAccess,
  canEditPricing,
  canImportLocalPricing,
  isPublicPath,
  shouldOfferLocalImport,
} from "@/lib/auth/permissions";

describe("permissions", () => {
  it("Staff cannot update pricing; Owners and Admins can", () => {
    expect(canEditPricing("staff")).toBe(false);
    expect(canEditPricing("admin")).toBe(true);
    expect(canEditPricing("owner")).toBe(true);
    expect(canEditPricing(null)).toBe(false);
  });

  it("Platform Admin and platform-only areas require Super Admin — normal users are rejected", () => {
    const staff = { role: "staff" as const, isSuperAdmin: false };
    const owner = { role: "owner" as const, isSuperAdmin: false };
    const superAdmin = { role: null, isSuperAdmin: true };

    expect(canAccess("platform_admin", staff)).toBe(false);
    expect(canAccess("platform_admin", owner)).toBe(false); // even an org Owner is not a Super Admin
    expect(canAccess("platform_admin", superAdmin)).toBe(true);
    expect(canAccess("registration_keys", owner)).toBe(false);
    expect(canAccess("organization_status", owner)).toBe(false);
    expect(canAccess("organization_status", superAdmin)).toBe(true);
  });

  it("org-scoped areas require Owner/Admin", () => {
    const staff = { role: "staff" as const, isSuperAdmin: false };
    const admin = { role: "admin" as const, isSuperAdmin: false };
    expect(canAccess("admin_pricing", staff)).toBe(false);
    expect(canAccess("admin_pricing", admin)).toBe(true);
    expect(canAccess("pricing_update", staff)).toBe(false);
    expect(canAccess("billing", staff)).toBe(false);
    expect(canAccess("billing", admin)).toBe(true);
    expect(canAccess("organization_settings", admin)).toBe(true);
  });

  it("public paths cover the landing + onboarding surfaces; the app stays protected", () => {
    // Public marketing + onboarding:
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/start-trial")).toBe(true);
    expect(isPublicPath("/checkout-success")).toBe(true);
    expect(isPublicPath("/checkout-cancel")).toBe(true);
    expect(isPublicPath("/privacy")).toBe(true);
    expect(isPublicPath("/terms")).toBe(true);
    expect(isPublicPath("/forgot-password")).toBe(true);
    expect(isPublicPath("/reset-password")).toBe(true);
    // /register stays public for internal key-based manual onboarding.
    expect(isPublicPath("/register")).toBe(true);
    // Protected app routes:
    expect(isPublicPath("/app")).toBe(false);
    expect(isPublicPath("/settings")).toBe(false);
    expect(isPublicPath("/admin")).toBe(false);
    expect(isPublicPath("/platform-admin")).toBe(false);
    // "/" must not make every path public.
    expect(isPublicPath("/app/anything")).toBe(false);
  });

  it("only Owners/Admins may import local pricing", () => {
    expect(canImportLocalPricing("owner")).toBe(true);
    expect(canImportLocalPricing("admin")).toBe(true);
    expect(canImportLocalPricing("staff")).toBe(false);
  });

  it("the local import prompt never overwrites existing server pricing and never nags after a decision", () => {
    // Offered: owner/admin, no server config, local config present, no prior decision.
    expect(
      shouldOfferLocalImport({ role: "admin", hasServerConfig: false, hasLocalConfig: true, decisionAlreadyMade: false })
    ).toBe(true);
    // Server pricing already exists → never offered (never overwrite).
    expect(
      shouldOfferLocalImport({ role: "owner", hasServerConfig: true, hasLocalConfig: true, decisionAlreadyMade: false })
    ).toBe(false);
    // Decision already made → not shown again.
    expect(
      shouldOfferLocalImport({ role: "owner", hasServerConfig: false, hasLocalConfig: true, decisionAlreadyMade: true })
    ).toBe(false);
    // Staff may never import.
    expect(
      shouldOfferLocalImport({ role: "staff", hasServerConfig: false, hasLocalConfig: true, decisionAlreadyMade: false })
    ).toBe(false);
    // No local config → nothing to offer.
    expect(
      shouldOfferLocalImport({ role: "owner", hasServerConfig: false, hasLocalConfig: false, decisionAlreadyMade: false })
    ).toBe(false);
  });
});

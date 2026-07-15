import { describe, expect, it } from "vitest";
import {
  canAccess,
  canAssignRole,
  canEditPricing,
  canImportLocalPricing,
  canManageTeam,
  invitableRoles,
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

  it("Owners can manage Admin roles; Admins cannot promote to Admin, Owner, or (ever) Super Admin", () => {
    // Owner may create/promote admins and transfer ownership.
    expect(canAssignRole("owner", "admin")).toBe(true);
    expect(canAssignRole("owner", "owner")).toBe(true);
    expect(canAssignRole("owner", "staff")).toBe(true);
    // Admin may only manage staff — never create admins or owners.
    expect(canAssignRole("admin", "staff")).toBe(true);
    expect(canAssignRole("admin", "admin")).toBe(false);
    expect(canAssignRole("admin", "owner")).toBe(false);
    // Staff cannot assign anything.
    expect(canAssignRole("staff", "staff")).toBe(false);
  });

  it("invitable roles never include owner or super admin", () => {
    expect(invitableRoles("owner")).toEqual(["admin", "staff"]);
    expect(invitableRoles("admin")).toEqual(["staff"]);
    expect(invitableRoles("staff")).toEqual([]);
    // There is no way to express "owner" or a platform role as an invite.
    expect(invitableRoles("owner")).not.toContain("owner");
  });

  it("only Owners/Admins manage the team", () => {
    expect(canManageTeam("owner")).toBe(true);
    expect(canManageTeam("admin")).toBe(true);
    expect(canManageTeam("staff")).toBe(false);
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
    expect(canAccess("team", staff)).toBe(false);
    expect(canAccess("team", admin)).toBe(true);
    expect(canAccess("organization_settings", admin)).toBe(true);
  });

  it("public paths are limited to the auth pages; everything else is protected", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/register")).toBe(true);
    expect(isPublicPath("/forgot-password")).toBe(true);
    expect(isPublicPath("/reset-password")).toBe(true);
    expect(isPublicPath("/accept-invite")).toBe(true);
    expect(isPublicPath("/accept-invite/anything")).toBe(true);
    // Protected:
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/admin")).toBe(false);
    expect(isPublicPath("/team")).toBe(false);
    expect(isPublicPath("/platform-admin")).toBe(false);
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

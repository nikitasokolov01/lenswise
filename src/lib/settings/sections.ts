import { isOwnerOrAdmin, type OrgRole } from "@/lib/auth/permissions";

/**
 * The organization-management sections that live inside the single Settings
 * area. Pure metadata + role rules — no data access — so both the server page
 * and the client nav agree on what is visible.
 */
export type SettingsSection =
  | "organization"
  | "pricing"
  | "customer-display"
  | "security"
  | "billing";

export const SETTINGS_SECTIONS: SettingsSection[] = [
  "organization",
  "pricing",
  "customer-display",
  "security",
  "billing",
];

export const SECTION_LABEL: Record<SettingsSection, string> = {
  organization: "Organization",
  pricing: "Pricing",
  "customer-display": "Customer Display",
  security: "Security",
  billing: "Billing",
};

export const DEFAULT_SECTION: SettingsSection = "organization";

export function isSettingsSection(value: string | null | undefined): value is SettingsSection {
  return !!value && (SETTINGS_SECTIONS as string[]).includes(value);
}

/**
 * Sections protected by the Office PIN. Billing is intentionally EXEMPT so an
 * owner can always reach Settings → Billing (even with the subscription
 * inactive, the trial ended, payment past due, or the PIN forgotten/unset)
 * without unlocking — no redirect loop.
 */
export function isProtectedSection(section: SettingsSection): boolean {
  return section !== "billing";
}

/** Only Owner/Admin may enter Settings at all; Staff never can (even with the PIN). */
export function canAccessSettings(role: OrgRole | null): boolean {
  return isOwnerOrAdmin(role);
}

/** Only the Owner may create/change/reset the Settings PIN. */
export function canManageSettingsPin(role: OrgRole | null): boolean {
  return role === "owner";
}

/**
 * Per-section role access. Owner/Admin share every management section except
 * Security (PIN management), which is Owner-only. Staff have no access.
 */
export function canAccessSection(role: OrgRole | null, section: SettingsSection): boolean {
  if (!isOwnerOrAdmin(role)) return false;
  if (section === "security") return canManageSettingsPin(role);
  return true;
}

/** The sections a role should see as tabs, in display order. */
export function visibleSections(role: OrgRole | null): SettingsSection[] {
  return SETTINGS_SECTIONS.filter((s) => canAccessSection(role, s));
}

/**
 * Legacy organization-facing routes now redirect into the Settings area. Maps
 * an old path to its Settings section (used by the redirect stubs and tests).
 */
export const LEGACY_ROUTE_SECTION: Record<string, SettingsSection> = {
  "/admin": "pricing",
  "/admin-pricing": "pricing",
  "/organization": "organization",
  "/billing": "billing",
};

export function sectionForLegacyRoute(path: string): SettingsSection | null {
  return LEGACY_ROUTE_SECTION[path] ?? null;
}

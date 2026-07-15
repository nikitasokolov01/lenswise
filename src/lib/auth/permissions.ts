/**
 * Single source of truth for authorization. These are PURE functions used by
 * both server-side guards (the real enforcement) and UI gating (hiding
 * controls). Hiding a control is never sufficient — every mutation is also
 * checked server-side and by Postgres RLS — but keeping the rules here means
 * the UI and server never disagree.
 */

export type OrgRole = "owner" | "admin" | "staff";

/** Every route/feature that requires more than "signed-in member of an active org". */
export type ProtectedArea =
  | "admin_pricing"
  | "team"
  | "organization_settings"
  | "platform_admin"
  | "registration_keys"
  | "organization_status"
  | "pricing_update"
  | "invitation_create"
  | "role_change";

export interface Actor {
  role: OrgRole | null; // null when the user has no membership in the active org
  isSuperAdmin: boolean;
}

const OWNER_ADMIN: OrgRole[] = ["owner", "admin"];

export function isOwnerOrAdmin(role: OrgRole | null): boolean {
  return role === "owner" || role === "admin";
}

/** Staff may read pricing; only Owner/Admin may edit/save it. */
export function canEditPricing(role: OrgRole | null): boolean {
  return isOwnerOrAdmin(role);
}

export function canEditOrganizationSettings(role: OrgRole | null): boolean {
  return isOwnerOrAdmin(role);
}

export function canManageTeam(role: OrgRole | null): boolean {
  return isOwnerOrAdmin(role);
}

/** Owner may invite/promote Admins; Admin may only invite/manage Staff. */
export function canAssignRole(actorRole: OrgRole | null, targetRole: OrgRole): boolean {
  if (targetRole === "owner") return actorRole === "owner"; // ownership transfer only, by an owner
  if (targetRole === "admin") return actorRole === "owner"; // only owners create/promote admins
  if (targetRole === "staff") return isOwnerOrAdmin(actorRole);
  return false;
}

/** Roles that may be chosen when inviting a new employee. Never owner, never super admin. */
export function invitableRoles(actorRole: OrgRole | null): OrgRole[] {
  if (actorRole === "owner") return ["admin", "staff"];
  if (actorRole === "admin") return ["staff"];
  return [];
}

export function canImportLocalPricing(role: OrgRole | null): boolean {
  return isOwnerOrAdmin(role);
}

/** Server-side authorization decision for a protected area. */
export function canAccess(area: ProtectedArea, actor: Actor): boolean {
  switch (area) {
    case "platform_admin":
    case "registration_keys":
    case "organization_status":
      return actor.isSuperAdmin;
    case "admin_pricing":
    case "pricing_update":
    case "organization_settings":
      return canEditPricing(actor.role) || actor.isSuperAdmin;
    case "team":
    case "invitation_create":
    case "role_change":
      return canManageTeam(actor.role) || actor.isSuperAdmin;
    default:
      return false;
  }
}

/** Paths reachable without authentication. Everything else requires a session. */
export const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/accept-invite",
] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Whether the one-time LocalStorage import prompt should be offered. */
export function shouldOfferLocalImport(params: {
  role: OrgRole | null;
  hasServerConfig: boolean;
  hasLocalConfig: boolean;
  decisionAlreadyMade: boolean;
}): boolean {
  const { role, hasServerConfig, hasLocalConfig, decisionAlreadyMade } = params;
  if (decisionAlreadyMade) return false;
  if (hasServerConfig) return false; // never overwrite/second-guess existing server pricing
  if (!hasLocalConfig) return false;
  return canImportLocalPricing(role);
}

export { OWNER_ADMIN };

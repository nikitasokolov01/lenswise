import { redirect } from "next/navigation";
import { getAuthContext, type AuthContext } from "@/lib/auth/context";
import { canAccess, type ProtectedArea } from "@/lib/auth/permissions";
import { isBillingBlocked } from "@/lib/billing/status";

type ActiveOrgContext = AuthContext & { organization: NonNullable<AuthContext["organization"]> };

/** Server-side: require a signed-in user. Redirects to /login otherwise. */
export async function requireAuthContext(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  return ctx;
}

/**
 * Require a signed-in user who belongs to an ACTIVE organization. A valid
 * session never bypasses the disabled-org block. Super admins without an org
 * are sent to the platform console.
 */
export async function requireActiveOrg(): Promise<ActiveOrgContext> {
  const ctx = await requireAuthContext();
  if (!ctx.organization) {
    if (ctx.isSuperAdmin) redirect("/platform-admin");
    redirect("/no-organization");
  }
  if (ctx.organization.status === "disabled") {
    redirect("/organization-disabled");
  }
  return ctx as ActiveOrgContext;
}

/**
 * Require an active organization whose subscription/trial is not blocked. Used
 * by the normal application pages. A blocked organization (canceled / unpaid /
 * incomplete_expired / incomplete) is redirected to /subscription-inactive,
 * which itself does NOT enforce billing (so there is no redirect loop). The
 * disabled-org block still takes precedence via requireActiveOrg.
 */
export async function requireBilledOrg(): Promise<ActiveOrgContext> {
  const ctx = await requireActiveOrg();
  if (isBillingBlocked(ctx.billing)) {
    redirect("/subscription-inactive");
  }
  return ctx;
}

/**
 * Require authorization for a protected, org-scoped area (server-enforced).
 * Enforces billing access first, so app areas are blocked when the
 * subscription is inactive.
 */
export async function requireArea(area: ProtectedArea): Promise<ActiveOrgContext> {
  const ctx = await requireBilledOrg();
  if (!canAccess(area, { role: ctx.role, isSuperAdmin: ctx.isSuperAdmin })) {
    redirect("/");
  }
  return ctx;
}

/**
 * Require billing-management access (Owner/Admin of an active org). This does
 * NOT enforce the billing-blocked check, so Owners/Admins can always reach the
 * Billing page and billing actions to reactivate an inactive subscription.
 */
export async function requireBillingManagement(): Promise<ActiveOrgContext> {
  const ctx = await requireActiveOrg();
  if (!canAccess("billing", { role: ctx.role, isSuperAdmin: ctx.isSuperAdmin })) {
    redirect("/");
  }
  return ctx;
}

/** Require platform Super Admin (no organization needed). */
export async function requireSuperAdmin(): Promise<AuthContext> {
  const ctx = await requireAuthContext();
  if (!ctx.isSuperAdmin) redirect("/");
  return ctx;
}

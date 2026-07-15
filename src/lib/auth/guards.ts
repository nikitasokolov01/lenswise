import { redirect } from "next/navigation";
import { getAuthContext, type AuthContext } from "@/lib/auth/context";
import { canAccess, type ProtectedArea } from "@/lib/auth/permissions";

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
export async function requireActiveOrg(): Promise<AuthContext & { organization: NonNullable<AuthContext["organization"]> }> {
  const ctx = await requireAuthContext();
  if (!ctx.organization) {
    if (ctx.isSuperAdmin) redirect("/platform-admin");
    redirect("/no-organization");
  }
  if (ctx.organization.status === "disabled") {
    redirect("/organization-disabled");
  }
  return ctx as AuthContext & { organization: NonNullable<AuthContext["organization"]> };
}

/** Require authorization for a protected, org-scoped area (server-enforced). */
export async function requireArea(area: ProtectedArea): Promise<AuthContext> {
  const ctx = await requireActiveOrg();
  if (!canAccess(area, { role: ctx.role, isSuperAdmin: ctx.isSuperAdmin })) {
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

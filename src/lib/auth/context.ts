import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSuperAdminEmail } from "@/lib/env";
import type { OrgRole } from "@/lib/auth/permissions";
import { normalizeStatus, type OrgBilling } from "@/lib/billing/status";

export type ThemePreference = "light" | "dark" | "system";

export interface AuthContext {
  user: { id: string; email: string };
  fullName: string | null;
  organization: { id: string; name: string; status: "active" | "disabled" } | null;
  role: OrgRole | null;
  isSuperAdmin: boolean;
  themePreference: ThemePreference;
  /** The organization's Stripe billing snapshot (null when the user has no org). */
  billing: OrgBilling | null;
}

/**
 * Loads the trusted, server-verified context for the current request: the
 * user, their profile, their organization + role, and platform Super Admin
 * status. Every value comes from Supabase (governed by RLS) — role and
 * organization are NEVER trusted from the browser. Memoized per request.
 *
 * Also performs the one-time Super Admin bootstrap: if the signed-in user's
 * email matches LENSWISE_SUPER_ADMIN_EMAIL and they are not yet a super admin,
 * they are promoted via the service role (the only path that can set the flag).
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, is_super_admin, theme_preference")
    .eq("id", user.id)
    .maybeSingle();

  const rawTheme = (profile?.theme_preference as string | null) ?? "system";
  const themePreference: ThemePreference =
    rawTheme === "light" || rawTheme === "dark" ? rawTheme : "system";

  let isSuperAdmin = Boolean(profile?.is_super_admin);
  const superEmail = getSuperAdminEmail();
  if (!isSuperAdmin && superEmail && user.email && user.email.toLowerCase() === superEmail.toLowerCase()) {
    try {
      const admin = createSupabaseAdminClient();
      await admin.rpc("promote_super_admin", { p_email: user.email });
      isSuperAdmin = true;
    } catch {
      /* bootstrap is best-effort; a later request will retry. */
    }
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role, organizations(id, name, status)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  type MembershipRow = {
    role: OrgRole;
    organizations: { id: string; name: string; status: "active" | "disabled" } | null;
  };
  const membershipRow = (membership as unknown as MembershipRow | null) ?? null;
  const orgRow = membershipRow?.organizations ?? null;
  const organization = orgRow ? { id: orgRow.id, name: orgRow.name, status: orgRow.status } : null;

  let billing: OrgBilling | null = null;
  if (organization) {
    const { data: billingRow } = await supabase
      .from("organization_billing")
      .select(
        "subscription_status, stripe_customer_id, stripe_subscription_id, stripe_price_id, current_period_end, cancel_at_period_end, trial_end, billing_email"
      )
      .eq("organization_id", organization.id)
      .maybeSingle();

    if (billingRow) {
      const row = billingRow as {
        subscription_status: string | null;
        stripe_customer_id: string | null;
        stripe_subscription_id: string | null;
        stripe_price_id: string | null;
        current_period_end: string | null;
        cancel_at_period_end: boolean | null;
        trial_end: string | null;
        billing_email: string | null;
      };
      billing = {
        status: row.subscription_status ? normalizeStatus(row.subscription_status) : null,
        stripeCustomerId: row.stripe_customer_id,
        stripeSubscriptionId: row.stripe_subscription_id,
        stripePriceId: row.stripe_price_id,
        currentPeriodEnd: row.current_period_end,
        cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
        trialEnd: row.trial_end,
        billingEmail: row.billing_email,
      };
    }
  }

  return {
    user: { id: user.id, email: user.email ?? "" },
    fullName: (profile?.full_name as string | null) ?? null,
    organization,
    role: membershipRow?.role ?? null,
    isSuperAdmin,
    themePreference,
    billing,
  };
});

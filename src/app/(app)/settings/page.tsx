import { requireSettingsAccess } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { organizationHasPin } from "@/lib/settings/security";
import { isSettingsUnlocked } from "@/lib/settings/session";
import {
  canAccessSection,
  canManageSettingsPin,
  isProtectedSection,
  isSettingsSection,
  DEFAULT_SECTION,
  type SettingsSection,
} from "@/lib/settings/sections";
import { AdminEditor } from "@/components/admin/AdminEditor";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { SettingsPinGate } from "@/components/settings/SettingsPinGate";
import { LockButton } from "@/components/settings/LockButton";
import { SecuritySection } from "@/components/settings/SecuritySection";
import { OrganizationSection } from "@/components/settings/sections/OrganizationSection";
import { CustomerDisplaySection } from "@/components/settings/sections/CustomerDisplaySection";
import { BillingSection } from "@/components/settings/sections/BillingSection";

export const metadata = { title: "Settings — LensWise" };

/**
 * The single organization-management area. Access requires the authenticated
 * Owner/Admin account (enforced by requireSettingsAccess + RLS). Sensitive
 * sections (Organization, Pricing, Customer Display, Security) are additionally
 * protected by the Office PIN — a second factor for shared devices that never
 * elevates a role.
 *
 * Billing is deliberately EXEMPT from the Office PIN so an owner can always
 * reach Settings → Billing to manage the subscription — even when it is
 * inactive, the trial has ended, payment is past due, or the PIN is
 * forgotten/unconfigured. There is no redirect loop.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: { section?: string; checkout?: string };
}) {
  const ctx = await requireSettingsAccess();
  const admin = createSupabaseAdminClient();

  const hasPin = await organizationHasPin(admin, ctx.organization.id);
  const unlocked = isSettingsUnlocked(ctx.organization.id, ctx.user.id);

  const rawSection = searchParams?.section;
  const requested = isSettingsSection(rawSection) ? rawSection : DEFAULT_SECTION;
  const section: SettingsSection = canAccessSection(ctx.role, requested) ? requested : DEFAULT_SECTION;

  const locked = isProtectedSection(section) && !unlocked;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Settings</h1>
          <p className="mt-1 text-sm text-navy-500">Organization settings for {ctx.organization.name}.</p>
        </div>
        {unlocked ? <LockButton /> : null}
      </div>

      <SettingsNav role={ctx.role} active={section} locked={!unlocked} />

      <div className="mt-6">
        {/* Billing is always available — never gated by the Office PIN. */}
        {section === "billing" ? (
          <BillingSection billing={ctx.billing} checkout={searchParams?.checkout ?? null} />
        ) : locked ? (
          <SettingsPinGate hasPin={hasPin} canManagePin={canManageSettingsPin(ctx.role)} />
        ) : (
          <>
            {section === "pricing" ? <AdminEditor /> : null}
            {section === "organization" ? (
              <OrganizationSection orgId={ctx.organization.id} orgName={ctx.organization.name} role={ctx.role} />
            ) : null}
            {section === "customer-display" ? (
              <CustomerDisplaySection orgId={ctx.organization.id} userId={ctx.user.id} />
            ) : null}
            {section === "security" ? <SecuritySection canManagePin={canManageSettingsPin(ctx.role)} /> : null}
          </>
        )}
      </div>
    </div>
  );
}

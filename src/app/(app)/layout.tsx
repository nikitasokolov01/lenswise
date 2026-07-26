import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requireAuthContext } from "@/lib/auth/guards";
import { getOrganizationLocationContext } from "@/lib/locations/context";
import { AppShell } from "@/components/shell/AppShell";
import { CURRENT_CHANGELOG_RELEASE_ID } from "@/lib/changelog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Authenticated application shell. Enforced server-side (never client
 * redirects): unauthenticated users never reach here (middleware + this guard),
 * and a disabled organization is blocked entirely — a valid session cannot
 * bypass it.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireAuthContext();

  if (ctx.organization?.status === "disabled") {
    redirect("/organization-disabled");
  }

  const locationContext = ctx.organization
    ? await getOrganizationLocationContext(ctx.organization.id)
    : { locations: [], activeLocation: null };
  const supabase = createSupabaseServerClient();
  const { data: changelogRead, error: changelogError } = await supabase
    .from("user_changelog_reads")
    .select("release_id")
    .eq("user_id", ctx.user.id)
    .eq("release_id", CURRENT_CHANGELOG_RELEASE_ID)
    .maybeSingle();

  return (
    <AppShell
      context={{
        userId: ctx.user.id,
        email: ctx.user.email,
        fullName: ctx.fullName,
        organizationId: ctx.organization?.id ?? null,
        organizationName: ctx.organization?.name ?? null,
        locations: locationContext.locations,
        activeLocation: locationContext.activeLocation,
        role: ctx.role,
        isSuperAdmin: ctx.isSuperAdmin,
        themePreference: ctx.themePreference,
        billing: ctx.billing,
        showBillingBanner: true,
        showWhatsNew: !changelogError && !changelogRead,
      }}
    >
      {children}
    </AppShell>
  );
}

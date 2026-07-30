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

  const supabase = createSupabaseServerClient();
  const [locationContext, changelogResult, framePhotoResult] = await Promise.all([
    ctx.organization
      ? getOrganizationLocationContext(ctx.organization.id)
      : Promise.resolve({ locations: [], activeLocation: null }),
    supabase
      .from("user_changelog_reads")
      .select("release_id")
      .eq("user_id", ctx.user.id)
      .eq("release_id", CURRENT_CHANGELOG_RELEASE_ID)
      .maybeSingle(),
    ctx.organization
      ? supabase
          .from("organization_settings")
          .select("frame_photos_enabled")
          .eq("organization_id", ctx.organization.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

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
        showWhatsNew: !changelogResult.error && !changelogResult.data,
        framePhotosEnabled: framePhotoResult.data?.frame_photos_enabled === true,
      }}
    >
      {children}
    </AppShell>
  );
}

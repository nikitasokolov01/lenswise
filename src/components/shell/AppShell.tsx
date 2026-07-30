"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { Boxes, Glasses } from "lucide-react";
import { cn } from "@/lib/utils";
import { PricingRepositoryProvider } from "@/lib/pricing/repositoryContext";
import { AccountMenu } from "@/components/shell/AccountMenu";
import { ThemeAccountSync, type Theme } from "@/components/theme/ThemeProvider";
import { BillingBanner } from "@/components/billing/BillingBanner";
import { WhatsNewDialog } from "@/components/shell/WhatsNewDialog";
import { isOwnerOrAdmin, type OrgRole } from "@/lib/auth/permissions";
import { billingBanner, type OrgBilling } from "@/lib/billing/status";
import { FramePhotoVisibilityProvider } from "@/lib/catalog/framePhotoVisibilityContext";
import type { OrganizationLocation } from "@/lib/locations/types";
import styles from "./AppShell.module.css";

export interface ShellContext {
  userId: string;
  email: string;
  fullName: string | null;
  organizationId: string | null;
  organizationName: string | null;
  locations: OrganizationLocation[];
  activeLocation: OrganizationLocation | null;
  role: OrgRole | null;
  isSuperAdmin: boolean;
  themePreference: Theme;
  /** Billing snapshot for the nav Billing link + banner (null for no-org users). */
  billing: OrgBilling | null;
  /** Suppressed inside Platform Admin so Super Admin sees no billing banner. */
  showBillingBanner: boolean;
  showWhatsNew: boolean;
  /** Organization-level licensed frame-photo display preference. */
  framePhotosEnabled: boolean;
}

/**
 * Authenticated LensWise shell: a slim top bar (brand + role-aware nav +
 * account menu) that preserves the existing visual language — not a generic
 * SaaS dashboard. Wraps children in the org-scoped pricing repository provider
 * so the Quote Builder and Admin Pricing read/write the org's Supabase config.
 */
export function AppShell({ context, children }: { context: ShellContext; children: ReactNode }) {
  const pathname = usePathname();
  const ownerOrAdmin = isOwnerOrAdmin(context.role);

  const links: { href: string; label: string; icon: typeof Glasses; show: boolean }[] = [
    { href: "/app", label: "Quote Builder", icon: Glasses, show: Boolean(context.organizationId) },
    { href: "/inventory", label: "Frame Inventory", icon: Boxes, show: Boolean(context.organizationId) },
  ];

  const banner = context.showBillingBanner ? billingBanner(context.billing) : null;

  const shellContents = (
    <div className="min-h-screen">
      <ThemeAccountSync accountTheme={context.themePreference} />
      <WhatsNewDialog initiallyOpen={context.showWhatsNew} />
      {banner ? <BillingBanner banner={banner} canManage={ownerOrAdmin} /> : null}
      <nav className="no-print sticky top-0 z-40 border-b border-navy-100 bg-paper pt-safe-top">
        <div
          className={cn(
            styles.shellRow,
            "mx-auto flex min-h-[72px] max-w-[1400px] items-center gap-2 px-4 sm:px-6 lg:px-8"
          )}
        >
          <Link href="/app" className="mr-1 flex shrink-0 items-center gap-2.5" aria-label="LensWise quote builder">
            <span className="flex h-9 w-9 -rotate-3 items-center justify-center rounded-xl bg-navy-900 text-white shadow-soft">
              <Glasses className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="hidden text-base font-extrabold tracking-[-0.04em] text-navy-900 sm:inline">
              LensWise
            </span>
          </Link>

          <div className={cn(styles.desktopNav, "items-center gap-1 overflow-x-auto py-2")}>
            {links
              .filter((l) => l.show)
              .map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-[42px] shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-colors",
                      active
                        ? "bg-navy-900 text-white shadow-soft"
                        : "text-navy-500 hover:bg-white hover:text-navy-900"
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span className="whitespace-nowrap">{label}</span>
                  </Link>
                );
              })}
          </div>

          <div className={styles.accountMenu}>
            <AccountMenu
              fullName={context.fullName}
              email={context.email}
              organizationName={context.organizationName}
              locations={context.locations}
              activeLocationId={context.activeLocation?.id ?? null}
              role={context.role}
              isSuperAdmin={context.isSuperAdmin}
            />
          </div>

          <div className={styles.mobilePrimaryNav} aria-label="Primary navigation">
            {links
              .filter((link) => link.show && (link.href === "/app" || link.href === "/inventory"))
              .map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-[44px] min-w-0 items-center justify-center gap-2 rounded-full px-2 text-xs font-bold transition-colors",
                      active
                        ? "bg-navy-900 text-white shadow-soft"
                        : "border border-navy-100 bg-white text-navy-700"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{label}</span>
                  </Link>
                );
              })}
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
  const shell = (
    <FramePhotoVisibilityProvider enabled={context.framePhotosEnabled}>
      {shellContents}
    </FramePhotoVisibilityProvider>
  );

  if (context.organizationId) {
    return (
      <PricingRepositoryProvider organizationId={context.organizationId} userId={context.userId}>
        {shell}
      </PricingRepositoryProvider>
    );
  }
  return shell;
}

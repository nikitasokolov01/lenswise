"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { Glasses, Settings, Users, Building2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { PricingRepositoryProvider } from "@/lib/pricing/repositoryContext";
import { AccountMenu } from "@/components/shell/AccountMenu";
import { isOwnerOrAdmin, type OrgRole } from "@/lib/auth/permissions";

export interface ShellContext {
  userId: string;
  email: string;
  fullName: string | null;
  organizationId: string | null;
  organizationName: string | null;
  role: OrgRole | null;
  isSuperAdmin: boolean;
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
    { href: "/", label: "Quote Builder", icon: Glasses, show: Boolean(context.organizationId) },
    { href: "/admin", label: "Admin Pricing", icon: Settings, show: ownerOrAdmin },
    { href: "/team", label: "Team", icon: Users, show: ownerOrAdmin },
    { href: "/organization", label: "Organization", icon: Building2, show: ownerOrAdmin },
    { href: "/platform-admin", label: "Platform Admin", icon: ShieldCheck, show: context.isSuperAdmin },
  ];

  const shell = (
    <div className="min-h-screen">
      <nav className="no-print sticky top-0 z-40 border-b border-navy-100 bg-white pt-safe-top">
        <div className="mx-auto flex max-w-6xl items-center gap-1 px-4 sm:px-6 lg:px-8">
          <span className="mr-2 flex items-baseline gap-1.5 py-3">
            <span className="text-sm font-bold tracking-tight text-navy-900">LensWise</span>
            <span className="hidden text-xs text-navy-400 sm:inline">Optical Quote Builder</span>
          </span>

          <div className="flex flex-1 items-center gap-1 overflow-x-auto">
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
                      "flex min-h-[44px] shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors",
                      active
                        ? "border-teal-600 text-navy-900"
                        : "border-transparent text-navy-500 hover:text-navy-800"
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span className="whitespace-nowrap">{label}</span>
                  </Link>
                );
              })}
          </div>

          <AccountMenu
            fullName={context.fullName}
            email={context.email}
            organizationName={context.organizationName}
            role={context.role}
            isSuperAdmin={context.isSuperAdmin}
          />
        </div>
      </nav>
      {children}
    </div>
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

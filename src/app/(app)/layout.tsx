import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requireAuthContext } from "@/lib/auth/guards";
import { AppShell } from "@/components/shell/AppShell";

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

  return (
    <AppShell
      context={{
        userId: ctx.user.id,
        email: ctx.user.email,
        fullName: ctx.fullName,
        organizationId: ctx.organization?.id ?? null,
        organizationName: ctx.organization?.name ?? null,
        role: ctx.role,
        isSuperAdmin: ctx.isSuperAdmin,
        themePreference: ctx.themePreference,
      }}
    >
      {children}
    </AppShell>
  );
}

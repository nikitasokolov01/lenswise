import type { ReactNode } from "react";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { AppShell } from "@/components/shell/AppShell";

export default async function PlatformAdminLayout({ children }: { children: ReactNode }) {
  const ctx = await requireSuperAdmin();
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

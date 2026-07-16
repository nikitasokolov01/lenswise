import Link from "next/link";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { SECTION_LABEL, isProtectedSection, visibleSections, type SettingsSection } from "@/lib/settings/sections";
import type { OrgRole } from "@/lib/auth/permissions";

/**
 * Section selector for the Settings area. A single row of large, wrapping tabs
 * (touch-friendly for iPad) that navigate via ?section=. When Settings is
 * locked, protected sections show a lock indicator; Billing never does (it is
 * always accessible). Selecting a locked protected section opens the Office PIN
 * screen in the content area.
 */
export function SettingsNav({
  role,
  active,
  locked,
}: {
  role: OrgRole | null;
  active: SettingsSection;
  locked: boolean;
}) {
  const sections = visibleSections(role);
  return (
    <nav className="no-print -mx-1 flex flex-wrap gap-1 border-b border-navy-100" aria-label="Settings sections">
      {sections.map((section) => {
        const isActive = section === active;
        const showLock = locked && isProtectedSection(section);
        return (
          <Link
            key={section}
            href={`/settings?section=${section}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-[44px] items-center gap-1.5 rounded-t-md border-b-2 px-3 text-sm font-medium transition-colors sm:px-4",
              isActive
                ? "border-teal-600 text-navy-900"
                : "border-transparent text-navy-500 hover:bg-navy-50 hover:text-navy-800"
            )}
          >
            {SECTION_LABEL[section]}
            {showLock ? <Lock className="h-3.5 w-3.5 text-navy-400" aria-label="Locked" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

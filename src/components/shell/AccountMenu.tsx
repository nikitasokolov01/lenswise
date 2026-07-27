"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  User,
  ReceiptText,
  Settings,
  ShieldCheck,
  LogOut,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { signOutAction } from "@/app/(auth)/actions";
import { updateThemePreferenceAction } from "@/app/(app)/account/actions";
import { LocationSwitcher } from "@/components/shell/LocationSwitcher";
import { useTheme, type Theme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils";
import type { OrgRole } from "@/lib/auth/permissions";
import type { OrganizationLocation } from "@/lib/locations/types";

const ROLE_LABEL: Record<OrgRole, string> = { owner: "Owner", admin: "Admin", staff: "Staff" };

/** Account dropdown: identity + role, quick links, and logout (server action). */
export function AccountMenu({
  fullName,
  email,
  organizationName,
  locations,
  activeLocationId,
  role,
  isSuperAdmin,
}: {
  fullName: string | null;
  email: string;
  organizationName: string | null;
  locations: OrganizationLocation[];
  activeLocationId: string | null;
  role: OrgRole | null;
  isSuperAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const initials = (fullName || email || "?").trim().charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative ml-auto shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex min-h-[44px] items-center gap-2 rounded-full px-1.5 py-1 text-sm text-navy-700 hover:bg-white"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white shadow-soft">
          {initials}
        </span>
        <ChevronDown className="h-4 w-4 text-navy-400" aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-lifted"
        >
          <div className="border-b border-navy-100 px-4 py-3">
            <p className="truncate text-sm font-medium text-navy-900">{fullName || "—"}</p>
            <p className="truncate text-xs text-navy-500">{email}</p>
            <p className="mt-1 truncate text-xs text-navy-500">
              {organizationName ? organizationName : "No organization"}
              {role ? <span className="text-navy-400"> · {ROLE_LABEL[role]}</span> : null}
              {isSuperAdmin ? <span className="ml-1 rounded bg-navy-900 px-1 text-[10px] text-white">SUPER ADMIN</span> : null}
            </p>
          </div>

          {activeLocationId ? (
            <div role="none" className="border-b border-navy-100 p-3">
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-navy-400">
                Active location
              </p>
              <LocationSwitcher
                locations={locations}
                activeLocationId={activeLocationId}
                variant="menu"
              />
            </div>
          ) : null}

          <ThemeToggle />

          <MenuLink href="/account" icon={User} label="Account Settings" />
          {activeLocationId ? <MenuLink href="/sales" icon={ReceiptText} label="Sales" /> : null}
          {role === "owner" || role === "admin" ? (
            <MenuLink href="/settings" icon={Settings} label="Settings" />
          ) : null}
          {isSuperAdmin ? <MenuLink href="/platform-admin" icon={ShieldCheck} label="Platform Admin" /> : null}

          <form action={signOutAction} className="border-t border-navy-100">
            <button
              type="submit"
              role="menuitem"
              className="flex min-h-[44px] w-full items-center gap-2 px-4 text-left text-sm text-navy-700 hover:bg-navy-50"
            >
              <LogOut className="h-4 w-4 text-navy-400" aria-hidden="true" />
              Log out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Light / Dark / System segmented control. Applies immediately and saves to
 *  the account (localStorage is mirrored by the provider). */
function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  function choose(next: Theme) {
    setTheme(next);
    // Persist to the account; best-effort, local choice already applied.
    void updateThemePreferenceAction(next).catch(() => {});
  }

  return (
    <div className="border-b border-navy-100 px-4 py-3">
      <p className="mb-1.5 text-xs font-medium text-navy-500">Appearance</p>
      <div
        role="radiogroup"
        aria-label="Theme"
        className="flex rounded-xl border border-navy-200 bg-navy-50 p-1"
      >
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(value)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "bg-teal-600 text-white"
                  : "text-navy-600 hover:bg-navy-50"
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MenuLink({ href, icon: Icon, label }: { href: string; icon: typeof User; label: string }) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex min-h-[44px] items-center gap-2 px-4 text-sm text-navy-700 hover:bg-navy-50"
    >
      <Icon className="h-4 w-4 text-navy-400" aria-hidden="true" />
      {label}
    </Link>
  );
}

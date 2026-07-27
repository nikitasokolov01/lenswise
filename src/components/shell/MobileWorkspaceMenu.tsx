"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Menu,
  ReceiptText,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { LocationSwitcher } from "@/components/shell/LocationSwitcher";
import { cn } from "@/lib/utils";
import type { OrganizationLocation } from "@/lib/locations/types";

export function MobileWorkspaceMenu({
  locations,
  activeLocationId,
  showSales,
  showSettings,
  showPlatformAdmin,
}: {
  locations: OrganizationLocation[];
  activeLocationId: string | null;
  showSales: boolean;
  showSettings: boolean;
  showPlatformAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-navy-100 bg-white px-3 text-sm font-bold text-navy-700 shadow-soft"
      >
        <Menu className="h-4 w-4" aria-hidden="true" />
        More
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Workspace navigation"
          className="absolute right-[-5rem] z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-lifted"
        >
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

          {showSales ? (
            <WorkspaceLink
              href="/sales"
              label="Sales"
              icon={ReceiptText}
              active={pathname === "/sales"}
              onNavigate={() => setOpen(false)}
            />
          ) : null}
          {showSettings ? (
            <WorkspaceLink
              href="/settings"
              label="Settings"
              icon={Settings}
              active={pathname === "/settings"}
              onNavigate={() => setOpen(false)}
            />
          ) : null}
          {showPlatformAdmin ? (
            <WorkspaceLink
              href="/platform-admin"
              label="Platform Admin"
              icon={ShieldCheck}
              active={pathname === "/platform-admin"}
              onNavigate={() => setOpen(false)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function WorkspaceLink({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: typeof ReceiptText;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "flex min-h-[48px] items-center gap-3 px-4 text-sm font-semibold transition-colors",
        active ? "bg-navy-900 text-white" : "text-navy-700 hover:bg-navy-50"
      )}
    >
      <Icon
        className={cn("h-4 w-4", active ? "text-white" : "text-navy-400")}
        aria-hidden="true"
      />
      {label}
    </Link>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Glasses, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Quote Builder", icon: Glasses },
  { href: "/admin", label: "Admin Pricing", icon: Settings },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="no-print sticky top-0 z-40 border-b border-navy-100 bg-white pt-safe-top">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-4 sm:px-6 lg:px-8">
        <span className="mr-2 flex items-baseline gap-1.5 py-3">
          <span className="text-sm font-bold tracking-tight text-navy-900">LensWise</span>
          <span className="hidden text-xs text-navy-400 sm:inline">Optical Quote Builder</span>
        </span>
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[44px] items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors",
                active
                  ? "border-teal-600 text-navy-900"
                  : "border-transparent text-navy-500 hover:text-navy-800"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

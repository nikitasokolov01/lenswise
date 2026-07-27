"use client";

import { usePathname } from "next/navigation";
import { MapPin } from "lucide-react";
import { setActiveLocationAction } from "@/app/(app)/locations/actions";
import { cn } from "@/lib/utils";
import type { OrganizationLocation } from "@/lib/locations/types";

export function LocationSwitcher({
  locations,
  activeLocationId,
  variant = "nav",
}: {
  locations: OrganizationLocation[];
  activeLocationId: string;
  variant?: "nav" | "menu";
}) {
  const pathname = usePathname();

  return (
    <form
      action={setActiveLocationAction}
      className={cn("relative shrink-0", variant === "menu" && "w-full")}
      aria-label="Choose active location"
    >
      <input type="hidden" name="returnTo" value={pathname} />
      <MapPin
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-teal-700"
        aria-hidden="true"
      />
      <select
        name="locationId"
        value={activeLocationId}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className={cn(
          "h-10 appearance-none truncate rounded-full border border-teal-200 bg-teal-50 py-1 pl-8 pr-7 text-xs font-bold text-navy-900 outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-100",
          variant === "menu"
            ? "w-full max-w-none"
            : "max-w-[140px] sm:max-w-[210px]"
        )}
        aria-label="Active location"
      >
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </select>
      <span
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-navy-400"
        aria-hidden="true"
      >
        ⌄
      </span>
    </form>
  );
}

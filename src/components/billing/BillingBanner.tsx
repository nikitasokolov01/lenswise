"use client";

import Link from "next/link";
import { AlertTriangle, Clock, CalendarClock } from "lucide-react";
import type { BillingBannerData } from "@/lib/billing/status";

/**
 * Slim, non-print billing banner shown in the app shell for trial countdown,
 * past-due payment, and scheduled cancellation. Owners/Admins get a link to the
 * Billing page. Never rendered inside Platform Admin (see AppShell).
 */
export function BillingBanner({
  banner,
  canManage,
}: {
  banner: BillingBannerData;
  canManage: boolean;
}) {
  const amber = banner.kind !== "trial";
  const Icon = banner.kind === "past_due" ? AlertTriangle : banner.kind === "cancel" ? CalendarClock : Clock;

  return (
    <div
      role="status"
      className={
        "no-print flex items-center gap-2 px-4 py-2 text-sm sm:px-6 lg:px-8 " +
        (amber
          ? "border-b border-amber-200 bg-amber-50 text-amber-900"
          : "border-b border-teal-200 bg-teal-50 text-teal-900")
      }
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{banner.message}</span>
      {canManage ? (
        <Link href="/billing" className="shrink-0 font-medium underline underline-offset-2 hover:opacity-80">
          Manage billing
        </Link>
      ) : null}
    </div>
  );
}

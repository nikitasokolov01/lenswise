"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createCheckoutSessionAction, createPortalSessionAction } from "@/app/(app)/billing/actions";

/**
 * Billing action buttons. These never process payments in-app — they redirect
 * to Stripe-hosted Checkout / Customer Portal. Which buttons appear is decided
 * server-side from the current subscription status.
 */
export function BillingActions({
  canStart,
  startLabel,
  canManage,
  layout = "row",
}: {
  canStart: boolean;
  startLabel: string;
  canManage: boolean;
  layout?: "row" | "column";
}) {
  const [busy, setBusy] = useState<null | "checkout" | "portal">(null);
  const [error, setError] = useState<string | null>(null);

  async function go(kind: "checkout" | "portal") {
    setError(null);
    setBusy(kind);
    const result = kind === "checkout" ? await createCheckoutSessionAction() : await createPortalSessionAction();
    if (result.url) {
      window.location.href = result.url;
      return;
    }
    setError(result.error ?? "Something went wrong. Please try again.");
    setBusy(null);
  }

  return (
    <div className="space-y-2">
      <div className={layout === "column" ? "flex flex-col gap-2" : "flex flex-wrap gap-2"}>
        {canStart ? (
          <Button
            type="button"
            variant="accent"
            onClick={() => go("checkout")}
            disabled={busy !== null}
            className={layout === "column" ? "w-full" : undefined}
          >
            {busy === "checkout" ? "Redirecting…" : startLabel}
          </Button>
        ) : null}
        {canManage ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => go("portal")}
            disabled={busy !== null}
            className={layout === "column" ? "w-full" : undefined}
          >
            {busy === "portal" ? "Opening…" : "Manage Billing"}
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

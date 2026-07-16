import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/auth/guards";
import { signOutAction } from "@/app/(auth)/actions";
import { isOwnerOrAdmin } from "@/lib/auth/permissions";
import { isBillingBlocked } from "@/lib/billing/status";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Subscription inactive — LensWise" };

/**
 * Shown when a signed-in user's organization has an inactive subscription
 * (canceled / unpaid / incomplete_expired / incomplete). Reachable regardless
 * of billing status so there is no redirect loop; if the subscription is
 * actually fine, we send the user back into the app. Owners/Admins get a button
 * to manage billing; Staff see only the status message.
 */
export default async function SubscriptionInactivePage() {
  const ctx = await requireActiveOrg();
  if (!isBillingBlocked(ctx.billing)) redirect("/");

  const canManage = isOwnerOrAdmin(ctx.role);

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-md rounded-xl border border-amber-200 bg-white p-8 text-center shadow-sm">
        <p className="text-lg font-semibold text-navy-900">Your LensWise subscription is inactive.</p>
        <p className="mt-2 text-sm text-navy-600">
          Renew your subscription to continue using LensWise.
        </p>

        <div className="mt-6 space-y-3">
          {canManage ? (
            <Link href="/settings?section=billing" className="block">
              <Button variant="accent" className="w-full">
                Manage billing
              </Button>
            </Link>
          ) : (
            <p className="text-xs text-navy-500">
              Please contact an owner or admin at your office to renew the subscription.
            </p>
          )}

          <form action={signOutAction}>
            <Button type="submit" variant="secondary" className="w-full">
              Log out
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

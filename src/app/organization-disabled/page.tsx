import { requireAuthContext } from "@/lib/auth/guards";
import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Organization disabled — LensWise" };

/**
 * Shown when a signed-in user's organization is disabled. A valid session does
 * NOT grant access — the (app) layout redirects here and RLS blocks the org's
 * pricing regardless.
 */
export default async function OrganizationDisabledPage() {
  await requireAuthContext();
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-md rounded-xl border border-amber-200 bg-white p-8 text-center shadow-sm">
        <p className="text-lg font-semibold text-navy-900">Organization disabled</p>
        <p className="mt-2 text-sm text-navy-600">
          This LensWise organization is currently disabled. Contact LensWise support.
        </p>
        <form action={signOutAction} className="mt-6">
          <Button type="submit" variant="secondary" className="w-full">
            Log out
          </Button>
        </form>
      </div>
    </div>
  );
}

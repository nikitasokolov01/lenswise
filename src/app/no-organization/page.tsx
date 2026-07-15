import { requireAuthContext } from "@/lib/auth/guards";
import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export const metadata = { title: "No organization — LensWise" };

/**
 * Shown for a signed-in user who is not a member of any organization (e.g. an
 * account created but not yet attached to an org). They must register an org
 * (with a key) or accept an invitation.
 */
export default async function NoOrganizationPage() {
  await requireAuthContext();
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-md rounded-xl border border-navy-100 bg-white p-8 text-center shadow-sm">
        <p className="text-lg font-semibold text-navy-900">No organization yet</p>
        <p className="mt-2 text-sm text-navy-600">
          Your account isn&apos;t part of a LensWise organization. Register an office with a registration key, or ask an
          organization owner/admin to invite you.
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

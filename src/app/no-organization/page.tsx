import { requireAuthContext } from "@/lib/auth/guards";
import { signOutAction, resumeCheckoutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Finish setting up — LensWise" };

/**
 * Shown for a signed-in user who has no organization yet — typically an owner
 * who started onboarding but closed Stripe Checkout before completing it. They
 * can resume Checkout to finish setting up (which starts their trial and creates
 * their organization via the webhook).
 */
export default async function NoOrganizationPage() {
  await requireAuthContext();
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-md rounded-xl border border-navy-100 bg-white p-8 text-center shadow-sm">
        <p className="text-lg font-semibold text-navy-900">Finish setting up LensWise</p>
        <p className="mt-2 text-sm text-navy-600">
          Your account is ready, but your organization isn&apos;t set up yet. Resume checkout to start your free trial
          and finish creating your practice.
        </p>
        <div className="mt-6 space-y-3">
          <form action={resumeCheckoutAction}>
            <Button type="submit" variant="accent" className="w-full">
              Resume checkout
            </Button>
          </form>
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

import Link from "next/link";
import { resumeCheckoutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Checkout canceled — LensWise" };

/**
 * Shown when Checkout is canceled. No organization was created and no trial was
 * redeemed. A signed-in owner can resume Checkout; anyone can return home.
 */
export default function CheckoutCancelPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-md rounded-xl border border-navy-100 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-navy-900">Your free trial hasn&apos;t started yet</h1>
        <p className="mt-2 text-sm text-navy-600">
          You closed checkout before it completed, so nothing was set up. You can pick up right where you left off.
        </p>
        <div className="mt-6 space-y-3">
          <form action={resumeCheckoutAction}>
            <Button type="submit" variant="accent" className="w-full">
              Resume Checkout
            </Button>
          </form>
          <Link href="/" className="block">
            <Button variant="secondary" className="w-full">
              Return Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

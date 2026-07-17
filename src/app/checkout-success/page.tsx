import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Welcome to LensWise" };

/**
 * Shown after a successful Checkout. The organization is provisioned by the
 * Stripe webhook (the source of truth); this page never exposes Stripe session
 * ids and simply welcomes the owner into the app.
 */
export default function CheckoutSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-md rounded-xl border border-navy-100 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-teal-700">
          <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="text-xl font-bold text-navy-900">Welcome to LensWise.</h1>
        <p className="mt-2 text-sm text-navy-600">Your free trial is active.</p>
        <Link href="/app" className="mt-6 block">
          <Button variant="accent" className="w-full">
            Continue to LensWise
          </Button>
        </Link>
      </div>
    </div>
  );
}

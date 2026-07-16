import { redirect } from "next/navigation";

/** Billing has moved into the unified Settings area. */
export default function BillingRedirectPage() {
  redirect("/settings?section=billing");
}

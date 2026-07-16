import { redirect } from "next/navigation";

/** Admin Pricing has moved into the unified Settings area. */
export default function AdminRedirectPage() {
  redirect("/settings?section=pricing");
}

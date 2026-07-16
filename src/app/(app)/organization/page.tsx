import { redirect } from "next/navigation";

/** Organization Settings has moved into the unified Settings area. */
export default function OrganizationRedirectPage() {
  redirect("/settings?section=organization");
}

import { redirect } from "next/navigation";

/**
 * Team has been removed. LensWise now uses a single shared-office owner account,
 * so this legacy route redirects to Settings.
 */
export default function TeamRedirectPage() {
  redirect("/settings");
}

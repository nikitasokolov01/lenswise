import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Invitations unavailable — LensWise" };

/**
 * Team invitations have been removed. LensWise now uses a single shared-office
 * owner account per organization, so invitation links are no longer supported.
 * Existing accounts are unaffected; this page simply informs anyone who follows
 * an old invitation link.
 */
export default function AcceptInvitePage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-navy-900">Invitations are no longer supported</h1>
      <p className="mb-5 text-sm text-navy-500">
        LensWise now uses a single office account per organization on shared devices, so team invitations have been
        removed. If your office already has an account, sign in to continue.
      </p>
      <Link href="/login">
        <Button className="w-full">Go to sign in</Button>
      </Link>
    </div>
  );
}

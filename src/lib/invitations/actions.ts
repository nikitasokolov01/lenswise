"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sha256Hex } from "@/lib/server/keys";

export interface InvitePreview {
  email?: string;
  role?: string;
  organizationName?: string;
  status?: string;
  expired?: boolean;
  error?: string;
}

/**
 * Read-only preview of an invitation by its raw token. The invitee holds the
 * token, so exposing the invited email/org/role for it is safe. Uses the
 * service role because an unauthenticated invitee cannot read the invitations
 * table under RLS.
 */
export async function previewInvitationAction(token: string): Promise<InvitePreview> {
  if (!token) return { error: "This invitation link is missing its token." };
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("invitations")
    .select("email, role, status, expires_at, organizations(name)")
    .eq("token_hash", sha256Hex(token))
    .maybeSingle();
  if (error || !data) return { error: "This invitation link is not valid." };
  const expired = data.expires_at ? new Date(data.expires_at) < new Date() : false;
  return {
    email: data.email,
    role: data.role,
    organizationName: (data as { organizations?: { name?: string } | null }).organizations?.name,
    status: data.status,
    expired,
  };
}

export interface AcceptState {
  error?: string;
}

/**
 * Accept an invitation as the currently signed-in user. The DB function
 * enforces: the caller's email matches the invite, the invite is still
 * pending, and it has not expired/been revoked — so an accepted/expired/
 * revoked invitation can never be reused.
 */
export async function acceptInvitationAction(_prev: AcceptState, formData: FormData): Promise<AcceptState> {
  const token = String(formData.get("token") ?? "");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("invitation_email_mismatch"))
      return { error: "You're signed in with a different email than this invitation. Log out and use the invited email." };
    if (m.includes("invitation_expired")) return { error: "This invitation has expired." };
    if (m.includes("invitation_not_pending")) return { error: "This invitation has already been used or revoked." };
    if (m.includes("invalid_invitation")) return { error: "This invitation link is not valid." };
    return { error: "Could not accept the invitation. Please try again." };
  }
  redirect("/");
}

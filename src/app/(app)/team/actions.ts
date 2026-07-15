"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveOrg } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canAssignRole, canManageTeam, type OrgRole } from "@/lib/auth/permissions";
import { generateInvitationToken, sha256Hex } from "@/lib/server/keys";

async function requireTeamManager() {
  const ctx = await requireActiveOrg();
  if (!canManageTeam(ctx.role)) redirect("/");
  return ctx;
}

export interface InviteState {
  error?: string;
  inviteToken?: string;
  email?: string;
}

const inviteSchema = z.object({
  email: z.string().trim().email("Enter a valid email."),
  role: z.enum(["admin", "staff"]),
  expiresInDays: z.coerce.number().int().min(0).max(90).default(14),
});

/**
 * Invite an employee. The role is capped by the actor (Owners may invite
 * Admins or Staff; Admins may invite only Staff). The invitation is always
 * scoped to the actor's own organization, so a user can never be invited into
 * another org. The raw token is returned once to build the invite link.
 */
export async function inviteMemberAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const ctx = await requireTeamManager();
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
    expiresInDays: formData.get("expiresInDays") ?? 14,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid invitation." };

  const { email, role, expiresInDays } = parsed.data;
  if (!canAssignRole(ctx.role, role)) {
    return { error: "You are not allowed to invite that role." };
  }

  const token = generateInvitationToken();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("invitations").insert({
    organization_id: ctx.organization.id,
    email,
    role,
    token_hash: sha256Hex(token),
    invited_by: ctx.user.id,
    expires_at: expiresInDays > 0 ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString() : null,
  });
  if (error) return { error: `Could not create invitation: ${error.message}` };

  revalidatePath("/team");
  return { inviteToken: token, email };
}

export async function revokeInvitationAction(formData: FormData): Promise<void> {
  const ctx = await requireTeamManager();
  const id = String(formData.get("id") ?? "");
  const supabase = createSupabaseServerClient();
  await supabase
    .from("invitations")
    .update({ status: "revoked" })
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .eq("status", "pending");
  revalidatePath("/team");
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const ctx = await requireTeamManager();
  const userId = String(formData.get("userId") ?? "");
  const supabase = createSupabaseServerClient();
  // The DB trigger blocks removing the last owner; RLS enforces authorization.
  await supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", ctx.organization.id)
    .eq("user_id", userId);
  revalidatePath("/team");
}

export async function changeRoleAction(formData: FormData): Promise<void> {
  const ctx = await requireTeamManager();
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "") as OrgRole;
  if (!["owner", "admin", "staff"].includes(role)) return;
  // Owners may set any role (ownership transfer); Admins may only set staff.
  if (!canAssignRole(ctx.role, role)) return;
  const supabase = createSupabaseServerClient();
  await supabase
    .from("organization_members")
    .update({ role })
    .eq("organization_id", ctx.organization.id)
    .eq("user_id", userId);
  revalidatePath("/team");
}

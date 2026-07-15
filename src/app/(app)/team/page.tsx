import { requireArea } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InviteForm } from "@/components/team/InviteForm";
import { MemberRow } from "@/components/team/MemberRow";
import { revokeInvitationAction } from "./actions";
import { Button } from "@/components/ui/button";
import type { OrgRole } from "@/lib/auth/permissions";

export const metadata = { title: "Team — LensWise" };

export default async function TeamPage() {
  const ctx = await requireArea("team");
  const orgId = ctx.organization!.id;
  const supabase = createSupabaseServerClient();

  const { data: membersData } = await supabase
    .from("organization_members")
    .select("user_id, role, profiles(email, full_name)")
    .eq("organization_id", orgId);
  const { data: invitesData } = await supabase
    .from("invitations")
    .select("id,email,role,expires_at,created_at")
    .eq("organization_id", orgId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  type MemberQueryRow = {
    user_id: string;
    role: OrgRole;
    profiles: { email: string | null; full_name: string | null } | null;
  };
  type InviteRow = { id: string; email: string; role: string; expires_at: string | null; created_at: string };

  const members = ((membersData ?? []) as unknown as MemberQueryRow[]).map((m) => ({
    userId: m.user_id,
    role: m.role,
    email: m.profiles?.email ?? null,
    fullName: m.profiles?.full_name ?? null,
  }));
  const invites = (invitesData ?? []) as unknown as InviteRow[];

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Team</h1>
        <p className="mt-1 text-sm text-navy-500">Manage the members and invitations for {ctx.organization!.name}.</p>
      </div>

      <section className="rounded-lg border border-navy-100 bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold text-navy-900">Invite an employee</h2>
        <InviteForm canInviteAdmin={ctx.role === "owner"} />
      </section>

      <section className="rounded-lg border border-navy-100 bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold text-navy-900">Members</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-navy-100 text-xs uppercase text-navy-500">
            <tr>
              <th className="py-2 pr-3">Member</th>
              <th className="py-2 pr-3">Role</th>
              <th className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <MemberRow key={m.userId} actorRole={ctx.role} actorUserId={ctx.user.id} member={m} />
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-navy-100 bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold text-navy-900">Pending invitations</h2>
        {invites.length === 0 ? (
          <p className="text-sm text-navy-400">No pending invitations.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-navy-100 text-xs uppercase text-navy-500">
              <tr>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Expires</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => (
                <tr key={inv.id} className="border-b border-navy-50">
                  <td className="py-2 pr-3 text-navy-800">{inv.email}</td>
                  <td className="py-2 pr-3 capitalize">{inv.role}</td>
                  <td className="py-2 pr-3">
                    {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : "Never"}
                  </td>
                  <td className="py-2 text-right">
                    <form action={revokeInvitationAction}>
                      <input type="hidden" name="id" value={inv.id} />
                      <Button type="submit" variant="secondary" size="sm">
                        Revoke
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

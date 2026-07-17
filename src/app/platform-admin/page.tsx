import { requireSuperAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { RegistrationKeyGenerator } from "@/components/platform/RegistrationKeyGenerator";
import { OrgStatusButton } from "@/components/platform/OrgStatusButton";
import { ComplimentaryAccessControl } from "@/components/platform/ComplimentaryAccessControl";
import { revokeRegistrationKeyAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Platform Admin — LensWise" };

// ---------------------------------------------------------------------------
// Flat row shapes — loaded in separate queries and composed in TypeScript.
// There is NO foreign key between organization_members and profiles (both
// reference auth.users), so we never rely on nested PostgREST embedding across
// that boundary. The owner email is resolved as:
//   organization_members.user_id  →  profiles.id  →  profiles.email
// (email is stored on public.profiles, populated by the handle_new_user trigger.)
// ---------------------------------------------------------------------------
type OrgRow = { id: string; name: string; status: "active" | "disabled"; created_at: string };
type BillingRow = {
  organization_id: string;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_end: string | null;
  current_period_end: string | null;
  lifetime_complimentary: boolean | null;
  lifetime_complimentary_granted_at: string | null;
};
type MemberRow = { organization_id: string; user_id: string; role: string };
type ProfileRow = { id: string; email: string | null; full_name: string | null };

function keyStatus(k: { revoked: boolean; expires_at: string | null; uses: number; max_uses: number }): string {
  if (k.revoked) return "Revoked";
  if (k.expires_at && new Date(k.expires_at) < new Date()) return "Expired";
  if (k.uses >= k.max_uses) return "Used up";
  return "Active";
}

const fmtDate = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

export default async function PlatformAdminPage() {
  await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  // Registration keys (unchanged — these embeds use real FKs).
  const { data: keysData, error: keysError } = await admin
    .from("registration_keys")
    .select("id,label,max_uses,uses,revoked,expires_at,created_at, registration_key_redemptions(organizations(name))")
    .order("created_at", { ascending: false });
  if (keysError) console.error("[platform-admin] Failed to load registration keys:", keysError);

  // Organizations: four flat queries, composed in TypeScript (no nested
  // relationship inference). Organizations + billing + owner memberships load in
  // parallel; profiles are then fetched once for just the owner user ids.
  const [
    { data: orgsData, error: orgsError },
    { data: billingData, error: billingError },
    { data: membersData, error: membersError },
  ] = await Promise.all([
    admin.from("organizations").select("id,name,status,created_at").order("created_at", { ascending: false }),
    admin
      .from("organization_billing")
      .select(
        "organization_id,subscription_status,stripe_customer_id,stripe_subscription_id,trial_end,current_period_end,lifetime_complimentary,lifetime_complimentary_granted_at"
      ),
    admin.from("organization_members").select("organization_id,user_id,role").eq("role", "owner"),
  ]);

  const organizations = (orgsData ?? []) as OrgRow[];
  const billingRows = (billingData ?? []) as BillingRow[];
  const ownerMembers = (membersData ?? []) as MemberRow[];

  // One profiles query for the distinct owner user ids (never one-per-org).
  const ownerUserIds = Array.from(new Set(ownerMembers.map((m) => m.user_id)));
  const { data: profilesData, error: profilesError } =
    ownerUserIds.length > 0
      ? await admin.from("profiles").select("id,email,full_name").in("id", ownerUserIds)
      : { data: [] as ProfileRow[], error: null };
  const profiles = (profilesData ?? []) as ProfileRow[];

  if (orgsError) console.error("[platform-admin] Failed to load organizations:", orgsError);
  if (billingError) console.error("[platform-admin] Failed to load billing:", billingError);
  if (membersError) console.error("[platform-admin] Failed to load organization members:", membersError);
  if (profilesError) console.error("[platform-admin] Failed to load profiles:", profilesError);

  // O(1) lookup maps keyed by id.
  const billingByOrganization = new Map<string, BillingRow>(billingRows.map((b) => [b.organization_id, b]));
  const ownerByOrganization = new Map<string, string>();
  for (const m of ownerMembers) {
    if (!ownerByOrganization.has(m.organization_id)) ownerByOrganization.set(m.organization_id, m.user_id);
  }
  const profileByUser = new Map<string, ProfileRow>(profiles.map((p) => [p.id, p]));

  const ownerEmailFor = (orgId: string): string => {
    const userId = ownerByOrganization.get(orgId);
    const profile = userId ? profileByUser.get(userId) : undefined;
    return profile?.email ?? "—";
  };

  type KeyRow = {
    id: string;
    label: string | null;
    max_uses: number;
    uses: number;
    revoked: boolean;
    expires_at: string | null;
    created_at: string;
    registration_key_redemptions: { organizations: { name: string } | null }[] | null;
  };
  const keys = (keysData ?? []) as unknown as KeyRow[];

  // The organizations query is the critical one; if it failed, say so rather
  // than pretending there are no organizations. Secondary failures degrade
  // gracefully (fields show "—") with a visible warning.
  const orgsFailed = Boolean(orgsError);
  const secondaryFailed = Boolean(billingError || membersError || profilesError);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Platform Admin</h1>
        <p className="mt-1 text-sm text-navy-500">Manage registration keys and organizations across LensWise.</p>
      </div>

      <section className="rounded-lg border border-navy-100 bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold text-navy-900">Generate a registration key</h2>
        <RegistrationKeyGenerator />
      </section>

      <section className="rounded-lg border border-navy-100 bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold text-navy-900">Registration keys</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-navy-100 text-xs uppercase text-navy-500">
              <tr>
                <th className="py-2 pr-3">Label</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Uses</th>
                <th className="py-2 pr-3">Expires</th>
                <th className="py-2 pr-3">Redeemed by</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-3 text-navy-400">
                    {keysError ? "Could not load registration keys." : "No keys yet."}
                  </td>
                </tr>
              ) : (
                keys.map((k) => {
                  const status = keyStatus(k);
                  const redeemedOrg = k.registration_key_redemptions?.[0]?.organizations?.name ?? "—";
                  return (
                    <tr key={k.id} className="border-b border-navy-50">
                      <td className="py-2 pr-3 text-navy-800">{k.label || <span className="text-navy-400">—</span>}</td>
                      <td className="py-2 pr-3">{status}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        {k.uses}/{k.max_uses}
                      </td>
                      <td className="py-2 pr-3">{k.expires_at ? new Date(k.expires_at).toLocaleDateString() : "Never"}</td>
                      <td className="py-2 pr-3">{redeemedOrg}</td>
                      <td className="py-2 text-right">
                        {status === "Active" ? (
                          <form action={revokeRegistrationKeyAction}>
                            <input type="hidden" name="id" value={k.id} />
                            <Button type="submit" variant="secondary" size="sm">
                              Revoke
                            </Button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-navy-100 bg-white p-5">
        <h2 className="text-lg font-semibold text-navy-900">Organizations</h2>
        <p className="mb-3 mt-0.5 text-xs text-navy-500">
          <span className="font-medium">Lifetime Complimentary Access</span> grants an organization permanent LensWise
          access without requiring a Stripe subscription.
        </p>

        {orgsFailed ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load organizations. Please check the server logs and try again.
          </div>
        ) : (
          <>
            {secondaryFailed ? (
              <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
                Some organization details (billing or owner) could not be loaded and may show as “—”.
              </div>
            ) : null}
            <div className="overflow-x-auto">
              <table className="min-w-[1200px] w-full text-left text-sm">
                <thead className="border-b border-navy-100 text-xs uppercase text-navy-500">
                  <tr>
                    <th className="py-2 pr-4">Organization</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Owner</th>
                    <th className="py-2 pr-4">Access</th>
                    <th className="py-2 pr-4">Stripe status</th>
                    <th className="py-2 pr-4">Trial end</th>
                    <th className="py-2 pr-4">Period end</th>
                    <th className="py-2 pr-4">Stripe customer</th>
                    <th className="py-2 pr-4">Stripe subscription</th>
                    <th className="py-2 pr-4">Created</th>
                    <th className="min-w-[190px] py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {organizations.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-3 text-navy-400">
                        No organizations yet.
                      </td>
                    </tr>
                  ) : (
                    organizations.map((o) => {
                      const billing = billingByOrganization.get(o.id) ?? null;
                      const complimentary = Boolean(billing?.lifetime_complimentary);
                      const stripeStatus = billing?.subscription_status ?? null;
                      return (
                        <tr key={o.id} className="border-b border-navy-50 align-top">
                          <td className="py-3 pr-4 font-medium text-navy-800">
                            <span className="block max-w-[220px] break-words">{o.name || "—"}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={o.status === "disabled" ? "text-red-600" : "text-teal-700"}>{o.status}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="block max-w-[220px] break-words">{ownerEmailFor(o.id)}</span>
                          </td>
                          <td className="py-3 pr-4">
                            {complimentary ? (
                              <div className="flex flex-col items-start gap-1">
                                <Badge variant="teal">Complimentary</Badge>
                                {stripeStatus ? (
                                  <span className="text-xs text-navy-400">· Stripe {stripeStatus}</span>
                                ) : null}
                                <span className="text-xs text-navy-400">
                                  Granted {fmtDate(billing?.lifetime_complimentary_granted_at ?? null)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-navy-400">Stripe</span>
                            )}
                          </td>
                          <td className="py-3 pr-4">{stripeStatus ?? "—"}</td>
                          <td className="py-3 pr-4 whitespace-nowrap">{fmtDate(billing?.trial_end ?? null)}</td>
                          <td className="py-3 pr-4 whitespace-nowrap">{fmtDate(billing?.current_period_end ?? null)}</td>
                          <td className="py-3 pr-4">
                            <span
                              className="block max-w-[160px] truncate font-mono text-xs text-navy-600"
                              title={billing?.stripe_customer_id ?? undefined}
                            >
                              {billing?.stripe_customer_id ?? "—"}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span
                              className="block max-w-[160px] truncate font-mono text-xs text-navy-600"
                              title={billing?.stripe_subscription_id ?? undefined}
                            >
                              {billing?.stripe_subscription_id ?? "—"}
                            </span>
                          </td>
                          <td className="py-3 pr-4 whitespace-nowrap">{new Date(o.created_at).toLocaleDateString()}</td>
                          <td className="min-w-[190px] py-3 text-right align-top">
                            <div className="flex min-w-[180px] flex-col items-stretch gap-2">
                              <OrgStatusButton id={o.id} status={o.status} />
                              <ComplimentaryAccessControl
                                organizationId={o.id}
                                organizationName={o.name}
                                isComplimentary={complimentary}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

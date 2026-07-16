import { requireSuperAdmin } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RegistrationKeyGenerator } from "@/components/platform/RegistrationKeyGenerator";
import { OrgStatusButton } from "@/components/platform/OrgStatusButton";
import { revokeRegistrationKeyAction } from "./actions";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Platform Admin — LensWise" };

function keyStatus(k: { revoked: boolean; expires_at: string | null; uses: number; max_uses: number }): string {
  if (k.revoked) return "Revoked";
  if (k.expires_at && new Date(k.expires_at) < new Date()) return "Expired";
  if (k.uses >= k.max_uses) return "Used up";
  return "Active";
}

export default async function PlatformAdminPage() {
  await requireSuperAdmin();
  const supabase = createSupabaseServerClient();

  const { data: keysData } = await supabase
    .from("registration_keys")
    .select("id,label,max_uses,uses,revoked,expires_at,created_at, registration_key_redemptions(organizations(name))")
    .order("created_at", { ascending: false });

  const { data: orgsData } = await supabase
    .from("organizations")
    .select(
      "id,name,status,created_at, organization_members(role, profiles(email)), pricing_configurations(updated_at), organization_billing(subscription_status, trial_end, current_period_end, stripe_customer_id, stripe_subscription_id)"
    )
    .order("created_at", { ascending: false });

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
  type OrgMemberRow = { role: string; profiles: { email: string | null } | null };
  type BillingRow = {
    subscription_status: string | null;
    trial_end: string | null;
    current_period_end: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
  };
  type OrgRow = {
    id: string;
    name: string;
    status: "active" | "disabled";
    created_at: string;
    organization_members: OrgMemberRow[] | null;
    pricing_configurations: { updated_at: string }[] | null;
    organization_billing: BillingRow[] | BillingRow | null;
  };

  const keys = (keysData ?? []) as unknown as KeyRow[];
  const orgs = (orgsData ?? []) as unknown as OrgRow[];

  const billingOf = (o: OrgRow): BillingRow | null =>
    Array.isArray(o.organization_billing)
      ? o.organization_billing[0] ?? null
      : o.organization_billing ?? null;
  const shortId = (id: string | null): string => (id ? `${id.slice(0, 14)}…` : "—");
  const fmtDate = (iso: string | null): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
  };

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
                    No keys yet.
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
        <h2 className="mb-3 text-lg font-semibold text-navy-900">Organizations</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-navy-100 text-xs uppercase text-navy-500">
              <tr>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Owner</th>
                <th className="py-2 pr-3">Subscription</th>
                <th className="py-2 pr-3">Trial end</th>
                <th className="py-2 pr-3">Period end</th>
                <th className="py-2 pr-3">Stripe customer</th>
                <th className="py-2 pr-3">Stripe subscription</th>
                <th className="py-2 pr-3">Created</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {orgs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-3 text-navy-400">
                    No organizations yet.
                  </td>
                </tr>
              ) : (
                orgs.map((o) => {
                  const members = o.organization_members ?? [];
                  const owner = members.find(
                  (m: { role: string }) => m.role === "owner"
                  );
                  const billing = billingOf(o);
                  return (
                    <tr key={o.id} className="border-b border-navy-50">
                      <td className="py-2 pr-3 text-navy-800">{o.name}</td>
                      <td className="py-2 pr-3">
                        <span className={o.status === "disabled" ? "text-red-600" : "text-teal-700"}>{o.status}</span>
                      </td>
                      <td className="py-2 pr-3">{owner?.profiles?.email ?? "—"}</td>
                      <td className="py-2 pr-3">{billing?.subscription_status ?? "—"}</td>
                      <td className="py-2 pr-3">{fmtDate(billing?.trial_end ?? null)}</td>
                      <td className="py-2 pr-3">{fmtDate(billing?.current_period_end ?? null)}</td>
                      <td className="py-2 pr-3 font-mono text-xs text-navy-600">{shortId(billing?.stripe_customer_id ?? null)}</td>
                      <td className="py-2 pr-3 font-mono text-xs text-navy-600">{shortId(billing?.stripe_subscription_id ?? null)}</td>
                      <td className="py-2 pr-3">{new Date(o.created_at).toLocaleDateString()}</td>
                      <td className="py-2 text-right">
                        <OrgStatusButton id={o.id} status={o.status} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

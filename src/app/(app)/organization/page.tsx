import { requireBilledOrg } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabasePricingRepository } from "@/lib/pricing/SupabasePricingRepository";
import { OrgSettingsForm } from "@/components/organization/OrgSettingsForm";
import { updateCustomerDisplayAction } from "./actions";
import { canEditOrganizationSettings } from "@/lib/auth/permissions";
import { CheckboxField } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Organization Settings — LensWise" };

export default async function OrganizationPage() {
  const ctx = await requireBilledOrg();
  const orgId = ctx.organization.id;
  const canEdit = canEditOrganizationSettings(ctx.role);
  const supabase = createSupabaseServerClient();

  const { data: settings } = await supabase
    .from("organization_settings")
    .select("office_name, contact_email, contact_phone, contact_address")
    .eq("organization_id", orgId)
    .maybeSingle();

  const repo = new SupabasePricingRepository(supabase, orgId, ctx.user.id);
  const config = await repo.getConfiguration().catch(() => null);
  const showExact = config?.showExactTechnologyNamesOnCustomerQuotes ?? false;

  const defaults = {
    officeName: settings?.office_name ?? ctx.organization.name,
    contactEmail: settings?.contact_email ?? "",
    contactPhone: settings?.contact_phone ?? "",
    contactAddress: settings?.contact_address ?? "",
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Organization Settings</h1>
        <p className="mt-1 text-sm text-navy-500">
          {canEdit ? "Office details shown on quotes and printouts." : "Office details (read-only for your role)."}
        </p>
      </div>

      <section className="rounded-lg border border-navy-100 bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold text-navy-900">Office &amp; contact</h2>
        {canEdit ? (
          <OrgSettingsForm defaults={defaults} />
        ) : (
          <dl className="space-y-2 text-sm">
            <Row label="Office name" value={defaults.officeName} />
            <Row label="Contact email" value={defaults.contactEmail || "—"} />
            <Row label="Contact phone" value={defaults.contactPhone || "—"} />
            <Row label="Address" value={defaults.contactAddress || "—"} />
          </dl>
        )}
      </section>

      {canEdit ? (
        <section className="rounded-lg border border-navy-100 bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold text-navy-900">Customer display</h2>
          <form action={updateCustomerDisplayAction} className="space-y-3">
            <CheckboxField
              name="showExact"
              defaultChecked={showExact}
              label="Show exact technology names on customer-facing quotes"
              description="When off (recommended), Patient View and the Customer Estimate show generalized product names and hide brands, materials, and progressive design names."
            />
            <Button type="submit" size="sm">
              Save display setting
            </Button>
          </form>
        </section>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-navy-50 py-1.5">
      <dt className="text-navy-500">{label}</dt>
      <dd className="text-right text-navy-800">{value}</dd>
    </div>
  );
}

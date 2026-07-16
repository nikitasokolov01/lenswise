import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OrgSettingsForm } from "@/components/organization/OrgSettingsForm";
import { canEditOrganizationSettings, type OrgRole } from "@/lib/auth/permissions";

/**
 * Settings → Organization. Office & contact details (shown on quotes and
 * printouts). Existing role permissions and Supabase persistence are unchanged;
 * this simply hosts the form inside the unified Settings area.
 */
export async function OrganizationSection({
  orgId,
  orgName,
  role,
}: {
  orgId: string;
  orgName: string;
  role: OrgRole | null;
}) {
  const canEdit = canEditOrganizationSettings(role);
  const supabase = createSupabaseServerClient();

  const { data: settings } = await supabase
    .from("organization_settings")
    .select("office_name, contact_email, contact_phone, contact_address")
    .eq("organization_id", orgId)
    .maybeSingle();

  const defaults = {
    officeName: settings?.office_name ?? orgName,
    contactEmail: settings?.contact_email ?? "",
    contactPhone: settings?.contact_phone ?? "",
    contactAddress: settings?.contact_address ?? "",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-navy-900">Organization</h2>
        <p className="mt-1 text-sm text-navy-500">
          {canEdit ? "Office details shown on quotes and printouts." : "Office details (read-only for your role)."}
        </p>
      </div>

      <section className="rounded-lg border border-navy-100 bg-white p-5">
        <h3 className="mb-3 text-base font-semibold text-navy-900">Office &amp; contact</h3>
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

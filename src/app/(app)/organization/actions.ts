"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireArea } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabasePricingRepository } from "@/lib/pricing/SupabasePricingRepository";

export interface OrgSettingsState {
  error?: string;
  ok?: boolean;
}

const settingsSchema = z.object({
  officeName: z.string().trim().min(1, "Office name is required."),
  contactEmail: z.string().trim().email("Enter a valid email.").or(z.literal("")),
  contactPhone: z.string().trim().max(40),
  contactAddress: z.string().trim().max(400),
});

export async function updateOrganizationSettingsAction(
  _prev: OrgSettingsState,
  formData: FormData
): Promise<OrgSettingsState> {
  const ctx = await requireArea("organization_settings");
  const orgId = ctx.organization!.id;
  const parsed = settingsSchema.safeParse({
    officeName: formData.get("officeName"),
    contactEmail: formData.get("contactEmail") ?? "",
    contactPhone: formData.get("contactPhone") ?? "",
    contactAddress: formData.get("contactAddress") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };

  const supabase = createSupabaseServerClient();
  const { error: orgErr } = await supabase.from("organizations").update({ name: parsed.data.officeName }).eq("id", orgId);
  if (orgErr) return { error: `Could not save: ${orgErr.message}` };

  const { error: settingsErr } = await supabase.from("organization_settings").upsert(
    {
      organization_id: orgId,
      office_name: parsed.data.officeName,
      contact_email: parsed.data.contactEmail || null,
      contact_phone: parsed.data.contactPhone || null,
      contact_address: parsed.data.contactAddress || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" }
  );
  if (settingsErr) return { error: `Could not save: ${settingsErr.message}` };

  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Customer-display setting (show exact technology names) lives in the pricing
 * configuration JSON. We load, flip the flag, and save through the same
 * repository so migrations + Zod validation always run.
 */
export async function updateCustomerDisplayAction(formData: FormData): Promise<void> {
  const ctx = await requireArea("organization_settings");
  const orgId = ctx.organization!.id;
  const showExact = formData.get("showExact") === "on";
  const repo = new SupabasePricingRepository(createSupabaseServerClient(), orgId, ctx.user.id);
  const config = await repo.getConfiguration();
  await repo.saveConfiguration({ ...config, showExactTechnologyNamesOnCustomerQuotes: showExact });
  revalidatePath("/settings");
}

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

export interface LocationActionState extends OrgSettingsState {
  message?: string;
}

const settingsSchema = z.object({
  officeName: z.string().trim().min(1, "Office name is required."),
  contactEmail: z.string().trim().email("Enter a valid email.").or(z.literal("")),
  contactPhone: z.string().trim().max(40),
  contactAddress: z.string().trim().max(400),
});

const locationSchema = z.object({
  name: z.string().trim().min(1, "Location name is required.").max(120),
  contactEmail: z.string().trim().email("Enter a valid email.").or(z.literal("")),
  contactPhone: z.string().trim().max(40),
  contactAddress: z.string().trim().max(400),
});

const locationIdSchema = z.string().uuid();

function parseLocation(formData: FormData) {
  return locationSchema.safeParse({
    name: formData.get("name"),
    contactEmail: formData.get("contactEmail") ?? "",
    contactPhone: formData.get("contactPhone") ?? "",
    contactAddress: formData.get("contactAddress") ?? "",
  });
}

function locationDatabaseMessage(error: { code?: string }): string {
  if (error.code === "23505") {
    return "An active location with that name already exists.";
  }
  return "The location could not be saved. Please try again.";
}

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

export async function createOrganizationLocationAction(
  _prev: LocationActionState,
  formData: FormData
): Promise<LocationActionState> {
  const ctx = await requireArea("organization_settings");
  const parsed = parseLocation(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the location." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("organization_locations").insert({
    organization_id: ctx.organization.id,
    name: parsed.data.name,
    contact_email: parsed.data.contactEmail || null,
    contact_phone: parsed.data.contactPhone || null,
    contact_address: parsed.data.contactAddress || null,
    created_by: ctx.user.id,
    updated_by: ctx.user.id,
  });

  if (error) return { error: locationDatabaseMessage(error) };
  revalidatePath("/", "layout");
  revalidatePath("/settings");
  return { ok: true, message: `${parsed.data.name} was added.` };
}

export async function updateOrganizationLocationAction(
  _prev: LocationActionState,
  formData: FormData
): Promise<LocationActionState> {
  const ctx = await requireArea("organization_settings");
  const locationId = locationIdSchema.safeParse(formData.get("locationId"));
  const parsed = parseLocation(formData);
  if (!locationId.success) return { error: "Invalid location." };
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the location." };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organization_locations")
    .update({
      name: parsed.data.name,
      contact_email: parsed.data.contactEmail || null,
      contact_phone: parsed.data.contactPhone || null,
      contact_address: parsed.data.contactAddress || null,
      updated_by: ctx.user.id,
    })
    .eq("id", locationId.data)
    .eq("organization_id", ctx.organization.id)
    .eq("is_active", true)
    .select("id")
    .maybeSingle();

  if (error) return { error: locationDatabaseMessage(error) };
  if (!data) return { error: "That location is no longer available." };
  revalidatePath("/", "layout");
  revalidatePath("/settings");
  return { ok: true, message: "Location details updated." };
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

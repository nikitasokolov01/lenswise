"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { writeBillingAudit } from "@/lib/billing/audit";
import { generateRegistrationKey, keyPrefix, sha256Hex } from "@/lib/server/keys";

export interface GenerateKeyState {
  error?: string;
  rawKey?: string;
  prefix?: string;
}

const generateSchema = z.object({
  label: z.string().trim().max(120).optional(),
  expiresInDays: z.coerce.number().int().min(0).max(365).default(0),
  maxUses: z.coerce.number().int().min(1).max(1000).default(1),
  oneTime: z.union([z.literal("on"), z.null()]).optional(),
});

/**
 * Generate a registration key. The RAW key is generated and hashed on the
 * server; only the SHA-256 hash is stored. The raw key is returned exactly
 * once for the Super Admin to copy — it can never be retrieved again.
 */
export async function generateRegistrationKeyAction(
  _prev: GenerateKeyState,
  formData: FormData
): Promise<GenerateKeyState> {
  const ctx = await requireSuperAdmin();
  const parsed = generateSchema.safeParse({
    label: formData.get("label") ?? undefined,
    expiresInDays: formData.get("expiresInDays") ?? 0,
    maxUses: formData.get("maxUses") ?? 1,
    oneTime: formData.get("oneTime"),
  });
  if (!parsed.success) return { error: "Please check the key options." };

  const oneTime = parsed.data.oneTime === "on";
  const maxUses = oneTime ? 1 : parsed.data.maxUses;
  const expiresAt =
    parsed.data.expiresInDays > 0
      ? new Date(Date.now() + parsed.data.expiresInDays * 86_400_000).toISOString()
      : null;

  const rawKey = generateRegistrationKey();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("registration_keys").insert({
    key_hash: sha256Hex(rawKey),
    label: parsed.data.label || null,
    max_uses: maxUses,
    expires_at: expiresAt,
    created_by: ctx.user.id,
  });
  if (error) return { error: `Could not generate key: ${error.message}` };

  revalidatePath("/platform-admin");
  return { rawKey, prefix: keyPrefix(rawKey) };
}

export async function revokeRegistrationKeyAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const supabase = createSupabaseServerClient();
  await supabase.from("registration_keys").update({ revoked: true }).eq("id", id);
  revalidatePath("/platform-admin");
}

export async function setOrganizationStatusAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (status !== "active" && status !== "disabled") return;
  const supabase = createSupabaseServerClient();
  await supabase.from("organizations").update({ status }).eq("id", id);
  revalidatePath("/platform-admin");
}

// ===========================================================================
// Complimentary access (Platform Super Admin only). Grants/revokes a permanent,
// internal LensWise billing override on an organization WITHOUT touching Stripe.
// The platform role is verified server-side (requireSuperAdmin) — never trusted
// from the client — and only the complimentary columns are changed. Writes use
// the service role; organization_billing has no client write policy, so tenants
// can never modify these fields.
// ===========================================================================

export interface ComplimentaryActionState {
  ok?: boolean;
  error?: string;
}

const orgIdSchema = z.string().uuid();

async function loadOrgForComplimentary(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  organizationId: string
): Promise<{ name: string; previousStatus: string | null } | null> {
  const { data: org } = await admin
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .maybeSingle();
  if (!org) return null;
  const { data: billing } = await admin
    .from("organization_billing")
    .select("subscription_status")
    .eq("organization_id", organizationId)
    .maybeSingle();
  return {
    name: (org as { name: string }).name,
    previousStatus: (billing as { subscription_status: string | null } | null)?.subscription_status ?? null,
  };
}

/** Grant permanent complimentary access to one organization (Super Admin only). */
export async function grantLifetimeComplimentaryAccessAction(
  _prev: ComplimentaryActionState,
  formData: FormData
): Promise<ComplimentaryActionState> {
  const ctx = await requireSuperAdmin();
  const parsed = orgIdSchema.safeParse(String(formData.get("organizationId") ?? ""));
  if (!parsed.success) return { error: "Invalid organization." };
  const organizationId = parsed.data;

  const admin = createSupabaseAdminClient();
  const org = await loadOrgForComplimentary(admin, organizationId);
  if (!org) return { error: "Organization not found." };

  // Update ONLY the complimentary columns — Stripe customer/subscription/status
  // fields are left exactly as they are.
  const { error } = await admin.from("organization_billing").upsert(
    {
      organization_id: organizationId,
      lifetime_complimentary: true,
      lifetime_complimentary_granted_at: new Date().toISOString(),
      lifetime_complimentary_granted_by: ctx.user.id,
    },
    { onConflict: "organization_id" }
  );
  if (error) return { error: "Could not grant complimentary access. Please try again." };

  await writeBillingAudit(admin, {
    organizationId,
    actorId: ctx.user.id,
    action: "billing.complimentary_granted",
    targetType: "organization_billing",
    targetId: organizationId,
    metadata: { organization_name: org.name, previous_stripe_status: org.previousStatus },
  });

  revalidatePath("/platform-admin");
  revalidatePath("/settings");
  return { ok: true };
}

/** Revoke complimentary access; normal Stripe rules resume immediately (Super Admin only). */
export async function revokeLifetimeComplimentaryAccessAction(
  _prev: ComplimentaryActionState,
  formData: FormData
): Promise<ComplimentaryActionState> {
  const ctx = await requireSuperAdmin();
  const parsed = orgIdSchema.safeParse(String(formData.get("organizationId") ?? ""));
  if (!parsed.success) return { error: "Invalid organization." };
  const organizationId = parsed.data;

  const admin = createSupabaseAdminClient();
  const org = await loadOrgForComplimentary(admin, organizationId);
  if (!org) return { error: "Organization not found." };

  // Clear ONLY the complimentary columns. Stripe fields (customer/subscription/
  // status, trial_redeemed_at, etc.) are untouched, so trial history and any
  // existing subscription state remain intact.
  const { error } = await admin
    .from("organization_billing")
    .update({
      lifetime_complimentary: false,
      lifetime_complimentary_granted_at: null,
      lifetime_complimentary_granted_by: null,
    })
    .eq("organization_id", organizationId);
  if (error) return { error: "Could not revoke complimentary access. Please try again." };

  await writeBillingAudit(admin, {
    organizationId,
    actorId: ctx.user.id,
    action: "billing.complimentary_revoked",
    targetType: "organization_billing",
    targetId: organizationId,
    metadata: { organization_name: org.name, previous_stripe_status: org.previousStatus },
  });

  revalidatePath("/platform-admin");
  revalidatePath("/settings");
  return { ok: true };
}

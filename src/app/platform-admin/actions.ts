"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

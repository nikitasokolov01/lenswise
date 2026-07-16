import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FailureState } from "@/lib/settings/bruteForce";

/**
 * Server-only data access for organization_security. Reads/writes go through a
 * service-role client (the table has no client RLS policies), and the
 * organization id is always resolved from the authenticated server context —
 * never from the browser. The PIN hash is used only to verify server-side and
 * is never returned to callers/UI.
 */

export interface OrgSecurity {
  hasPin: boolean;
  pinHash: string | null;
  failedAttempts: number;
  lockedUntil: string | null;
}

export async function getOrgSecurity(admin: SupabaseClient, organizationId: string): Promise<OrgSecurity> {
  const { data } = await admin
    .from("organization_security")
    .select("settings_pin_hash, failed_attempts, locked_until")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const row = data as
    | { settings_pin_hash: string | null; failed_attempts: number | null; locked_until: string | null }
    | null;

  return {
    hasPin: Boolean(row?.settings_pin_hash),
    pinHash: row?.settings_pin_hash ?? null,
    failedAttempts: row?.failed_attempts ?? 0,
    lockedUntil: row?.locked_until ?? null,
  };
}

/** Lightweight existence check for the Settings page (never exposes the hash). */
export async function organizationHasPin(admin: SupabaseClient, organizationId: string): Promise<boolean> {
  const { data } = await admin
    .from("organization_security")
    .select("settings_pin_hash")
    .eq("organization_id", organizationId)
    .maybeSingle();
  return Boolean((data as { settings_pin_hash: string | null } | null)?.settings_pin_hash);
}

export async function setOrgPinHash(
  admin: SupabaseClient,
  organizationId: string,
  pinHash: string,
  updatedBy: string
): Promise<{ ok: boolean }> {
  const { error } = await admin.from("organization_security").upsert(
    {
      organization_id: organizationId,
      settings_pin_hash: pinHash,
      settings_pin_updated_at: new Date().toISOString(),
      settings_pin_updated_by: updatedBy,
      failed_attempts: 0,
      locked_until: null,
    },
    { onConflict: "organization_id" }
  );
  return { ok: !error };
}

export async function applyFailureState(
  admin: SupabaseClient,
  organizationId: string,
  state: FailureState
): Promise<void> {
  await admin
    .from("organization_security")
    .update({ failed_attempts: state.failedAttempts, locked_until: state.lockedUntil })
    .eq("organization_id", organizationId);
}

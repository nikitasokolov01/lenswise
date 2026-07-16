"use server";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSettingsAccess } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validatePinFormat, GENERIC_PIN_ERROR } from "@/lib/settings/pinFormat";
import { canManageSettingsPin } from "@/lib/settings/sections";
import { hashPin, verifyPin } from "@/lib/settings/pin";
import { getOrgSecurity, setOrgPinHash, applyFailureState } from "@/lib/settings/security";
import { registerFailure, clearedFailureState, isInCooldown } from "@/lib/settings/bruteForce";
import { issueSettingsUnlock, clearSettingsUnlock } from "@/lib/settings/session";

export interface PinActionState {
  ok?: boolean;
  error?: string;
}

type AuditAction =
  | "settings_pin_created"
  | "settings_pin_changed"
  | "settings_pin_reset"
  | "settings_unlocked"
  | "settings_locked"
  | "repeated_failed_pin_attempts";

/** Best-effort audit. Never records the PIN, its hash, or any partial PIN. */
async function audit(
  admin: SupabaseClient,
  organizationId: string,
  actorId: string,
  action: AuditAction
): Promise<void> {
  try {
    await admin.rpc("write_audit", {
      p_org: organizationId,
      p_actor: actorId,
      p_action: action,
      p_target_type: "organization_security",
      p_target_id: organizationId,
      p_metadata: {},
    });
  } catch {
    /* audit is best-effort */
  }
}

/** Create the organization's first Office PIN (Owner only). */
export async function setInitialPinAction(_prev: PinActionState, formData: FormData): Promise<PinActionState> {
  const ctx = await requireSettingsAccess();
  if (!canManageSettingsPin(ctx.role)) {
    return { error: "Only the organization owner can set the Office PIN." };
  }

  const pin = String(formData.get("pin") ?? "");
  const confirm = String(formData.get("confirmPin") ?? "");
  const format = validatePinFormat(pin);
  if (!format.ok) return { error: format.error };
  if (pin !== confirm) return { error: "The PINs do not match." };

  const admin = createSupabaseAdminClient();
  const security = await getOrgSecurity(admin, ctx.organization.id);
  if (security.hasPin) {
    return { error: "An Office PIN already exists. Use Change PIN instead." };
  }

  const hash = await hashPin(pin);
  const { ok } = await setOrgPinHash(admin, ctx.organization.id, hash, ctx.user.id);
  if (!ok) return { error: "Could not save your PIN. Please try again." };

  await audit(admin, ctx.organization.id, ctx.user.id, "settings_pin_created");
  issueSettingsUnlock(ctx.organization.id, ctx.user.id);
  return { ok: true };
}

/** Verify the PIN and unlock Settings for this browser session (Owner/Admin). */
export async function verifyPinAction(_prev: PinActionState, formData: FormData): Promise<PinActionState> {
  const ctx = await requireSettingsAccess();
  const pin = String(formData.get("pin") ?? "");

  const admin = createSupabaseAdminClient();
  const security = await getOrgSecurity(admin, ctx.organization.id);
  if (!security.hasPin) {
    return { error: "No Office PIN has been set for this organization yet." };
  }

  // Enforce cooldown BEFORE hashing to slow brute-force attempts. Do not reveal
  // that a cooldown is active — return the same generic error.
  if (isInCooldown(security.lockedUntil, Date.now())) {
    return { error: GENERIC_PIN_ERROR };
  }

  // Reject malformed input the same way as an incorrect PIN (no info leak).
  if (!validatePinFormat(pin).ok) {
    const state = registerFailure(security.failedAttempts, Date.now());
    await applyFailureState(admin, ctx.organization.id, state);
    if (state.lockedUntil) await audit(admin, ctx.organization.id, ctx.user.id, "repeated_failed_pin_attempts");
    return { error: GENERIC_PIN_ERROR };
  }

  const ok = await verifyPin(pin, security.pinHash);
  if (!ok) {
    const state = registerFailure(security.failedAttempts, Date.now());
    await applyFailureState(admin, ctx.organization.id, state);
    if (state.lockedUntil) await audit(admin, ctx.organization.id, ctx.user.id, "repeated_failed_pin_attempts");
    return { error: GENERIC_PIN_ERROR };
  }

  await applyFailureState(admin, ctx.organization.id, clearedFailureState());
  await audit(admin, ctx.organization.id, ctx.user.id, "settings_unlocked");
  issueSettingsUnlock(ctx.organization.id, ctx.user.id);
  return { ok: true };
}

/** Change the PIN (Owner only): requires the current PIN. */
export async function changePinAction(_prev: PinActionState, formData: FormData): Promise<PinActionState> {
  const ctx = await requireSettingsAccess();
  if (!canManageSettingsPin(ctx.role)) {
    return { error: "Only the organization owner can change the Office PIN." };
  }

  const current = String(formData.get("currentPin") ?? "");
  const next = String(formData.get("newPin") ?? "");
  const confirm = String(formData.get("confirmPin") ?? "");

  const format = validatePinFormat(next);
  if (!format.ok) return { error: format.error };
  if (next !== confirm) return { error: "The new PINs do not match." };

  const admin = createSupabaseAdminClient();
  const security = await getOrgSecurity(admin, ctx.organization.id);
  if (!security.hasPin) return { error: "No Office PIN is set. Create one first." };

  if (isInCooldown(security.lockedUntil, Date.now())) {
    return { error: GENERIC_PIN_ERROR };
  }
  if (!(await verifyPin(current, security.pinHash))) {
    const state = registerFailure(security.failedAttempts, Date.now());
    await applyFailureState(admin, ctx.organization.id, state);
    if (state.lockedUntil) await audit(admin, ctx.organization.id, ctx.user.id, "repeated_failed_pin_attempts");
    return { error: GENERIC_PIN_ERROR };
  }

  const hash = await hashPin(next);
  const { ok } = await setOrgPinHash(admin, ctx.organization.id, hash, ctx.user.id);
  if (!ok) return { error: "Could not save your PIN. Please try again." };

  await audit(admin, ctx.organization.id, ctx.user.id, "settings_pin_changed");
  issueSettingsUnlock(ctx.organization.id, ctx.user.id);
  return { ok: true };
}

/**
 * Reset a forgotten PIN (Owner only). Authorized purely by the authenticated
 * owner account — no current PIN required — and replaces it with a newly chosen
 * PIN. The old PIN is never emailed or revealed.
 */
export async function resetPinAction(_prev: PinActionState, formData: FormData): Promise<PinActionState> {
  const ctx = await requireSettingsAccess();
  if (!canManageSettingsPin(ctx.role)) {
    return { error: "Only the organization owner can reset the Office PIN." };
  }

  const next = String(formData.get("newPin") ?? "");
  const confirm = String(formData.get("confirmPin") ?? "");
  const format = validatePinFormat(next);
  if (!format.ok) return { error: format.error };
  if (next !== confirm) return { error: "The new PINs do not match." };

  const admin = createSupabaseAdminClient();
  const hash = await hashPin(next);
  const { ok } = await setOrgPinHash(admin, ctx.organization.id, hash, ctx.user.id);
  if (!ok) return { error: "Could not reset your PIN. Please try again." };

  await audit(admin, ctx.organization.id, ctx.user.id, "settings_pin_reset");
  issueSettingsUnlock(ctx.organization.id, ctx.user.id);
  return { ok: true };
}

/** Immediately lock Settings (clears the unlock session) and show the PIN gate. */
export async function lockSettingsAction(): Promise<void> {
  const ctx = await requireSettingsAccess();
  clearSettingsUnlock();
  const admin = createSupabaseAdminClient();
  await audit(admin, ctx.organization.id, ctx.user.id, "settings_locked");
  redirect("/settings");
}

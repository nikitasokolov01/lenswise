import "server-only";
import { createHash } from "crypto";
import { cookies } from "next/headers";
import { getServiceRoleKey } from "@/lib/env";
import { signUnlockToken, verifyUnlockToken, isUnlockPayloadValid } from "@/lib/settings/unlockToken";

/**
 * Server-only Settings-unlock session. After the correct PIN is entered, an
 * HMAC-signed, HTTP-only cookie marks Settings as unlocked for this browser for
 * a short window. The cookie:
 *  - is HTTP-only and Secure in production, SameSite=Lax,
 *  - contains NO raw PIN — only { organizationId, userId, expiry },
 *  - is signed with a server-only key so it cannot be forged client-side,
 *  - is re-validated against the authenticated user + organization on each load,
 *  - expires after a short duration (15 minutes) and is cleared on Lock.
 */

export const UNLOCK_COOKIE_NAME = "lw_settings_unlock";
export const UNLOCK_TTL_MS = 15 * 60 * 1000; // 15 minutes

/** Dedicated signing key derived from the server-only service-role secret. */
function signingKey(): Buffer {
  return createHash("sha256").update(`${getServiceRoleKey()}:settings-unlock-v1`).digest();
}

/** True when a valid, unexpired unlock cookie exists for THIS user + org. */
export function isSettingsUnlocked(organizationId: string, userId: string): boolean {
  const token = cookies().get(UNLOCK_COOKIE_NAME)?.value;
  const payload = verifyUnlockToken(token, signingKey());
  return isUnlockPayloadValid(payload, organizationId, userId, Date.now());
}

/** Set the unlock cookie (server actions / route handlers only). */
export function issueSettingsUnlock(organizationId: string, userId: string): void {
  const exp = Date.now() + UNLOCK_TTL_MS;
  const token = signUnlockToken({ o: organizationId, u: userId, exp }, signingKey());
  cookies().set(UNLOCK_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(UNLOCK_TTL_MS / 1000),
  });
}

/** Immediately clear the unlock cookie (Lock Settings / sign-out). */
export function clearSettingsUnlock(): void {
  cookies().set(UNLOCK_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

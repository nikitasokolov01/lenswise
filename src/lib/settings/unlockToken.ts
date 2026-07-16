import { createHmac, timingSafeEqual } from "crypto";

/**
 * Pure sign/verify for the Settings-unlock token. No secrets baked in (the key
 * is passed by the server-only session module) and no framework imports, so the
 * signature/expiry logic is unit-testable. The token carries only the org id,
 * user id, and an absolute expiry — never the raw PIN.
 */

export interface UnlockPayload {
  o: string; // organization id
  u: string; // user id
  exp: number; // epoch ms
}

export function signUnlockToken(payload: UnlockPayload, key: Buffer | string): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", key).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyUnlockToken(token: string | undefined | null, key: Buffer | string): UnlockPayload | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = createHmac("sha256", key).update(data).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as UnlockPayload;
    if (typeof payload.o !== "string" || typeof payload.u !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/** The token is valid only for THIS org + user and only before it expires. */
export function isUnlockPayloadValid(
  payload: UnlockPayload | null,
  organizationId: string,
  userId: string,
  nowMs: number
): boolean {
  return !!payload && payload.o === organizationId && payload.u === userId && payload.exp > nowMs;
}

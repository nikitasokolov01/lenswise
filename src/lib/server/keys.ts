import { createHash, randomInt, randomBytes } from "crypto";

/**
 * Server-only helpers for cryptographically secure registration keys and
 * invitation tokens. Raw keys/tokens are generated and hashed here; only the
 * SHA-256 hash is ever stored (matching the DB's
 * encode(digest(x,'sha256'),'hex')). Raw values are shown/sent once and never
 * retrievable again.
 */

// Crockford-ish alphabet without ambiguous characters (no I/L/O/0/1).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function group(length = 4): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(0, ALPHABET.length)];
  return out;
}

/** Registration key in the form LW-XXXX-XXXX-XXXX-XXXX. */
export function generateRegistrationKey(): string {
  return `LW-${group()}-${group()}-${group()}-${group()}`;
}

/** URL-safe, high-entropy invitation token (raw — carried in the invite link). */
export function generateInvitationToken(): string {
  return randomBytes(24).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** A short, non-secret prefix shown in the Platform Admin key list (never the full key). */
export function keyPrefix(rawKey: string): string {
  return rawKey.slice(0, 7); // "LW-XXXX"
}

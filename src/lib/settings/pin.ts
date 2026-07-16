import "server-only";
import bcrypt from "bcryptjs";

/**
 * Server-only Settings-PIN hashing. Uses bcrypt (a slow, salted password hash),
 * never plain SHA-256. The raw PIN is hashed and verified only here, on the
 * server — never in browser code. The raw PIN is never persisted or logged.
 */

const BCRYPT_ROUNDS = 12;

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, BCRYPT_ROUNDS);
}

/** Constant-time-ish bcrypt comparison. Returns false for a missing/blank hash. */
export async function verifyPin(pin: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(pin, hash);
  } catch {
    return false;
  }
}

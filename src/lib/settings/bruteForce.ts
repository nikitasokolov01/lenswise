/**
 * Pure brute-force cooldown logic for Settings-PIN verification. Kept pure so it
 * can be unit tested; the server action persists the returned state in
 * organization_security and enforces it before ever hashing a candidate PIN.
 */

/** Consecutive failures allowed before a cooldown kicks in. */
export const MAX_FAILED_ATTEMPTS = 5;
/** Cooldown duration after the threshold is reached. */
export const COOLDOWN_MS = 60_000;

/** Whether a stored lock timestamp is still in effect at `nowMs`. */
export function isInCooldown(lockedUntil: string | null | undefined, nowMs: number): boolean {
  if (!lockedUntil) return false;
  const until = new Date(lockedUntil).getTime();
  return !Number.isNaN(until) && until > nowMs;
}

export interface FailureState {
  failedAttempts: number;
  lockedUntil: string | null;
}

/**
 * Next persisted state after a failed attempt. Once MAX_FAILED_ATTEMPTS is
 * reached a cooldown is set and the counter resets to start a fresh window.
 */
export function registerFailure(prevAttempts: number, nowMs: number): FailureState {
  const next = Math.max(0, prevAttempts) + 1;
  if (next >= MAX_FAILED_ATTEMPTS) {
    return { failedAttempts: 0, lockedUntil: new Date(nowMs + COOLDOWN_MS).toISOString() };
  }
  return { failedAttempts: next, lockedUntil: null };
}

/** State after a successful verification: everything cleared. */
export function clearedFailureState(): FailureState {
  return { failedAttempts: 0, lockedUntil: null };
}

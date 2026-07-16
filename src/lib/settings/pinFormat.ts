/**
 * Pure Settings-PIN format rules. No secrets, no hashing — safe to import from
 * both client and server (used for inline UI validation and by the server
 * actions as the authoritative check). Verification itself is always server-side.
 */

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 8;

/** Generic, non-revealing error shown for any incorrect PIN attempt. */
export const GENERIC_PIN_ERROR = "Incorrect Office PIN.";

export interface PinFormatResult {
  ok: boolean;
  error?: string;
}

/** A valid PIN is 4–8 digits, digits only. */
export function validatePinFormat(pin: string): PinFormatResult {
  if (!/^\d+$/.test(pin)) {
    return { ok: false, error: "Your PIN must contain digits only." };
  }
  if (pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH) {
    return { ok: false, error: `Your PIN must be ${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} digits.` };
  }
  return { ok: true };
}

export function isValidPinFormat(pin: string): boolean {
  return validatePinFormat(pin).ok;
}

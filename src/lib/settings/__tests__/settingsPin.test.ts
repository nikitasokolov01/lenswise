import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { validatePinFormat, isValidPinFormat, PIN_MIN_LENGTH, PIN_MAX_LENGTH } from "@/lib/settings/pinFormat";
import {
  registerFailure,
  clearedFailureState,
  isInCooldown,
  MAX_FAILED_ATTEMPTS,
  COOLDOWN_MS,
} from "@/lib/settings/bruteForce";
import {
  canAccessSettings,
  canManageSettingsPin,
  canAccessSection,
  visibleSections,
  sectionForLegacyRoute,
  isSettingsSection,
  isProtectedSection,
  SETTINGS_SECTIONS,
} from "@/lib/settings/sections";
import {
  signUnlockToken,
  verifyUnlockToken,
  isUnlockPayloadValid,
  type UnlockPayload,
} from "@/lib/settings/unlockToken";

describe("PIN format", () => {
  it("accepts 4–8 digit PINs", () => {
    expect(isValidPinFormat("1234")).toBe(true);
    expect(isValidPinFormat("12345678")).toBe(true);
    expect(validatePinFormat("1".repeat(PIN_MIN_LENGTH)).ok).toBe(true);
    expect(validatePinFormat("1".repeat(PIN_MAX_LENGTH)).ok).toBe(true);
  });

  it("rejects too-short, too-long, and non-digit PINs", () => {
    expect(isValidPinFormat("123")).toBe(false); // too short
    expect(isValidPinFormat("123456789")).toBe(false); // too long
    expect(isValidPinFormat("12a4")).toBe(false); // non-digit
    expect(isValidPinFormat("12 4")).toBe(false);
    expect(isValidPinFormat("")).toBe(false);
  });
});

describe("PIN hashing (bcrypt)", () => {
  it("never stores the raw PIN and verifies correct vs incorrect", async () => {
    const pin = "4820";
    const hash = await bcrypt.hash(pin, 10);
    // The stored hash must not be the plaintext PIN.
    expect(hash).not.toBe(pin);
    expect(hash).not.toContain(pin);
    // Correct PIN verifies; an incorrect PIN does not.
    expect(await bcrypt.compare(pin, hash)).toBe(true);
    expect(await bcrypt.compare("0000", hash)).toBe(false);
  });

  it("produces different hashes for the same PIN (salted)", async () => {
    const a = await bcrypt.hash("1234", 10);
    const b = await bcrypt.hash("1234", 10);
    expect(a).not.toBe(b);
    expect(await bcrypt.compare("1234", a)).toBe(true);
    expect(await bcrypt.compare("1234", b)).toBe(true);
  });
});

describe("brute-force cooldown", () => {
  it("counts failures and triggers a cooldown at the threshold", () => {
    const now = 1_000_000;
    let attempts = 0;
    for (let i = 1; i < MAX_FAILED_ATTEMPTS; i++) {
      const state = registerFailure(attempts, now);
      expect(state.lockedUntil).toBeNull();
      attempts = state.failedAttempts;
      expect(attempts).toBe(i);
    }
    const locked = registerFailure(attempts, now);
    expect(locked.lockedUntil).toBe(new Date(now + COOLDOWN_MS).toISOString());
    expect(locked.failedAttempts).toBe(0); // window resets
  });

  it("isInCooldown reflects the lock window", () => {
    const now = 2_000_000;
    const until = new Date(now + 30_000).toISOString();
    expect(isInCooldown(until, now)).toBe(true);
    expect(isInCooldown(until, now + 31_000)).toBe(false);
    expect(isInCooldown(null, now)).toBe(false);
  });

  it("clearedFailureState resets everything", () => {
    expect(clearedFailureState()).toEqual({ failedAttempts: 0, lockedUntil: null });
  });
});

describe("settings permissions", () => {
  it("only Owner/Admin can access Settings; Staff cannot even with the PIN", () => {
    expect(canAccessSettings("owner")).toBe(true);
    expect(canAccessSettings("admin")).toBe(true);
    expect(canAccessSettings("staff")).toBe(false);
    expect(canAccessSettings(null)).toBe(false);
  });

  it("only the Owner may manage the PIN", () => {
    expect(canManageSettingsPin("owner")).toBe(true);
    expect(canManageSettingsPin("admin")).toBe(false);
    expect(canManageSettingsPin("staff")).toBe(false);
  });

  it("Security section is Owner-only; other sections are Owner/Admin", () => {
    expect(canAccessSection("owner", "security")).toBe(true);
    expect(canAccessSection("admin", "security")).toBe(false);
    expect(canAccessSection("admin", "pricing")).toBe(true);
    expect(canAccessSection("admin", "billing")).toBe(true);
    expect(canAccessSection("staff", "pricing")).toBe(false);
  });

  it("visibleSections includes Security only for the Owner", () => {
    expect(visibleSections("owner")).toContain("security");
    expect(visibleSections("admin")).not.toContain("security");
    expect(visibleSections("admin")).toContain("pricing");
    expect(visibleSections("staff")).toHaveLength(0);
  });

  it("maps legacy routes to Settings sections (Team is gone)", () => {
    expect(sectionForLegacyRoute("/admin")).toBe("pricing");
    expect(sectionForLegacyRoute("/admin-pricing")).toBe("pricing");
    expect(sectionForLegacyRoute("/organization")).toBe("organization");
    expect(sectionForLegacyRoute("/billing")).toBe("billing");
    expect(sectionForLegacyRoute("/team")).toBeNull(); // Team removed → /settings (no section)
    expect(sectionForLegacyRoute("/nope")).toBeNull();
    expect(isSettingsSection("customer-display")).toBe(true);
    expect(isSettingsSection("team")).toBe(false); // no longer a section
    expect(isSettingsSection("bogus")).toBe(false);
  });

  it("has no Team section", () => {
    expect(SETTINGS_SECTIONS).not.toContain("team");
    expect(SETTINGS_SECTIONS).toEqual(["organization", "pricing", "customer-display", "security", "billing"]);
  });

  it("protects everything except Billing with the Office PIN", () => {
    expect(isProtectedSection("pricing")).toBe(true);
    expect(isProtectedSection("organization")).toBe(true);
    expect(isProtectedSection("customer-display")).toBe(true);
    expect(isProtectedSection("security")).toBe(true);
    // Billing is exempt so it stays reachable without unlocking.
    expect(isProtectedSection("billing")).toBe(false);
  });
});

describe("unlock session token", () => {
  const KEY = "test-signing-key-abc";
  const base: UnlockPayload = { o: "org-1", u: "user-1", exp: Date.now() + 60_000 };

  it("round-trips a valid token", () => {
    const token = signUnlockToken(base, KEY);
    expect(verifyUnlockToken(token, KEY)).toEqual(base);
  });

  it("rejects a tampered token", () => {
    const token = signUnlockToken(base, KEY);
    const tampered = `${token}x`;
    expect(verifyUnlockToken(tampered, KEY)).toBeNull();
  });

  it("cannot be forged with a different key", () => {
    const token = signUnlockToken(base, KEY);
    expect(verifyUnlockToken(token, "other-key")).toBeNull();
  });

  it("expires: isUnlockPayloadValid is false past exp", () => {
    const expired: UnlockPayload = { o: "org-1", u: "user-1", exp: 1000 };
    const token = signUnlockToken(expired, KEY);
    const payload = verifyUnlockToken(token, KEY);
    expect(isUnlockPayloadValid(payload, "org-1", "user-1", 2000)).toBe(false);
    // Same token before expiry would be valid.
    expect(isUnlockPayloadValid(payload, "org-1", "user-1", 500)).toBe(true);
  });

  it("is scoped to a single org + user (cross-org/user blocked)", () => {
    const token = signUnlockToken(base, KEY);
    const payload = verifyUnlockToken(token, KEY);
    const now = Date.now();
    expect(isUnlockPayloadValid(payload, "org-1", "user-1", now)).toBe(true);
    expect(isUnlockPayloadValid(payload, "org-2", "user-1", now)).toBe(false); // different org
    expect(isUnlockPayloadValid(payload, "org-1", "user-2", now)).toBe(false); // different user
  });

  it("an empty/absent token is invalid (Lock clears access)", () => {
    expect(verifyUnlockToken(undefined, KEY)).toBeNull();
    expect(verifyUnlockToken("", KEY)).toBeNull();
    expect(isUnlockPayloadValid(null, "org-1", "user-1", Date.now())).toBe(false);
  });
});

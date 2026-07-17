import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { resolveTheme, shouldApplyDark, parseStoredTheme } from "@/lib/theme/resolveTheme";

describe("theme resolution (shared by anonymous + authenticated)", () => {
  it("light/dark are explicit; system follows prefers-color-scheme", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("light", false)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("dark", true)).toBe("dark");
    // system follows the OS preference
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("shouldApplyDark mirrors resolveTheme", () => {
    expect(shouldApplyDark("dark", false)).toBe(true);
    expect(shouldApplyDark("light", true)).toBe(false);
    expect(shouldApplyDark("system", true)).toBe(true);
    expect(shouldApplyDark("system", false)).toBe(false);
  });
});

describe("anonymous local theme persistence", () => {
  it("round-trips valid stored values and defaults invalid ones to system", () => {
    // What a returning anonymous visitor's localStorage yields:
    expect(parseStoredTheme("light")).toBe("light");
    expect(parseStoredTheme("dark")).toBe("dark");
    expect(parseStoredTheme("system")).toBe("system");
    // Missing/invalid → system (no login required, safe default).
    expect(parseStoredTheme(null)).toBe("system");
    expect(parseStoredTheme(undefined)).toBe("system");
    expect(parseStoredTheme("bogus")).toBe("system");
  });
});

describe("print layouts remain light regardless of theme", () => {
  it("the print stylesheet forces the light palette even under .dark", () => {
    const css = readFileSync(path.resolve(__dirname, "../../../app/globals.css"), "utf8");
    const printBlock = css.slice(css.indexOf("@media print"));
    expect(printBlock.length).toBeGreaterThan(0);
    // Inside @media print, .dark is reset to the light palette.
    expect(printBlock).toContain(".dark");
    expect(printBlock).toContain("--c-paper: 255 255 255");
    expect(printBlock).toContain("--c-white: 255 255 255");
  });
});

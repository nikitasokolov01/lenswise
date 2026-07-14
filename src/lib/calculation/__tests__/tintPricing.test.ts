import { describe, expect, it } from "vitest";
import { resolveTint } from "@/lib/calculation/tintPricing";
import { createDefaultTintConfig } from "@/lib/pricing/seedConfiguration";
import type { TintConfig } from "@/lib/types";

function config(): TintConfig {
  return createDefaultTintConfig();
}

function brownId(tints: TintConfig): string {
  const brown = tints.colors.find((c) => c.name === "Brown");
  if (!brown) throw new Error("Brown tint color missing from seed");
  return brown.id;
}

describe("resolveTint", () => {
  it("returns null when no tint is selected", () => {
    expect(resolveTint(config(), { type: "none", colorId: null, percent: null })).toBeNull();
  });

  it("prices a solid tint from the color's single solid price", () => {
    const tints = config();
    const result = resolveTint(tints, { type: "solid", colorId: brownId(tints), percent: 50 });
    expect(result?.error).toBeNull();
    expect(result?.priceCents).toBe(4000); // seeded flat solid price
    expect(result?.internalLabel).toBe("Brown Solid Tint — 50%");
  });

  it("prices a gradient tint from the color's single gradient price", () => {
    const tints = config();
    const result = resolveTint(tints, { type: "gradient", colorId: brownId(tints), percent: 70 });
    expect(result?.error).toBeNull();
    expect(result?.priceCents).toBe(5000); // seeded flat gradient price
  });

  it("price does not depend on percentage — the label changes but the price is identical", () => {
    const tints = config();
    const id = brownId(tints);
    const solid20 = resolveTint(tints, { type: "solid", colorId: id, percent: 20 });
    const solid80 = resolveTint(tints, { type: "solid", colorId: id, percent: 80 });
    expect(solid20?.priceCents).toBe(solid80?.priceCents);
    expect(solid20?.internalLabel).toBe("Brown Solid Tint — 20%");
    expect(solid80?.internalLabel).toBe("Brown Solid Tint — 80%");

    const grad30 = resolveTint(tints, { type: "gradient", colorId: id, percent: 30 });
    const grad90 = resolveTint(tints, { type: "gradient", colorId: id, percent: 90 });
    expect(grad30?.priceCents).toBe(grad90?.priceCents);
    expect(grad30?.internalLabel).toBe("Brown Gradient Tint — 30%");
    expect(grad90?.internalLabel).toBe("Brown Gradient Tint — 90%");
  });

  it("errors when the selected color is disabled", () => {
    const tints = config();
    const id = brownId(tints);
    tints.colors.find((c) => c.id === id)!.active = false;
    const result = resolveTint(tints, { type: "solid", colorId: id, percent: 50 });
    expect(result?.error).toBeTruthy();
  });

  it("errors when the tint type is not supported/enabled for the color", () => {
    const tints = config();
    const id = brownId(tints);
    tints.colors.find((c) => c.id === id)!.supportsGradient = false;
    const result = resolveTint(tints, { type: "gradient", colorId: id, percent: 70 });
    expect(result?.error).toBeTruthy();
  });

  it("errors when no color is selected", () => {
    const result = resolveTint(config(), { type: "solid", colorId: null, percent: 50 });
    expect(result?.error).toBeTruthy();
  });
});

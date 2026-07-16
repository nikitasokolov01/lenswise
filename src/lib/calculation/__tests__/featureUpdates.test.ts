import { describe, expect, it } from "vitest";
import { calculateQuote } from "@/lib/calculation/calculateQuote";
import { createDefaultQuoteInput } from "@/lib/calculation/defaultQuoteInput";
import { createDefaultConfiguration } from "@/lib/pricing/seedConfiguration";
import {
  compatibleMaterials,
  materialSupportsCombo,
  materialSupportsLensType,
} from "@/lib/calculation/materialCompatibility";
import type { PricingConfiguration, PrescriptionInput, QuoteInput } from "@/lib/types";

function getConfig(): PricingConfiguration {
  return createDefaultConfiguration();
}

function findByName<T extends { name: string }>(items: T[], name: string): T {
  const found = items.find((item) => item.name === name);
  if (!found) throw new Error(`Fixture not found: ${name}`);
  return found;
}

/** A prescription with a high cylinder on OD (beyond the default -2.00 threshold). */
function highCylinderRx(cylinder = -3): PrescriptionInput {
  return {
    od: { sphere: 0, cylinder, axis: 90, add: null },
    os: { sphere: 0, cylinder: 0, axis: null, add: null },
  };
}

/** Single Vision + Polycarbonate quote whose high cylinder qualifies surfacing. */
function qualifyingSurfacingInput(config: PricingConfiguration): QuoteInput {
  const singleVision = findByName(config.lensTypes, "Single Vision");
  const polycarbonate = findByName(config.materials, "Polycarbonate");
  const input = createDefaultQuoteInput(config);
  input.frame.retailPriceCents = 15000;
  input.lensTypeId = singleVision.id;
  input.materialId = polycarbonate.id;
  input.prescription = highCylinderRx();
  input.insurance.mode = "retail";
  return input;
}

describe("Custom Lens Surfacing (selectable, auto-recommend)", () => {
  it("auto-recommends and enables when a high-cylinder Rx qualifies", () => {
    const config = getConfig();
    const input = qualifyingSurfacingInput(config);

    const result = calculateQuote(input, config);

    expect(result.surfacingRecommended).toBe(true);
    expect(result.surfacingEnabled).toBe(true);
    expect(result.surfacingFeeCents).toBe(config.highCylinderSurfacingFeeCents);
    expect(result.lineItems.some((li) => li.label === "Custom Lens Surfacing")).toBe(true);
    expect(result.surfacingRecommendationNote).toBeTruthy();
  });

  it("does NOT re-enable after a manual disable (surfacingOverride=false), even while still recommended", () => {
    const config = getConfig();
    const input = qualifyingSurfacingInput(config);
    input.surfacingOverride = false;

    const result = calculateQuote(input, config);

    // Still recommended (the rule still qualifies)…
    expect(result.surfacingRecommended).toBe(true);
    // …but the optician's manual OFF sticks.
    expect(result.surfacingEnabled).toBe(false);
    expect(result.surfacingFeeCents).toBe(0);
    expect(result.lineItems.some((li) => li.label === "Custom Lens Surfacing")).toBe(false);
  });

  it("can be manually enabled with no qualifying rule, charging the configured base fee", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const polycarbonate = findByName(config.materials, "Polycarbonate");
    const input = createDefaultQuoteInput(config);
    input.frame.retailPriceCents = 15000;
    input.lensTypeId = singleVision.id;
    input.materialId = polycarbonate.id;
    input.prescription = null; // nothing qualifies
    input.surfacingOverride = true; // optician turns it on manually
    input.insurance.mode = "retail";

    const result = calculateQuote(input, config);

    expect(result.surfacingRecommended).toBe(false);
    expect(result.surfacingEnabled).toBe(true);
    expect(result.surfacingFeeCents).toBe(config.highCylinderSurfacingFeeCents);
    expect(result.lineItems.some((li) => li.label === "Custom Lens Surfacing")).toBe(true);
  });

  it("charges only ONE fee even though multiple rules could qualify", () => {
    const config = getConfig();
    const input = qualifyingSurfacingInput(config);

    const result = calculateQuote(input, config);

    const surfacingLines = result.lineItems.filter((li) => li.label === "Custom Lens Surfacing");
    expect(surfacingLines).toHaveLength(1);
  });
});

describe("Blue Light (independent configurable option)", () => {
  it("adds a blue_light line item at the configured retail price", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const polycarbonate = findByName(config.materials, "Polycarbonate");
    const filter = config.blueLightOptions.find((o) => o.id === "blue-light-filter")!;

    const input = createDefaultQuoteInput(config);
    input.frame.retailPriceCents = 15000;
    input.lensTypeId = singleVision.id;
    input.materialId = polycarbonate.id;
    input.blueLightId = filter.id;
    input.insurance.mode = "retail";

    const result = calculateQuote(input, config);

    const blueLightLine = result.lineItems.find((li) => li.category === "blue_light");
    expect(blueLightLine).toBeDefined();
    expect(blueLightLine?.amountCents).toBe(filter.retailPriceCents);
    expect(result.retailTotalCents).toBeGreaterThanOrEqual(filter.retailPriceCents);
  });

  it("adds nothing for the 'None' blue light option", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const polycarbonate = findByName(config.materials, "Polycarbonate");
    const none = config.blueLightOptions.find((o) => o.id === "blue-light-none")!;

    const input = createDefaultQuoteInput(config);
    input.frame.retailPriceCents = 15000;
    input.lensTypeId = singleVision.id;
    input.materialId = polycarbonate.id;
    input.blueLightId = none.id;
    input.insurance.mode = "retail";

    const result = calculateQuote(input, config);
    expect(result.lineItems.some((li) => li.category === "blue_light")).toBe(false);
  });
});

describe("Material compatibility", () => {
  it("treats an empty compatibility list as compatible with everything (back-compat)", () => {
    const config = getConfig();
    const material = config.materials[0];
    material.compatibleLensTypeIds = [];
    const anyLensTypeId = config.lensTypes[0].id;
    expect(materialSupportsLensType(material, anyLensTypeId)).toBe(true);
  });

  it("restricts a material to only the lens types it lists", () => {
    const config = getConfig();
    const material = config.materials[0];
    const [allowed, blocked] = config.lensTypes;
    material.compatibleLensTypeIds = [allowed.id];
    expect(materialSupportsLensType(material, allowed.id)).toBe(true);
    expect(materialSupportsLensType(material, blocked.id)).toBe(false);
  });

  it("compatibleMaterials filters out materials that do not support the chosen lens type", () => {
    const config = getConfig();
    const lensType = config.lensTypes[0];
    const otherLensType = config.lensTypes[1];
    // Constrain the first material to a DIFFERENT lens type so it is excluded.
    config.materials[0].compatibleLensTypeIds = [otherLensType.id];

    const available = compatibleMaterials(config.materials, lensType, undefined);
    expect(available.some((m) => m.id === config.materials[0].id)).toBe(false);
    // Materials with an empty list remain available.
    expect(available.length).toBeGreaterThan(0);
  });

  it("materialSupportsCombo requires BOTH lens type and progressive design to be allowed", () => {
    const config = getConfig();
    const material = config.materials[0];
    const lensType = config.lensTypes[0];
    material.compatibleLensTypeIds = [lensType.id];
    material.compatibleProgressiveDesignIds = []; // all progressive designs allowed
    expect(materialSupportsCombo(material, lensType, undefined)).toBe(true);

    material.compatibleLensTypeIds = [config.lensTypes[1].id]; // now the lens type is disallowed
    expect(materialSupportsCombo(material, lensType, undefined)).toBe(false);
  });
});

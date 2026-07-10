import { describe, expect, it } from "vitest";
import { calculateQuote } from "@/lib/calculation/calculateQuote";
import { createDefaultQuoteInput } from "@/lib/calculation/defaultQuoteInput";
import { createDefaultConfiguration } from "@/lib/pricing/seedConfiguration";
import type { PricingConfiguration, QuoteInput } from "@/lib/types";

function getConfig(): PricingConfiguration {
  return createDefaultConfiguration();
}

function findByName<T extends { name: string }>(items: T[], name: string): T {
  const found = items.find((item) => item.name === name);
  if (!found) throw new Error(`Fixture not found: ${name}`);
  return found;
}

function baseInput(config: PricingConfiguration): QuoteInput {
  return createDefaultQuoteInput(config);
}

describe("calculateQuote", () => {
  it("1. computes a basic retail (self-pay) quote", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const polycarbonate = findByName(config.materials, "Polycarbonate");
    const stockAr = findByName(config.coatings, "Stock AR");

    const input = baseInput(config);
    input.frame.retailPriceCents = 15000;
    input.lensTypeId = singleVision.id;
    input.materialId = polycarbonate.id;
    input.coatingId = stockAr.id;
    input.insurance.mode = "retail";

    const result = calculateQuote(input, config);

    // frame 15000 + Single Vision / Polycarbonate lens price 10000 + stock ar 5000
    expect(result.retailTotalCents).toBe(15000 + 10000 + 5000);
    expect(result.discountTotalCents).toBe(0);
    expect(result.insuranceContributionCents).toBe(0);
    expect(result.patientResponsibilityCents).toBe(result.retailTotalCents);
    expect(result.lineItems.some((li) => li.category === "frame")).toBe(true);
    expect(result.lineItems.some((li) => li.category === "lens" && li.label.includes("Single Vision"))).toBe(true);
  });

  it("2. computes a frame-only quote and excludes all lens-related controls", () => {
    const config = getConfig();
    const frameOnly = findByName(config.lensTypes, "Frame Only");
    const polycarbonate = findByName(config.materials, "Polycarbonate");

    const input = baseInput(config);
    input.frame.retailPriceCents = 20000;
    input.lensTypeId = frameOnly.id;
    // Even though a material is selected, Frame Only must ignore it entirely.
    input.materialId = polycarbonate.id;
    input.insurance.mode = "retail";

    const result = calculateQuote(input, config);

    expect(result.retailTotalCents).toBe(20000);
    expect(result.lineItems.some((li) => li.category === "lens")).toBe(false);
    expect(result.patientResponsibilityCents).toBe(20000);
  });

  it("3. applies insurance allowances and reports unused allowance separately", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const cr39 = findByName(config.materials, "CR-39");

    const input = baseInput(config);
    input.frame.retailPriceCents = 15000;
    input.frame.insuranceAllowanceCents = 13000;
    input.lensTypeId = singleVision.id;
    input.materialId = cr39.id;
    input.insurance.mode = "allowances";
    input.insurance.allowances.lensAllowanceCents = 5000;
    input.insurance.allowances.additionalCreditCents = 0;

    const result = calculateQuote(input, config);

    // retail = frame 15000 + Single Vision / CR-39 lens 6500 = 21500
    expect(result.retailTotalCents).toBe(21500);
    expect(result.allowanceBreakdown?.frameAllowanceAppliedCents).toBe(13000);
    expect(result.allowanceBreakdown?.lensAllowanceAppliedCents).toBe(5000);
    expect(result.insuranceContributionCents).toBe(18000);
    expect(result.patientResponsibilityCents).toBe(21500 - 18000);
    expect(result.unusedAllowanceCents).toBe(0);
  });

  it("3b. shows unused allowance when an allowance exceeds its eligible charge", () => {
    const config = getConfig();
    const frameOnly = findByName(config.lensTypes, "Frame Only");

    const input = baseInput(config);
    input.frame.retailPriceCents = 8000;
    input.frame.insuranceAllowanceCents = 13000; // exceeds the 8000 frame charge
    input.lensTypeId = frameOnly.id;
    input.insurance.mode = "allowances";

    const result = calculateQuote(input, config);

    expect(result.allowanceBreakdown?.frameAllowanceAppliedCents).toBe(8000);
    expect(result.allowanceBreakdown?.frameAllowanceUnusedCents).toBe(5000);
    expect(result.unusedAllowanceCents).toBe(5000);
    expect(result.patientResponsibilityCents).toBe(0);
  });

  it("4. applies insurance copays with per-item coverage classification", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const cr39 = findByName(config.materials, "CR-39");

    const input = baseInput(config);
    input.frame.retailPriceCents = 15000;
    input.frame.copayCents = 4000;
    input.lensTypeId = singleVision.id;
    input.materialId = cr39.id;
    input.insurance.mode = "copays";
    input.insurance.copays.lensCopayCents = 1000;

    const result = calculateQuote(input, config);

    // frame: patient pays 4000 copay (contribution 11000)
    // lens (Single Vision / CR-39, retail 6500): patient pays 1000 copay (contribution 5500)
    expect(result.patientResponsibilityCents).toBe(4000 + 1000);
    expect(result.insuranceContributionCents).toBe(11000 + 5500);
  });

  it("4b. marks an item as non-covered so the patient pays its full retail value", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const cr39 = findByName(config.materials, "CR-39");
    const crizalRock = findByName(config.coatings, "Crizal Rock");

    const input = baseInput(config);
    input.frame.retailPriceCents = 0;
    input.lensTypeId = singleVision.id;
    input.materialId = cr39.id;
    input.coatingId = crizalRock.id;
    input.insurance.mode = "copays";
    input.insurance.copays.lensCoverage = "included";
    input.insurance.copays.coatingCoverage = "noncovered";

    const result = calculateQuote(input, config);

    // lens included -> $0 patient portion; coating non-covered -> full 13500 retail
    expect(result.patientResponsibilityCents).toBe(13500);
  });

  it("5. applies fixed and percentage discounts", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const cr39 = findByName(config.materials, "CR-39");

    const input = baseInput(config);
    input.frame.retailPriceCents = 10000;
    input.lensTypeId = singleVision.id;
    input.materialId = cr39.id;
    input.insurance.mode = "retail";
    input.adjustments = [
      { id: "adj-1", type: "fixed_discount", amountCents: 2000, percent: 0, label: "Loyalty discount" },
      { id: "adj-2", type: "percent_discount", amountCents: 0, percent: 10, label: "Seasonal promotion" },
    ];

    const result = calculateQuote(input, config);

    // retail = 10000 + 6500 = 16500; percent discount computed on 16500 = 1650
    expect(result.retailTotalCents).toBe(16500);
    expect(result.discountTotalCents).toBe(2000 + 1650);
    expect(result.patientResponsibilityCents).toBe(16500 - 2000 - 1650);
  });

  it("6. never lets patient responsibility fall below zero", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const cr39 = findByName(config.materials, "CR-39");

    const input = baseInput(config);
    input.frame.retailPriceCents = 5000;
    input.lensTypeId = singleVision.id;
    input.materialId = cr39.id;
    input.insurance.mode = "retail";
    input.adjustments = [
      { id: "adj-1", type: "fixed_discount", amountCents: 999999, percent: 0, label: "Manager discount" },
    ];

    const result = calculateQuote(input, config);

    expect(result.patientResponsibilityCents).toBe(0);
  });

  it("7. Single Vision + Transitions Gen S + Gray does not add a surfacing fee", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const transitions = findByName(config.photochromicProducts, "Transitions Gen S");
    const gray = findByName(config.photochromicColors, "Gray");

    const input = baseInput(config);
    input.lensTypeId = singleVision.id;
    input.photochromic.productId = transitions.id;
    input.photochromic.colorId = gray.id;

    const result = calculateQuote(input, config);

    expect(result.lineItems.some((li) => li.category === "fee")).toBe(false);
  });

  it("8. Single Vision + Transitions Gen S + Brown does not add a surfacing fee", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const transitions = findByName(config.photochromicProducts, "Transitions Gen S");
    const brown = findByName(config.photochromicColors, "Brown");

    const input = baseInput(config);
    input.lensTypeId = singleVision.id;
    input.photochromic.productId = transitions.id;
    input.photochromic.colorId = brown.id;

    const result = calculateQuote(input, config);

    expect(result.lineItems.some((li) => li.category === "fee")).toBe(false);
  });

  it("9. Single Vision + Transitions Gen S + Sapphire adds the configured surfacing fee", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const transitions = findByName(config.photochromicProducts, "Transitions Gen S");
    const sapphire = findByName(config.photochromicColors, "Sapphire");

    const input = baseInput(config);
    input.lensTypeId = singleVision.id;
    input.photochromic.productId = transitions.id;
    input.photochromic.colorId = sapphire.id;

    const result = calculateQuote(input, config);

    const feeItem = result.lineItems.find((li) => li.category === "fee");
    expect(feeItem).toBeDefined();
    expect(feeItem?.label).toBe("Transitions custom-color surfacing fee");
    expect(feeItem?.amountCents).toBe(config.transitionsSurfacingFeeCents);
  });

  it("10. Progressive + Transitions Gen S + Sapphire does not add the single-vision surfacing fee", () => {
    const config = getConfig();
    const progressive = findByName(config.lensTypes, "Progressive");
    const transitions = findByName(config.photochromicProducts, "Transitions Gen S");
    const sapphire = findByName(config.photochromicColors, "Sapphire");

    const input = baseInput(config);
    input.lensTypeId = progressive.id;
    input.photochromic.productId = transitions.id;
    input.photochromic.colorId = sapphire.id;

    const result = calculateQuote(input, config);

    expect(result.lineItems.some((li) => li.category === "fee")).toBe(false);
  });

  it("11. supports a manual override of the final patient responsibility", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const cr39 = findByName(config.materials, "CR-39");

    const input = baseInput(config);
    input.frame.retailPriceCents = 15000;
    input.lensTypeId = singleVision.id;
    input.materialId = cr39.id;
    input.insurance.mode = "manual";
    input.insurance.manualOverride.finalPatientResponsibilityCents = 9999;
    input.insurance.manualOverride.note = "Manager-approved package price";

    const result = calculateQuote(input, config);

    expect(result.isManualOverride).toBe(true);
    expect(result.patientResponsibilityCents).toBe(9999);
    expect(result.overrideNote).toBe("Manager-approved package price");
    expect(result.preOverridePatientResponsibilityCents).toBe(15000 + 6500);
  });

  it("12. cannot price a disabled product even if it is somehow still referenced", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const polycarbonate = findByName(config.materials, "Polycarbonate");
    polycarbonate.active = false; // simulate an admin disabling this material mid-session

    const input = baseInput(config);
    input.lensTypeId = singleVision.id;
    input.materialId = polycarbonate.id;

    const result = calculateQuote(input, config);

    // No material is available to price the lens, so no "lens" line item
    // should be produced even though a lens type was selected.
    expect(result.lineItems.some((li) => li.category === "lens")).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("13. prices Progressive lenses using the lens type + progressive design + material combination", () => {
    const config = getConfig();
    const progressive = findByName(config.lensTypes, "Progressive");
    const premiumDesign = findByName(config.progressiveDesigns, "Premium Progressive");
    const polycarbonate = findByName(config.materials, "Polycarbonate");

    const input = baseInput(config);
    input.lensTypeId = progressive.id;
    input.progressiveDesignId = premiumDesign.id;
    input.materialId = polycarbonate.id;
    input.insurance.mode = "retail";

    const result = calculateQuote(input, config);

    const lensItem = result.lineItems.find((li) => li.category === "lens");
    expect(lensItem).toBeDefined();
    // Seeded Progressive + Premium Progressive + Polycarbonate price.
    expect(lensItem?.amountCents).toBe(34500);
    expect(result.retailTotalCents).toBe(34500);
    expect(result.warnings.length).toBe(0);
  });

  it("14. does not price Progressive lenses until a progressive design is selected", () => {
    const config = getConfig();
    const progressive = findByName(config.lensTypes, "Progressive");
    const polycarbonate = findByName(config.materials, "Polycarbonate");

    const input = baseInput(config);
    input.lensTypeId = progressive.id;
    input.progressiveDesignId = null;
    input.materialId = polycarbonate.id;

    const result = calculateQuote(input, config);

    expect(result.lineItems.some((li) => li.category === "lens")).toBe(false);
    expect(result.warnings.some((w) => w.toLowerCase().includes("progressive design"))).toBe(true);
  });
});

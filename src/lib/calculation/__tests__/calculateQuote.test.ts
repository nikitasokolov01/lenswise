import { describe, expect, it } from "vitest";
import { calculateQuote } from "@/lib/calculation/calculateQuote";
import { createDefaultQuoteInput } from "@/lib/calculation/defaultQuoteInput";
import { createDefaultConfiguration } from "@/lib/pricing/seedConfiguration";
import type { PricingConfiguration, PrescriptionInput, QuoteInput } from "@/lib/types";

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

/** Builds a minimal valid applied prescription: only the given eye gets a non-zero cylinder (with a matching axis). */
function prescriptionWithCylinder(eye: "od" | "os", cylinder: number, axis = 90): PrescriptionInput {
  const blankEye = { sphere: 0, cylinder: 0, axis: null, add: null };
  const affectedEye = { sphere: 0, cylinder, axis: cylinder === 0 ? null : axis, add: null };
  return eye === "od" ? { od: affectedEye, os: blankEye } : { od: blankEye, os: affectedEye };
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
    expect(result.copayTotalCents).toBe(0);
    expect(result.patientResponsibilityCents).toBe(result.retailTotalCents);
    expect(result.lineItems.some((li) => li.category === "frame")).toBe(true);
    expect(result.lineItems.some((li) => li.category === "lens" && li.label.includes("Single Vision"))).toBe(true);
  });

  it("2. computes a frame-only quote and excludes all lens-related controls", () => {
    const config = getConfig();
    const polycarbonate = findByName(config.materials, "Polycarbonate");

    const input = baseInput(config);
    input.frame.retailPriceCents = 20000;
    input.orderType = "frame_only";
    // Even though a material is somehow still referenced, Frame Only must ignore it entirely.
    input.materialId = polycarbonate.id;
    input.insurance.mode = "retail";

    const result = calculateQuote(input, config);

    expect(result.retailTotalCents).toBe(20000);
    expect(result.lineItems.some((li) => li.category === "lens")).toBe(false);
    expect(result.patientResponsibilityCents).toBe(20000);
  });

  it("2b. Lens Only excludes the frame charge and the frame copay, but still requires a real lens type + material", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const cr39 = findByName(config.materials, "CR-39");

    const input = baseInput(config);
    input.orderType = "lens_only";
    input.frame.retailPriceCents = 25000; // must be ignored entirely for Lens Only
    input.lensTypeId = singleVision.id;
    input.materialId = cr39.id;
    input.insurance.mode = "insurance";
    input.insurance.coverage.lensCoverage = { type: "copay", amountCents: 0 };
    input.insurance.coverage.frameCoverage = { type: "copay", amountCents: 2500 }; // must be excluded — there is no frame on this order

    const result = calculateQuote(input, config);

    expect(result.lineItems.some((li) => li.category === "frame")).toBe(false);
    expect(result.lineItems.some((li) => li.category === "lens")).toBe(true);
    expect(result.retailTotalCents).toBe(6500);
    expect(result.copayTotalCents).toBe(0);
  });

  it("3. Use Insurance mode: a retail-billed frame is offset by its allowance while a lens copay replaces the lens retail", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const cr39 = findByName(config.materials, "CR-39");

    const input = baseInput(config);
    input.frame.retailPriceCents = 30000;
    input.lensTypeId = singleVision.id;
    input.materialId = cr39.id;
    input.insurance.mode = "insurance";
    // Frame billed at retail so its allowance offsets it (patient pays the overage).
    input.insurance.coverage.frameCoverage = { type: "retail" };
    input.insurance.coverage.frameAllowanceCents = 15000;
    // Lens copay REPLACES the 6500 lens retail — the patient owes the copay,
    // insurance covers the remainder; the copay is never added on top.
    input.insurance.coverage.lensCoverage = { type: "copay", amountCents: 2500 };
    input.insurance.coverage.materialCoverage = { type: "copay", amountCents: 0 };
    input.insurance.coverage.lensAllowanceCents = 0;

    const result = calculateQuote(input, config);

    // retail = frame 30000 + Single Vision / CR-39 lens 6500 = 36500
    expect(result.retailTotalCents).toBe(36500);
    // frame allowance applied in full (15000 < 30000 retail); frame patient balance 15000
    expect(result.allowanceBreakdown?.frameAllowanceAppliedCents).toBe(15000);
    expect(result.allowanceBreakdown?.frameAllowanceUnusedCents).toBe(0);
    // only the lens copay is owed by the patient
    expect(result.copayTotalCents).toBe(2500);
    // insurance = frame allowance 15000 + the lens copay's insurance portion (6500 - 2500 = 4000)
    expect(result.insuranceContributionCents).toBe(15000 + 4000);
    // patient = frame overage 15000 + lens copay 2500
    expect(result.patientResponsibilityCents).toBe(17500);
    // itemized breakdown surfaces each piece independently
    expect(result.insuranceBreakdown?.frameAllowanceAppliedCents).toBe(15000);
    expect(result.insuranceBreakdown?.lensCopayCents).toBe(2500);
  });

  it("3b. shows unused allowance separately when an allowance exceeds its eligible charge", () => {
    const config = getConfig();

    const input = baseInput(config);
    input.frame.retailPriceCents = 8000;
    input.orderType = "frame_only";
    input.insurance.mode = "insurance";
    input.insurance.coverage.frameAllowanceCents = 13000; // exceeds the 8000 frame charge

    const result = calculateQuote(input, config);

    expect(result.allowanceBreakdown?.frameAllowanceAppliedCents).toBe(8000);
    expect(result.allowanceBreakdown?.frameAllowanceUnusedCents).toBe(5000);
    expect(result.unusedAllowanceCents).toBe(5000);
    expect(result.patientResponsibilityCents).toBe(0);
  });

  it("4. applies an 'other non-covered charge' in addition to copays and allowances", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const cr39 = findByName(config.materials, "CR-39");

    const input = baseInput(config);
    input.frame.retailPriceCents = 0;
    input.lensTypeId = singleVision.id;
    input.materialId = cr39.id;
    input.insurance.mode = "insurance";
    // Bill the lens at retail (clear the seeded per-price copay override) so
    // the patient owes the full lens retail and the extra charges stack on it.
    const priceEntry = cr39.prices.find((p) => p.lensTypeId === singleVision.id && !p.progressiveDesignId);
    if (priceEntry) priceEntry.insuranceCoverage = { type: "retail" };
    input.insurance.coverage.lensCoverage = { type: "retail" };
    input.insurance.coverage.materialCoverage = { type: "retail" };
    input.insurance.coverage.otherChargeCents = 1200;
    input.insurance.coverage.otherCopayCents = 300;

    const result = calculateQuote(input, config);

    expect(result.nonCoveredChargeCents).toBe(1200);
    expect(result.copayTotalCents).toBe(300);
    // retail 6500, no allowances -> patient owes the full retail plus the extra charges
    expect(result.patientResponsibilityCents).toBe(6500 + 1200 + 300);
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
    expect(result.surfacingFeeReasons.length).toBe(0);
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
    expect(feeItem?.label).toBe("Custom Lens Surfacing");
    expect(feeItem?.amountCents).toBe(config.transitionsSurfacingFeeCents);
    expect(result.surfacingFeeReasons).toHaveLength(1);
    expect(result.surfacingFeeReasons[0].charged).toBe(true);
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

  it("11. supports a manual final price override", () => {
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

  it("13. prices Progressive lenses using the lens type + progressive design + material combination, and names the design correctly", () => {
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
    // The progressive design name must appear correctly in the line-item label.
    expect(lensItem?.label).toBe("Progressive Lenses — Premium Progressive");
    expect(lensItem?.description).toBe("Polycarbonate");
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

  it("15. adds the high-cylinder surfacing fee for an applicable (non-high-index) material with a qualifying cylinder", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const polycarbonate = findByName(config.materials, "Polycarbonate");
    expect(polycarbonate.appliesToHighCylinderSurfacing).toBe(true);
    expect(polycarbonate.isHighIndex).toBe(false);

    const input = baseInput(config);
    input.lensTypeId = singleVision.id;
    input.materialId = polycarbonate.id;
    input.prescription = prescriptionWithCylinder("od", -2.25);

    const result = calculateQuote(input, config);

    const feeItem = result.lineItems.find((li) => li.category === "fee");
    expect(feeItem).toBeDefined();
    expect(feeItem?.label).toBe("Custom Lens Surfacing");
    expect(feeItem?.amountCents).toBe(config.highCylinderSurfacingFeeCents);
    expect(result.surfacingFeeReasons).toHaveLength(1);
    expect(result.surfacingFeeReasons[0].key).toBe("high_cylinder_surfacing");
    expect(result.surfacingFeeReasons[0].charged).toBe(true);
    // A definite (not "possible") warning is surfaced automatically.
    expect(result.warnings.some((w) => w.startsWith("High-cylinder prescription detected."))).toBe(true);
  });

  it("15b. does not add the high-cylinder surfacing fee when no prescription has been applied", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const polycarbonate = findByName(config.materials, "Polycarbonate");

    const input = baseInput(config);
    input.lensTypeId = singleVision.id;
    input.materialId = polycarbonate.id;
    // input.prescription is left at its default of null (no applied prescription).

    const result = calculateQuote(input, config);

    expect(result.lineItems.some((li) => li.category === "fee")).toBe(false);
    expect(result.surfacingFeeReasons).toHaveLength(0);
  });

  it("15c. -1.75 does not qualify but -2.00 does at the default -2.00 threshold", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const polycarbonate = findByName(config.materials, "Polycarbonate");
    expect(config.highCylinderThresholdDiopters).toBe(-2);

    const belowInput = baseInput(config);
    belowInput.lensTypeId = singleVision.id;
    belowInput.materialId = polycarbonate.id;
    belowInput.prescription = prescriptionWithCylinder("od", -1.75);
    expect(calculateQuote(belowInput, config).lineItems.some((li) => li.category === "fee")).toBe(false);

    const atInput = baseInput(config);
    atInput.lensTypeId = singleVision.id;
    atInput.materialId = polycarbonate.id;
    atInput.prescription = prescriptionWithCylinder("od", -2.0);
    expect(calculateQuote(atInput, config).lineItems.some((li) => li.category === "fee")).toBe(true);
  });

  it("15d. High Index never receives the prescription-based high-cylinder surfacing fee", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const hiIndex = findByName(config.materials, "High Index 1.67");
    expect(hiIndex.isHighIndex).toBe(true);

    const input = baseInput(config);
    input.lensTypeId = singleVision.id;
    input.materialId = hiIndex.id;
    input.prescription = prescriptionWithCylinder("od", -3.0);

    const result = calculateQuote(input, config);

    expect(result.lineItems.some((li) => li.category === "fee")).toBe(false);
    expect(result.surfacingFeeReasons).toHaveLength(0);
  });

  it("15e. Bifocal (like Single Vision) receives the high-cylinder surfacing fee", () => {
    const config = getConfig();
    const bifocal = findByName(config.lensTypes, "Bifocal");
    const polycarbonate = findByName(config.materials, "Polycarbonate");

    const input = baseInput(config);
    input.lensTypeId = bifocal.id;
    input.materialId = polycarbonate.id;
    input.prescription = prescriptionWithCylinder("os", -2.5);

    const result = calculateQuote(input, config);

    expect(result.lineItems.some((li) => li.category === "fee")).toBe(true);
  });

  it("16. does not apply the high-cylinder surfacing fee to Progressive lenses", () => {
    const config = getConfig();
    const progressive = findByName(config.lensTypes, "Progressive");
    const premiumDesign = findByName(config.progressiveDesigns, "Premium Progressive");
    const polycarbonate = findByName(config.materials, "Polycarbonate");

    const input = baseInput(config);
    input.lensTypeId = progressive.id;
    input.progressiveDesignId = premiumDesign.id;
    input.materialId = polycarbonate.id;
    input.prescription = prescriptionWithCylinder("od", -3.0);

    const result = calculateQuote(input, config);

    expect(result.lineItems.some((li) => li.category === "fee")).toBe(false);
    expect(result.surfacingFeeReasons).toHaveLength(0);
  });

  it("17. does not apply the high-cylinder surfacing fee for a material not flagged as needing it", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const cr39 = findByName(config.materials, "CR-39");
    expect(cr39.appliesToHighCylinderSurfacing).toBe(false);

    const input = baseInput(config);
    input.lensTypeId = singleVision.id;
    input.materialId = cr39.id;
    input.prescription = prescriptionWithCylinder("os", -2.5);

    const result = calculateQuote(input, config);

    expect(result.lineItems.some((li) => li.category === "fee")).toBe(false);
  });

  it("18. Transitions custom-color and high-cylinder surfacing fees never stack — only the higher amount is charged, but both reasons are preserved", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const polycarbonate = findByName(config.materials, "Polycarbonate");
    const transitions = findByName(config.photochromicProducts, "Transitions Gen S");
    const sapphire = findByName(config.photochromicColors, "Sapphire");

    // highCylinderSurfacingFeeCents (4500) > transitionsSurfacingFeeCents (3000) in seed data.
    expect(config.highCylinderSurfacingFeeCents).toBeGreaterThan(config.transitionsSurfacingFeeCents);

    const input = baseInput(config);
    input.lensTypeId = singleVision.id;
    input.materialId = polycarbonate.id;
    input.prescription = prescriptionWithCylinder("od", -2.5);
    input.photochromic.productId = transitions.id;
    input.photochromic.colorId = sapphire.id;

    const result = calculateQuote(input, config);

    const feeItems = result.lineItems.filter((li) => li.category === "fee");
    expect(feeItems).toHaveLength(1);
    expect(feeItems[0].amountCents).toBe(config.highCylinderSurfacingFeeCents);

    expect(result.surfacingFeeReasons).toHaveLength(2);
    const highCylinderReason = result.surfacingFeeReasons.find((r) => r.key === "high_cylinder_surfacing");
    const transitionsReason = result.surfacingFeeReasons.find((r) => r.key === "transitions_custom_color");
    expect(highCylinderReason?.charged).toBe(true);
    expect(transitionsReason?.charged).toBe(false);
  });

  it("19. when the Transitions fee is configured higher than the high-cylinder fee, the Transitions fee wins instead", () => {
    const config = getConfig();
    config.transitionsSurfacingFeeCents = 9000;
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const polycarbonate = findByName(config.materials, "Polycarbonate");
    const transitions = findByName(config.photochromicProducts, "Transitions Gen S");
    const sapphire = findByName(config.photochromicColors, "Sapphire");

    const input = baseInput(config);
    input.lensTypeId = singleVision.id;
    input.materialId = polycarbonate.id;
    input.prescription = prescriptionWithCylinder("od", -2.5);
    input.photochromic.productId = transitions.id;
    input.photochromic.colorId = sapphire.id;

    const result = calculateQuote(input, config);

    const feeItems = result.lineItems.filter((li) => li.category === "fee");
    expect(feeItems).toHaveLength(1);
    expect(feeItems[0].amountCents).toBe(9000);
    expect(feeItems[0].label).toBe("Custom Lens Surfacing");

    const highCylinderReason = result.surfacingFeeReasons.find((r) => r.key === "high_cylinder_surfacing");
    expect(highCylinderReason?.charged).toBe(false);
  });

  it("20. prescription values are part of QuoteInput only — never part of PricingConfiguration", () => {
    const config = getConfig();
    // PricingConfiguration legitimately has field NAMES containing "cylinder"
    // (e.g. highCylinderSurfacingFeeCents, appliesToHighCylinderSurfacing) —
    // those are fee/flag settings, not prescription data. What must never
    // appear anywhere in PricingConfiguration is an actual prescription
    // field name such as "prescription", "sphere", "axis", or "od"/"os".
    const disallowedKeyNames = ["prescription", "sphere", "axis", "od", "os"];

    function collectKeys(value: unknown, keys: Set<string>) {
      if (Array.isArray(value)) {
        for (const item of value) collectKeys(item, keys);
      } else if (value && typeof value === "object") {
        for (const [key, nested] of Object.entries(value)) {
          keys.add(key.toLowerCase());
          collectKeys(nested, keys);
        }
      }
    }

    const allKeys = new Set<string>();
    collectKeys(config, allKeys);

    for (const disallowed of disallowedKeyNames) {
      expect(allKeys.has(disallowed)).toBe(false);
    }
  });

  it("21. a fresh quote defaults to Complete Pair with no lens type/material and no applied prescription", () => {
    const config = getConfig();
    const input = baseInput(config);

    expect(input.orderType).toBe("complete_pair");
    expect(input.lensTypeId).toBeNull();
    expect(input.materialId).toBeNull();
    expect(input.prescription).toBeNull();
  });

  it("22. the high-cylinder qualifying threshold is read from Admin Pricing configuration, not a hardcoded constant", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const polycarbonate = findByName(config.materials, "Polycarbonate");

    // An office tightens its threshold to -1.50 (previously only -2.00 or
    // higher in magnitude qualified) — a prescription that would NOT have
    // triggered the fee under the old hardcoded -2.00 constant must now
    // trigger it, proving the rule reads config.highCylinderThresholdDiopters
    // live rather than a fixed value.
    config.highCylinderThresholdDiopters = -1.5;

    const input = baseInput(config);
    input.lensTypeId = singleVision.id;
    input.materialId = polycarbonate.id;
    input.prescription = prescriptionWithCylinder("od", -1.75);

    const result = calculateQuote(input, config);

    const feeItem = result.lineItems.find((li) => li.category === "fee");
    expect(feeItem).toBeDefined();
    expect(feeItem?.amountCents).toBe(config.highCylinderSurfacingFeeCents);
  });

  it("23. the quote-level lens coverage is authoritative — a per-material-price insuranceCoverage override does NOT override the optician's Retail selection", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const cr39 = findByName(config.materials, "CR-39");

    // The matched price carries a copay override; the quote-level Retail
    // selection must win, so the lens is billed at full retail with no copay.
    const priceEntry = cr39.prices.find((p) => p.lensTypeId === singleVision.id && !p.progressiveDesignId);
    expect(priceEntry).toBeDefined();
    if (priceEntry) priceEntry.insuranceCoverage = { type: "copay", amountCents: 500 };

    const input = baseInput(config);
    input.frame.retailPriceCents = 0;
    input.lensTypeId = singleVision.id;
    input.materialId = cr39.id;
    input.insurance.mode = "insurance";
    input.insurance.coverage.frameCoverage = { type: "retail" };
    input.insurance.coverage.lensCoverage = { type: "retail" };
    input.insurance.coverage.coatingCoverage = { type: "retail" };
    input.insurance.coverage.photochromicCoverage = { type: "retail" };

    const result = calculateQuote(input, config);

    // Override ignored: no copay, and the full 6500 lens retail is the patient's.
    expect(result.copayTotalCents).toBe(0);
    expect(result.patientResponsibilityCents).toBe(6500);
  });

  it("23b. quote-level Covered marks the lens fully covered — distinct from a $0 copay", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const cr39 = findByName(config.materials, "CR-39");

    const input = baseInput(config);
    input.frame.retailPriceCents = 0;
    input.lensTypeId = singleVision.id;
    input.materialId = cr39.id;
    input.insurance.mode = "insurance";
    input.insurance.coverage.frameCoverage = { type: "retail" };
    input.insurance.coverage.lensCoverage = { type: "covered" };
    input.insurance.coverage.coatingCoverage = { type: "retail" };
    input.insurance.coverage.photochromicCoverage = { type: "retail" };

    const result = calculateQuote(input, config);

    // Fully covered: no copay owed, AND the 6500 lens retail is paid by
    // insurance rather than the patient.
    expect(result.copayTotalCents).toBe(0);
    expect(result.patientResponsibilityCents).toBe(0);
    expect(result.insuranceContributionCents).toBeGreaterThanOrEqual(6500);
    expect(result.insuranceBreakdown?.lensCoveredCents).toBe(6500);
  });

  it("23c. a copay REPLACES the lens retail — the patient owes the copay and insurance covers the remainder, never copay-plus-retail", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const cr39 = findByName(config.materials, "CR-39");

    const input = baseInput(config);
    input.frame.retailPriceCents = 0;
    input.lensTypeId = singleVision.id;
    input.materialId = cr39.id;
    input.insurance.mode = "insurance";
    input.insurance.coverage.frameCoverage = { type: "retail" };
    // A $20 copay on the 6500 lens: patient owes 2000, insurance covers 4500.
    input.insurance.coverage.lensCoverage = { type: "copay", amountCents: 2000 };
    input.insurance.coverage.coatingCoverage = { type: "retail" };
    input.insurance.coverage.photochromicCoverage = { type: "retail" };
    input.insurance.coverage.lensAllowanceCents = 0;
    input.insurance.coverage.otherCopayCents = 0;

    const result = calculateQuote(input, config);

    expect(result.copayTotalCents).toBe(2000);
    // Patient owes ONLY the copay — the 6500 lens retail is not added on top.
    expect(result.patientResponsibilityCents).toBe(2000);
    // Insurance picks up the rest of the lens retail (6500 - 2000).
    expect(result.insuranceContributionCents).toBe(4500);
    expect(result.insuranceBreakdown?.lensCopayCents).toBe(2000);
  });

  it("24. reproduction: under Use Insurance, retail-billed lens/coating/photochromic all appear in patient responsibility, the frame allowance offsets the frame, and the surfacing fee is charged", () => {
    const config = getConfig();
    const singleVision = findByName(config.lensTypes, "Single Vision");
    const polycarbonate = findByName(config.materials, "Polycarbonate");
    const stockAr = findByName(config.coatings, "Stock AR");
    const houseGray = findByName(config.photochromicProducts, "House Photochromic Gray");

    const input = baseInput(config);
    input.frame.retailPriceCents = 20000;
    input.lensTypeId = singleVision.id;
    input.materialId = polycarbonate.id;
    input.coatingId = stockAr.id;
    input.photochromic.productId = houseGray.id;
    input.prescription = prescriptionWithCylinder("od", -2.25); // qualifies for surfacing
    input.insurance.mode = "insurance";
    input.insurance.coverage.frameCoverage = { type: "retail" };
    input.insurance.coverage.frameAllowanceCents = 13000;
    input.insurance.coverage.lensCoverage = { type: "retail" };
    input.insurance.coverage.coatingCoverage = { type: "retail" };
    input.insurance.coverage.photochromicCoverage = { type: "retail" };
    input.insurance.coverage.lensAllowanceCents = 0;
    input.insurance.coverage.additionalAllowanceCents = 0;

    const result = calculateQuote(input, config);

    // Surfacing fee is present as a definite "Custom Lens Surfacing" line.
    const surfacing = result.lineItems.find((li) => li.category === "fee");
    expect(surfacing?.label).toBe("Custom Lens Surfacing");

    // retail = frame 20000 + SV/Poly 10000 + Stock AR 5000 + House Gray 7500 + surfacing 4500
    expect(result.retailTotalCents).toBe(20000 + 10000 + 5000 + 7500 + 4500);
    // Frame allowance applied; nothing covered or copaid.
    expect(result.insuranceBreakdown?.frameAllowanceAppliedCents).toBe(13000);
    expect(result.copayTotalCents).toBe(0);
    // Patient owes everything at retail, less the frame allowance.
    expect(result.patientResponsibilityCents).toBe(47000 - 13000);
  });
});

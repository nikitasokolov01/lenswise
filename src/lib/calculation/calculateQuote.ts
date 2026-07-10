import { generateId } from "@/lib/id";
import { clampNonNegative, sumCents } from "@/lib/money";
import { conditionalFeeRules } from "@/lib/calculation/rules";
import { findMaterialPrice } from "@/lib/calculation/materialPricing";
import type {
  AllowanceBreakdown,
  CoverageStatus,
  PricingConfiguration,
  QuoteCalculationResult,
  QuoteInput,
  QuoteLineItem,
} from "@/lib/types";

/**
 * Pure calculation engine for the optical quote calculator.
 *
 * Design rules this file must always follow:
 *  - All money arithmetic uses integer cents. Never use floating point.
 *  - This module has no dependency on React, the DOM, or storage. It can be
 *    unit tested in complete isolation (see __tests__/calculateQuote.test.ts)
 *    and reused unchanged if the UI layer changes.
 *  - Patient responsibility can never be negative.
 *  - Every automatic fee must appear as its own itemized line so nothing is
 *    ever buried inside another price.
 */

/**
 * Determines how much of a single priced item the patient pays in Insurance
 * Copays mode, based on how the optician has classified that item:
 *  - "included": insurance covers it fully, patient pays $0.
 *  - "noncovered": insurance does not apply, patient pays the full retail amount.
 *  - "copay": patient pays the configured copay, capped so it can never
 *     exceed the item's own retail value (never charge more than retail).
 */
function computeCopayPortion(coverage: CoverageStatus, retailCents: number, copayCents: number): number {
  const safeRetail = Math.max(retailCents, 0);
  switch (coverage) {
    case "included":
      return 0;
    case "noncovered":
      return safeRetail;
    case "copay":
    default:
      return Math.min(Math.max(copayCents, 0), safeRetail);
  }
}

export function calculateQuote(
  input: QuoteInput,
  config: PricingConfiguration
): QuoteCalculationResult {
  const warnings: string[] = [];
  const lineItems: QuoteLineItem[] = [];

  const lensType = input.lensTypeId
    ? config.lensTypes.find((item) => item.id === input.lensTypeId && item.active)
    : undefined;
  if (input.lensTypeId && !lensType) {
    warnings.push("The previously selected lens type is no longer active and was excluded from this quote.");
  }

  const isFrameOnly = Boolean(input.frame.frameOnly) || lensType?.key === "frame_only";
  const isLensOnly = lensType?.key === "lens_only";

  /* ---------------------------------------------------------------------- */
  /* Frame                                                                    */
  /* ---------------------------------------------------------------------- */
  let frameRetailCents = 0;
  if (!isLensOnly) {
    frameRetailCents = (input.frame.retailPriceCents || 0) + (input.frame.manualAdjustmentCents || 0);
    const label = input.frame.customDescription.trim()
      ? `Frame — ${input.frame.customDescription.trim()}`
      : "Frame";
    lineItems.push({
      id: generateId("frame"),
      label,
      category: "frame",
      amountCents: frameRetailCents,
      calculationSource: input.frame.manualAdjustmentCents ? "manual" : "configured",
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Lens type, progressive design, material, coating, photochromic          */
  /* (skipped for Frame Only)                                                */
  /* ---------------------------------------------------------------------- */
  let lensAndMaterialRetailCents = 0;
  let coatingRetailCents = 0;
  let photochromicRetailCents = 0;

  const isProgressive = lensType?.key === "progressive";

  const progressiveDesign =
    !isFrameOnly && isProgressive && input.progressiveDesignId
      ? config.progressiveDesigns.find((item) => item.id === input.progressiveDesignId && item.active)
      : undefined;
  if (!isFrameOnly && isProgressive && input.progressiveDesignId && !progressiveDesign) {
    warnings.push("The previously selected progressive design is no longer active and was excluded from this quote.");
  }

  const material =
    !isFrameOnly && input.materialId
      ? config.materials.find((item) => item.id === input.materialId && item.active)
      : undefined;
  if (!isFrameOnly && input.materialId && !material) {
    warnings.push("The previously selected lens material is no longer active and was excluded from this quote.");
  }

  const coating =
    !isFrameOnly && input.coatingId
      ? config.coatings.find((item) => item.id === input.coatingId && item.active)
      : undefined;
  if (!isFrameOnly && input.coatingId && !coating) {
    warnings.push("The previously selected coating is no longer active and was excluded from this quote.");
  }

  const photochromicProduct =
    !isFrameOnly && input.photochromic.productId
      ? config.photochromicProducts.find((item) => item.id === input.photochromic.productId && item.active)
      : undefined;
  if (!isFrameOnly && input.photochromic.productId && !photochromicProduct) {
    warnings.push("The previously selected photochromic option is no longer active and was excluded from this quote.");
  }

  const photochromicColor =
    photochromicProduct?.requiresColorSelection && input.photochromic.colorId
      ? config.photochromicColors.find((item) => item.id === input.photochromic.colorId && item.active)
      : undefined;
  if (photochromicProduct?.requiresColorSelection && input.photochromic.colorId && !photochromicColor) {
    warnings.push("The previously selected photochromic color is no longer active and was excluded from this quote.");
  }

  // The lens type only determines which pricing table and options are
  // available — it has no price of its own. The actual lens price always
  // comes from the material's price entry for this lens type (and, for
  // Progressive, this specific progressive design).
  if (!isFrameOnly && material && lensType && (!isProgressive || progressiveDesign)) {
    const matchedPrice = findMaterialPrice(material, lensType, progressiveDesign?.id ?? null);

    if (!matchedPrice) {
      warnings.push(
        `No price is configured for ${material.name} with ${lensType.name}${
          progressiveDesign ? ` (${progressiveDesign.name})` : ""
        }. Add one in Admin Pricing.`
      );
    } else {
      lensAndMaterialRetailCents = matchedPrice.priceCents;
      const descriptionParts = [progressiveDesign?.name, material.name].filter(
        (part): part is string => Boolean(part)
      );
      lineItems.push({
        id: generateId("lens"),
        label: `${lensType.name} Lenses`,
        description: descriptionParts.length > 0 ? descriptionParts.join(", ") : undefined,
        category: "lens",
        amountCents: lensAndMaterialRetailCents,
        calculationSource: "configured",
      });
    }
  } else if (!isFrameOnly && lensType && isProgressive && !progressiveDesign) {
    warnings.push("Select a progressive design to price this lens.");
  } else if (!isFrameOnly && lensType && !material) {
    warnings.push("Select a lens material to price this lens.");
  }

  if (!isFrameOnly && coating && lensType) {
    const overridePrice = coating.priceByLensType?.[lensType.key];
    const price = typeof overridePrice === "number" ? overridePrice : coating.retailPriceCents;
    coatingRetailCents = price;
    if (price > 0) {
      lineItems.push({
        id: generateId("coating"),
        label: coating.name,
        description: coating.description,
        category: "coating",
        amountCents: price,
        calculationSource: "configured",
      });
    }
  }

  if (!isFrameOnly && photochromicProduct && photochromicProduct.key !== "none") {
    photochromicRetailCents = photochromicProduct.retailPriceCents;
    const label =
      photochromicProduct.requiresColorSelection && photochromicColor
        ? `${photochromicProduct.name} — ${photochromicColor.name}`
        : photochromicProduct.name;
    lineItems.push({
      id: generateId("photochromic"),
      label,
      description: photochromicProduct.description,
      category: "photochromic",
      amountCents: photochromicRetailCents,
      calculationSource: "configured",
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Conditional fee rules (e.g. Transitions custom-color surfacing fee)      */
  /* ---------------------------------------------------------------------- */
  let feeRetailCents = 0;
  if (!isFrameOnly) {
    for (const rule of conditionalFeeRules) {
      const result = rule.evaluate({ input, config, lensType, photochromicProduct, photochromicColor });
      if (result) {
        feeRetailCents += result.amountCents;
        lineItems.push(result);
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Adjustments (Step 7): charges first (establish percent-discount basis),  */
  /* then fixed discounts, percent discounts, and credits.                    */
  /* ---------------------------------------------------------------------- */
  const baseRetailBeforeAdjustmentsCents = sumCents(lineItems.map((item) => item.amountCents));

  const charges = input.adjustments.filter((adj) => adj.type === "charge");
  const chargeTotalCents = sumCents(charges.map((adj) => Math.abs(adj.amountCents || 0)));
  for (const adj of charges) {
    lineItems.push({
      id: generateId("custom"),
      label: adj.label.trim() || "Custom charge",
      category: "custom",
      amountCents: Math.abs(adj.amountCents || 0),
      calculationSource: "manual",
    });
  }

  const percentBasisCents = baseRetailBeforeAdjustmentsCents + chargeTotalCents;

  for (const adj of input.adjustments) {
    if (adj.type === "fixed_discount") {
      const amount = -Math.abs(adj.amountCents || 0);
      lineItems.push({
        id: generateId("discount"),
        label: adj.label.trim() || "Discount",
        category: "discount",
        amountCents: amount,
        calculationSource: "manual",
      });
    } else if (adj.type === "percent_discount") {
      const percent = Math.min(Math.max(adj.percent || 0, 0), 100);
      const amount = -Math.round((percentBasisCents * percent) / 100);
      lineItems.push({
        id: generateId("discount"),
        label: adj.label.trim() || `${percent}% discount`,
        category: "discount",
        amountCents: amount,
        calculationSource: "manual",
      });
    } else if (adj.type === "credit") {
      const amount = -Math.abs(adj.amountCents || 0);
      lineItems.push({
        id: generateId("discount"),
        label: adj.label.trim() || "Credit",
        category: "discount",
        amountCents: amount,
        calculationSource: "manual",
      });
    }
  }

  const retailTotalCents = baseRetailBeforeAdjustmentsCents + chargeTotalCents;
  const discountTotalCents = sumCents(
    lineItems.filter((item) => item.category === "discount").map((item) => Math.abs(item.amountCents))
  );

  /* ---------------------------------------------------------------------- */
  /* Insurance calculation                                                    */
  /* ---------------------------------------------------------------------- */
  let insuranceContributionCents = 0;
  let unusedAllowanceCents = 0;
  let allowanceBreakdown: AllowanceBreakdown | null = null;
  let patientResponsibilityCents = 0;
  let isManualOverride = false;
  let overrideNote = "";
  let preOverridePatientResponsibilityCents: number | null = null;

  const mode = input.insurance.mode;

  if (mode === "retail") {
    patientResponsibilityCents = clampNonNegative(retailTotalCents - discountTotalCents);
    insuranceContributionCents = 0;
  } else if (mode === "allowances") {
    const frameEligible = clampNonNegative(frameRetailCents);
    const frameAllowance = clampNonNegative(input.frame.insuranceAllowanceCents || 0);
    const frameApplied = Math.min(frameAllowance, frameEligible);
    const frameUnused = clampNonNegative(frameAllowance - frameEligible);

    const lensEligible = clampNonNegative(
      lensAndMaterialRetailCents + coatingRetailCents + photochromicRetailCents + feeRetailCents + chargeTotalCents
    );
    const lensAllowance = clampNonNegative(input.insurance.allowances.lensAllowanceCents || 0);
    const lensApplied = Math.min(lensAllowance, lensEligible);
    const lensUnused = clampNonNegative(lensAllowance - lensEligible);

    const remainingBeforeAdditional = clampNonNegative(retailTotalCents - frameApplied - lensApplied);
    const additionalCredit = clampNonNegative(input.insurance.allowances.additionalCreditCents || 0);
    const additionalApplied = Math.min(additionalCredit, remainingBeforeAdditional);
    const additionalUnused = clampNonNegative(additionalCredit - remainingBeforeAdditional);

    const afterAllowances = clampNonNegative(remainingBeforeAdditional - additionalApplied);
    patientResponsibilityCents = clampNonNegative(afterAllowances - discountTotalCents);
    insuranceContributionCents = frameApplied + lensApplied + additionalApplied;
    unusedAllowanceCents = frameUnused + lensUnused + additionalUnused;

    allowanceBreakdown = {
      frameAllowanceCents: frameAllowance,
      frameAllowanceAppliedCents: frameApplied,
      frameAllowanceUnusedCents: frameUnused,
      lensAllowanceCents: lensAllowance,
      lensAllowanceAppliedCents: lensApplied,
      lensAllowanceUnusedCents: lensUnused,
      additionalCreditCents: additionalCredit,
      additionalCreditAppliedCents: additionalApplied,
      additionalCreditUnusedCents: additionalUnused,
    };
  } else if (mode === "copays") {
    const copays = input.insurance.copays;
    const frameRetailForCopay = clampNonNegative(frameRetailCents);
    const lensRetailForCopay = clampNonNegative(lensAndMaterialRetailCents);
    const coatingRetailForCopay = clampNonNegative(coatingRetailCents);
    const photoRetailForCopay = clampNonNegative(photochromicRetailCents);

    const framePatientPortion = computeCopayPortion(
      copays.frameCoverage,
      frameRetailForCopay,
      clampNonNegative(input.frame.copayCents || 0)
    );
    const lensPatientPortion = computeCopayPortion(
      copays.lensCoverage,
      lensRetailForCopay,
      clampNonNegative(copays.lensCopayCents || 0)
    );
    const coatingPatientPortion = computeCopayPortion(
      copays.coatingCoverage,
      coatingRetailForCopay,
      clampNonNegative(copays.coatingCopayCents || 0)
    );
    const photoPatientPortion = computeCopayPortion(
      copays.photochromicCoverage,
      photoRetailForCopay,
      clampNonNegative(copays.photochromicCopayCents || 0)
    );

    const copayPatientSubtotal =
      framePatientPortion + lensPatientPortion + coatingPatientPortion + photoPatientPortion;

    const otherCopay = clampNonNegative(copays.otherCopayCents || 0);
    // Automatic fees and custom charges are always fully patient-responsible in copay mode:
    // they sit outside the office's standard insurance copay schedule.
    const alwaysPatientCharges = feeRetailCents + chargeTotalCents;

    const patientResponsibilityBeforeDiscount = copayPatientSubtotal + otherCopay + alwaysPatientCharges;
    patientResponsibilityCents = clampNonNegative(patientResponsibilityBeforeDiscount - discountTotalCents);

    insuranceContributionCents =
      frameRetailForCopay -
      framePatientPortion +
      (lensRetailForCopay - lensPatientPortion) +
      (coatingRetailForCopay - coatingPatientPortion) +
      (photoRetailForCopay - photoPatientPortion);
  } else if (mode === "manual") {
    isManualOverride = true;
    overrideNote = input.insurance.manualOverride.note.trim();
    preOverridePatientResponsibilityCents = clampNonNegative(retailTotalCents - discountTotalCents);
    patientResponsibilityCents = clampNonNegative(input.insurance.manualOverride.finalPatientResponsibilityCents || 0);
    insuranceContributionCents = 0;
  }

  return {
    lineItems,
    retailTotalCents,
    discountTotalCents,
    insuranceContributionCents,
    unusedAllowanceCents,
    allowanceBreakdown,
    patientResponsibilityCents,
    isManualOverride,
    overrideNote,
    preOverridePatientResponsibilityCents,
    warnings,
  };
}

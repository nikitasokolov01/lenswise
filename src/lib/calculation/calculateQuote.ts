import { generateId } from "@/lib/id";
import { clampNonNegative, sumCents } from "@/lib/money";
import { conditionalFeeRules, type ConditionalFeeCandidate } from "@/lib/calculation/rules";
import { findMaterialPrice } from "@/lib/calculation/materialPricing";
import type {
  AllowanceBreakdown,
  CoverageMethod,
  InsuranceBreakdown,
  PricingConfiguration,
  QuoteCalculationResult,
  QuoteInput,
  QuoteLineItem,
  SurfacingFeeReason,
} from "@/lib/types";

/**
 * Generalized, customer-safe names per line-item category. Patient/customer
 * surfaces render QuoteLineItem.customerLabel so a specific brand or lab
 * technology (e.g. "Crizal Sapphire", "Transitions Gen S — Ruby") is never
 * exposed on a customer-facing estimate.
 */
const CUSTOMER_COATING_LABEL = "Premium Anti-Reflective Coating";
const CUSTOMER_PHOTOCHROMIC_LABEL = "Photochromic Lens Upgrade";

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
 *  - Retail value, copays owed by the patient, allowances paid by
 *    insurance, non-covered retail charges, discounts, and patient
 *    responsibility are kept as separate, independently reported figures —
 *    never collapsed into one number before the final total.
 *
 * Unified insurance mode ("insurance"):
 *  Each insurable category (frame / lens+material / coating / photochromic)
 *  is billed one of three ways (see resolveCategory):
 *   - "retail": the patient owes its retail, which a frame/lens allowance
 *     may then offset (capped at the eligible pool; any excess is "unused").
 *   - "copay": the copay REPLACES that category's retail — the patient owes
 *     the copay and insurance covers the remainder (retail − copay). A copay
 *     is never added on top of retail, and the category no longer draws from
 *     the allowance pool.
 *   - "covered": insurance pays the category's full retail; the patient owes
 *     nothing for it.
 *  Patient responsibility, copays owed, insurance contribution (allowances
 *  applied + covered retail + the insurance portion of every copay), unused
 *  allowance, and non-covered charges are all reported as separate figures.
 */

/** One eligible-charge pool's allowance math: applied amount capped at the pool, plus unused. */
function applyAllowance(allowanceCents: number, eligibleCents: number) {
  const allowance = clampNonNegative(allowanceCents);
  const eligible = clampNonNegative(eligibleCents);
  const applied = Math.min(allowance, eligible);
  const unused = clampNonNegative(allowance - eligible);
  return { allowance, applied, unused };
}

/**
 * Interprets one category's CoverageMethod against its retail price. This is
 * the single place a CoverageMethod is turned into money.
 *
 * A copay REPLACES the patient's cost for that category — it is never added
 * on top of retail. Given a $180 coating with a $60 copay: the patient owes
 * $60 and insurance contributes the remaining $120. The four buckets a
 * category can split into:
 *  - eligibleRetailCents: retail the patient still owes AND that a frame/lens
 *    allowance may offset ("retail" method only).
 *  - copayPatientCents: what the patient owes for a copay category (the
 *    copay, capped at retail so it can never exceed the item's price).
 *  - copayInsuranceCents: the rest of a copay item's retail that insurance
 *    picks up (retail − copay).
 *  - coveredInsuranceCents: full retail that insurance pays for a fully
 *    "covered" category (patient owes nothing).
 *
 * A copay/covered category is NOT eligible for the allowance pool — the
 * copay/coverage has already fully settled it. If an office wants a frame or
 * lens allowance to apply, that category is billed at "retail" and the
 * allowance offsets it.
 */
function resolveCategory(method: CoverageMethod, retailCents: number) {
  const retail = clampNonNegative(retailCents);
  if (method.type === "covered") {
    return { eligibleRetailCents: 0, copayPatientCents: 0, copayInsuranceCents: 0, coveredInsuranceCents: retail };
  }
  if (method.type === "copay") {
    const copayPatient = Math.min(clampNonNegative(method.amountCents), retail);
    return {
      eligibleRetailCents: 0,
      copayPatientCents: copayPatient,
      copayInsuranceCents: retail - copayPatient,
      coveredInsuranceCents: 0,
    };
  }
  // "retail": patient pays this category's retail, offsettable by an allowance.
  return { eligibleRetailCents: retail, copayPatientCents: 0, copayInsuranceCents: 0, coveredInsuranceCents: 0 };
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

  const isFrameOnly = input.orderType === "frame_only";
  const isLensOnly = input.orderType === "lens_only";

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
      customerLabel: label,
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
  // Progressive, this specific progressive design). The progressive design
  // name is promoted into the primary line-item label (not buried in the
  // description) so it always appears correctly and prominently in every
  // summary and printout that renders line-item labels.
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
      const label = progressiveDesign
        ? `${lensType.name} Lenses — ${progressiveDesign.name}`
        : `${lensType.name} Lenses`;
      lineItems.push({
        id: generateId("lens"),
        label,
        // The customer-safe label omits the specific progressive design name
        // (a technology name to hide) — it is only ever the generic lens-type
        // name, e.g. "Progressive Lenses". The design name stays on `label`
        // (optician/internal use) and the material technology stays in
        // `description`, which customer surfaces do not render by default.
        customerLabel: `${lensType.name} Lenses`,
        description: material.name,
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
        customerLabel: CUSTOMER_COATING_LABEL,
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
      customerLabel: CUSTOMER_PHOTOCHROMIC_LABEL,
      description: photochromicProduct.description,
      category: "photochromic",
      amountCents: photochromicRetailCents,
      calculationSource: "configured",
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Conditional fee rules (e.g. Transitions custom-color surfacing fee,      */
  /* high-cylinder surfacing fee). Rules sharing a stacking group are         */
  /* mutually exclusive: only the highest-amount eligible candidate in a      */
  /* group is charged, but every eligible candidate's reason is preserved     */
  /* in `surfacingFeeReasons` for the Internal Order Worksheet. The           */
  /* patient-facing line item never reveals a prescription-derived reason.    */
  /* ---------------------------------------------------------------------- */
  let feeRetailCents = 0;
  const surfacingFeeReasons: SurfacingFeeReason[] = [];
  if (!isFrameOnly) {
    const candidates: ConditionalFeeCandidate[] = [];
    for (const rule of conditionalFeeRules) {
      const candidate = rule.evaluate({ input, config, lensType, material, photochromicProduct, photochromicColor });
      if (candidate) candidates.push(candidate);
    }

    const grouped = new Map<string, ConditionalFeeCandidate[]>();
    const ungrouped: ConditionalFeeCandidate[] = [];
    for (const candidate of candidates) {
      if (candidate.stackingGroup) {
        const list = grouped.get(candidate.stackingGroup) ?? [];
        list.push(candidate);
        grouped.set(candidate.stackingGroup, list);
      } else {
        ungrouped.push(candidate);
      }
    }

    for (const candidate of ungrouped) {
      feeRetailCents += candidate.amountCents;
      lineItems.push({
        id: generateId("fee"),
        label: candidate.patientLabel,
        customerLabel: candidate.patientLabel,
        category: "fee",
        amountCents: candidate.amountCents,
        calculationSource: "rule",
      });
      if (candidate.customerWarning) warnings.push(candidate.customerWarning);
    }

    for (const group of grouped.values()) {
      const winner = [...group].sort((a, b) => b.amountCents - a.amountCents)[0];
      feeRetailCents += winner.amountCents;
      lineItems.push({
        id: generateId("fee"),
        label: winner.patientLabel,
        customerLabel: winner.patientLabel,
        category: "fee",
        amountCents: winner.amountCents,
        calculationSource: "rule",
      });
      if (winner.customerWarning) warnings.push(winner.customerWarning);
      for (const candidate of group) {
        surfacingFeeReasons.push({
          key: candidate.key,
          label: candidate.internalReasonLabel,
          amountCents: candidate.amountCents,
          charged: candidate.key === winner.key,
        });
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Adjustments: charges first (establish percent-discount basis), then      */
  /* fixed discounts, percent discounts, and credits.                         */
  /* ---------------------------------------------------------------------- */
  const baseRetailBeforeAdjustmentsCents = sumCents(lineItems.map((item) => item.amountCents));

  const charges = input.adjustments.filter((adj) => adj.type === "charge");
  const chargeTotalCents = sumCents(charges.map((adj) => Math.abs(adj.amountCents || 0)));
  for (const adj of charges) {
    const label = adj.label.trim() || "Custom charge";
    lineItems.push({
      id: generateId("custom"),
      label,
      customerLabel: label,
      category: "custom",
      amountCents: Math.abs(adj.amountCents || 0),
      calculationSource: "manual",
    });
  }

  const percentBasisCents = baseRetailBeforeAdjustmentsCents + chargeTotalCents;

  for (const adj of input.adjustments) {
    if (adj.type === "fixed_discount") {
      const amount = -Math.abs(adj.amountCents || 0);
      const label = adj.label.trim() || "Discount";
      lineItems.push({
        id: generateId("discount"),
        label,
        customerLabel: label,
        category: "discount",
        amountCents: amount,
        calculationSource: "manual",
      });
    } else if (adj.type === "percent_discount") {
      const percent = Math.min(Math.max(adj.percent || 0, 0), 100);
      const amount = -Math.round((percentBasisCents * percent) / 100);
      const label = adj.label.trim() || `${percent}% discount`;
      lineItems.push({
        id: generateId("discount"),
        label,
        customerLabel: label,
        category: "discount",
        amountCents: amount,
        calculationSource: "manual",
      });
    } else if (adj.type === "credit") {
      const amount = -Math.abs(adj.amountCents || 0);
      const label = adj.label.trim() || "Credit";
      lineItems.push({
        id: generateId("discount"),
        label,
        customerLabel: label,
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
  let copayTotalCents = 0;
  let insuranceContributionCents = 0;
  let nonCoveredChargeCents = 0;
  let unusedAllowanceCents = 0;
  let allowanceBreakdown: AllowanceBreakdown | null = null;
  let insuranceBreakdown: InsuranceBreakdown | null = null;
  let patientResponsibilityCents = 0;
  let isManualOverride = false;
  let overrideNote = "";
  let preOverridePatientResponsibilityCents: number | null = null;

  const mode = input.insurance.mode;

  if (mode === "retail") {
    patientResponsibilityCents = clampNonNegative(retailTotalCents - discountTotalCents);
  } else if (mode === "insurance") {
    const coverage = input.insurance.coverage;

    // The per-quote coverage selection is AUTHORITATIVE: it takes precedence
    // over every default (office defaults and product/material-price
    // overrides). Product-level overrides only seed a new quote's initial
    // defaults; they never override what the optician chose on this quote —
    // otherwise switching a category to Retail would appear "stuck". The
    // material price for the selected lens type already IS the lens price, so
    // a single "Lens" coverage governs the combined lens+material amount and
    // it is never billed twice.
    //
    // Frame copay is naturally excluded for Lens Only and every lens-group
    // category for Frame Only, because a copay is capped at the category's
    // retail (0 when the component isn't on this order).
    const frameCat = resolveCategory(coverage.frameCoverage, frameRetailCents);
    const lensCat = resolveCategory(coverage.lensCoverage, lensAndMaterialRetailCents);
    const coatingCat = resolveCategory(coverage.coatingCoverage, coatingRetailCents);
    const photochromicCat = resolveCategory(coverage.photochromicCoverage, photochromicRetailCents);

    // Surfacing fees and manual charges are always patient-owed at retail
    // and are eligible for the lens allowance pool.
    const feeEligibleCents = clampNonNegative(feeRetailCents);
    const chargeEligibleCents = clampNonNegative(chargeTotalCents);

    // Allowances reduce their eligible retail pool, capped so they can never
    // exceed it; any excess is reported separately as unused. Only
    // "retail"-method categories feed a pool — copay/covered categories are
    // already settled and never draw from (or need) an allowance.
    const frameAllowanceResult = applyAllowance(coverage.frameAllowanceCents, frameCat.eligibleRetailCents);

    const lensPoolEligibleCents = clampNonNegative(
      lensCat.eligibleRetailCents +
        coatingCat.eligibleRetailCents +
        photochromicCat.eligibleRetailCents +
        feeEligibleCents +
        chargeEligibleCents
    );
    const lensAllowanceResult = applyAllowance(coverage.lensAllowanceCents, lensPoolEligibleCents);

    const eligibleRemainingAfterPrimary = clampNonNegative(
      frameCat.eligibleRetailCents -
        frameAllowanceResult.applied +
        (lensPoolEligibleCents - lensAllowanceResult.applied)
    );
    const additionalAllowanceResult = applyAllowance(
      coverage.additionalAllowanceCents,
      eligibleRemainingAfterPrimary
    );

    const totalEligibleRetailCents = frameCat.eligibleRetailCents + lensPoolEligibleCents;
    const totalAllowancesAppliedCents =
      frameAllowanceResult.applied + lensAllowanceResult.applied + additionalAllowanceResult.applied;

    const coveredInsuranceTotalCents =
      frameCat.coveredInsuranceCents +
      lensCat.coveredInsuranceCents +
      coatingCat.coveredInsuranceCents +
      photochromicCat.coveredInsuranceCents;
    const copayInsuranceTotalCents =
      frameCat.copayInsuranceCents +
      lensCat.copayInsuranceCents +
      coatingCat.copayInsuranceCents +
      photochromicCat.copayInsuranceCents;

    const otherCopayCents = clampNonNegative(coverage.otherCopayCents);
    copayTotalCents =
      frameCat.copayPatientCents +
      lensCat.copayPatientCents +
      coatingCat.copayPatientCents +
      photochromicCat.copayPatientCents +
      otherCopayCents;

    nonCoveredChargeCents = clampNonNegative(coverage.otherChargeCents);

    // Patient owes: retail that survived the allowances, plus every copay,
    // plus flat non-covered charges, less any manual discounts. Covered and
    // copay-insurance portions never touch patient responsibility.
    patientResponsibilityCents = clampNonNegative(
      totalEligibleRetailCents -
        totalAllowancesAppliedCents +
        copayTotalCents +
        nonCoveredChargeCents -
        discountTotalCents
    );
    insuranceContributionCents =
      totalAllowancesAppliedCents + coveredInsuranceTotalCents + copayInsuranceTotalCents;
    unusedAllowanceCents = frameAllowanceResult.unused + lensAllowanceResult.unused + additionalAllowanceResult.unused;

    allowanceBreakdown = {
      frameAllowanceCents: frameAllowanceResult.allowance,
      frameAllowanceAppliedCents: frameAllowanceResult.applied,
      frameAllowanceUnusedCents: frameAllowanceResult.unused,
      lensAllowanceCents: lensAllowanceResult.allowance,
      lensAllowanceAppliedCents: lensAllowanceResult.applied,
      lensAllowanceUnusedCents: lensAllowanceResult.unused,
      additionalAllowanceCents: additionalAllowanceResult.allowance,
      additionalAllowanceAppliedCents: additionalAllowanceResult.applied,
      additionalAllowanceUnusedCents: additionalAllowanceResult.unused,
    };

    insuranceBreakdown = {
      frameAllowanceAppliedCents: frameAllowanceResult.applied,
      lensAllowanceAppliedCents: lensAllowanceResult.applied,
      additionalAllowanceAppliedCents: additionalAllowanceResult.applied,
      frameCoveredCents: frameCat.coveredInsuranceCents,
      lensCoveredCents: lensCat.coveredInsuranceCents,
      coatingCoveredCents: coatingCat.coveredInsuranceCents,
      photochromicCoveredCents: photochromicCat.coveredInsuranceCents,
      frameCopayCents: frameCat.copayPatientCents,
      lensCopayCents: lensCat.copayPatientCents,
      coatingCopayCents: coatingCat.copayPatientCents,
      photochromicCopayCents: photochromicCat.copayPatientCents,
      otherCopayCents,
      otherChargeCents: nonCoveredChargeCents,
    };
  } else if (mode === "manual") {
    isManualOverride = true;
    overrideNote = input.insurance.manualOverride.note.trim();
    preOverridePatientResponsibilityCents = clampNonNegative(retailTotalCents - discountTotalCents);
    patientResponsibilityCents = clampNonNegative(input.insurance.manualOverride.finalPatientResponsibilityCents || 0);
  }

  return {
    lineItems,
    retailTotalCents,
    discountTotalCents,
    copayTotalCents,
    insuranceContributionCents,
    nonCoveredChargeCents,
    unusedAllowanceCents,
    allowanceBreakdown,
    insuranceBreakdown,
    surfacingFeeReasons,
    patientResponsibilityCents,
    isManualOverride,
    overrideNote,
    preOverridePatientResponsibilityCents,
    warnings,
  };
}

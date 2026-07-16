import type { PricingConfiguration, QuoteInput } from "@/lib/types";

/**
 * Builds a fresh, blank QuoteInput for a new patient visit. Used both when
 * the Quote Builder first loads and whenever the optician clicks
 * "Reset quote". Default copay/allowance values are pre-filled from the
 * office's configured defaults so the optician has less to re-type, but
 * every value remains fully editable per-quote.
 *
 * Order type defaults to "complete_pair". Lens configuration (lens type,
 * progressive design, material, coating, photochromic) starts fully unset
 * because it stays locked until a valid prescription is applied. Prescription
 * starts unapplied (null) — it is never persisted between quotes or between
 * page loads.
 */
export function createDefaultQuoteInput(config: PricingConfiguration): QuoteInput {
  return {
    orderType: "complete_pair",
    usage: null,
    frame: {
      retailPriceCents: 0,
      customDescription: "",
      manualAdjustmentCents: 0,
    },
    lensTypeId: null,
    progressiveDesignId: null,
    materialId: null,
    coatingId: null,
    photochromic: {
      productId: null,
      colorId: null,
    },
    tint: {
      type: "none",
      colorId: null,
      percent: null,
    },
    blueLightId: null,
    surfacingOverride: null,
    prescriptionDisplayMode: "original",
    prescription: null,
    insurance: {
      mode: "retail",
      // Each CoverageMethod field is copied into a fresh object (not the
      // same reference held by `config`) so editing this quote's coverage
      // can never mutate the office's stored default configuration.
      coverage: {
        frameCoverage: { ...config.defaultInsuranceCoverage.frameCoverage },
        frameAllowanceCents: config.defaultInsuranceCoverage.frameAllowanceCents,
        lensCoverage: { ...config.defaultInsuranceCoverage.lensCoverage },
        lensAllowanceCents: config.defaultInsuranceCoverage.lensAllowanceCents,
        materialCoverage: { ...config.defaultInsuranceCoverage.materialCoverage },
        coatingCoverage: { ...config.defaultInsuranceCoverage.coatingCoverage },
        photochromicCoverage: { ...config.defaultInsuranceCoverage.photochromicCoverage },
        tintCoverage: { ...config.defaultInsuranceCoverage.tintCoverage },
        blueLightCoverage: { ...config.defaultInsuranceCoverage.blueLightCoverage },
        surfacingCoverage: { ...config.defaultInsuranceCoverage.surfacingCoverage },
        otherCopayCents: config.defaultInsuranceCoverage.otherCopayCents,
        additionalAllowanceCents: config.defaultInsuranceCoverage.additionalAllowanceCents,
        otherChargeCents: config.defaultInsuranceCoverage.otherChargeCents,
        note: "",
      },
      manualOverride: {
        finalPatientResponsibilityCents: 0,
        note: "",
      },
    },
    adjustments: [],
  };
}

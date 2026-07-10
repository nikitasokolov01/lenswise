import type { PricingConfiguration, QuoteInput } from "@/lib/types";

/**
 * Builds a fresh, blank QuoteInput for a new patient visit. Used both when
 * the Quote Builder first loads and whenever the optician clicks
 * "Reset quote". Default copay/allowance values are pre-filled from the
 * office's configured defaults so the optician has less to re-type, but
 * every value remains fully editable per-quote.
 */
export function createDefaultQuoteInput(config: PricingConfiguration): QuoteInput {
  const firstActiveLensType = config.lensTypes
    .filter((item) => item.active)
    .sort((a, b) => a.sortOrder - b.sortOrder)[0];

  return {
    frame: {
      retailPriceCents: 0,
      frameOnly: false,
      customDescription: "",
      insuranceAllowanceCents: config.defaultAllowances.frameAllowanceCents,
      copayCents: config.defaultCopays.frameCopayCents,
      manualAdjustmentCents: 0,
    },
    lensTypeId: firstActiveLensType?.id ?? null,
    progressiveDesignId: null,
    materialId: null,
    coatingId: null,
    photochromic: {
      productId: null,
      colorId: null,
    },
    insurance: {
      mode: "retail",
      allowances: {
        lensAllowanceCents: config.defaultAllowances.lensAllowanceCents,
        additionalCreditCents: config.defaultAllowances.additionalCreditCents,
      },
      copays: {
        lensCopayCents: config.defaultCopays.lensCopayCents,
        coatingCopayCents: config.defaultCopays.coatingCopayCents,
        photochromicCopayCents: config.defaultCopays.photochromicCopayCents,
        otherCopayCents: config.defaultCopays.otherCopayCents,
        frameCoverage: "copay",
        lensCoverage: "copay",
        coatingCoverage: "copay",
        photochromicCoverage: "copay",
      },
      manualOverride: {
        finalPatientResponsibilityCents: 0,
        note: "",
      },
    },
    adjustments: [],
  };
}

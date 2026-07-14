import type {
  LensTypeConfig,
  MaterialConfig,
  PhotochromicColorConfig,
  PhotochromicProductConfig,
  PricingConfiguration,
  QuoteInput,
} from "@/lib/types";

/**
 * Conditional fee rules engine.
 *
 * Each rule inspects the current quote input + configuration and returns a
 * ConditionalFeeCandidate when its condition is met, or null otherwise.
 * Candidates that share a `stackingGroup` are mutually exclusive: the
 * calculation engine charges only the highest-amount candidate within a
 * group, while recording every eligible candidate in the quote result's
 * `surfacingFeeReasons` (for the Internal Order Worksheet). Candidates with
 * no `stackingGroup` are always charged independently.
 *
 * To add a new automatic fee later, add another entry to
 * `conditionalFeeRules` — nothing else in the calculation engine needs to
 * change unless the new fee should also participate in a stacking group.
 */
export interface ConditionalFeeContext {
  input: QuoteInput;
  config: PricingConfiguration;
  lensType: LensTypeConfig | undefined;
  material: MaterialConfig | undefined;
  photochromicProduct: PhotochromicProductConfig | undefined;
  photochromicColor: PhotochromicColorConfig | undefined;
}

export interface ConditionalFeeCandidate {
  /** Stable identifier, used to determine the "winner" within a stacking group. */
  key: string;
  /** Safe to show to the patient/customer — never mentions prescription details. */
  patientLabel: string;
  /** Detailed reason shown only on the Internal Order Worksheet. */
  internalReasonLabel: string;
  /**
   * Definite, customer-safe warning surfaced in the live quote when this fee
   * is the charged one. States the fee as required — never "possible" / "may".
   */
  customerWarning: string;
  amountCents: number;
  /** Candidates sharing this string are mutually exclusive; highest amountCents wins. */
  stackingGroup?: string;
}

export interface ConditionalFeeRule {
  id: string;
  evaluate: (context: ConditionalFeeContext) => ConditionalFeeCandidate | null;
}

/** Rules in this group cannot stack — see calculateQuote.ts for the resolution logic. */
const SINGLE_VISION_SURFACING_GROUP = "surfacing_fee";

/**
 * Transitions custom-color surfacing fee.
 *
 * Applies when: lens type is Single Vision, the photochromic product is
 * Transitions Gen S, and the selected color is anything other than a
 * "standard" color (Gray / Brown are marked isStandardColor: true in
 * configuration, so this rule never hardcodes color names).
 */
const transitionsSurfacingFeeRule: ConditionalFeeRule = {
  id: "transitions-custom-color-surfacing-fee",
  evaluate({ config, lensType, photochromicProduct, photochromicColor }) {
    if (!lensType || lensType.key !== "single_vision") return null;
    if (!photochromicProduct || photochromicProduct.key !== "transitions_gen_s") return null;
    if (!photochromicColor) return null;
    if (photochromicColor.isStandardColor) return null;
    if (config.transitionsSurfacingFeeCents <= 0) return null;

    return {
      key: "transitions_custom_color",
      patientLabel: "Custom Lens Surfacing",
      internalReasonLabel: `Transitions custom-color surfacing: Single Vision + Transitions Gen S in ${photochromicColor.name}.`,
      customerWarning:
        "Custom-color photochromic detected. Custom lens surfacing is required for this lens and color combination.",
      amountCents: config.transitionsSurfacingFeeCents,
      stackingGroup: SINGLE_VISION_SURFACING_GROUP,
    };
  },
};

/**
 * High-cylinder (prescription) surfacing fee.
 *
 * This is a DEFINITE automatic fee, not a "possible" one. It applies when ALL
 * of these hold:
 *  - the order contains lenses and a valid prescription has been applied;
 *  - either eye's cylinder is at or beyond config.highCylinderThresholdDiopters
 *    in magnitude (office-configurable in Admin Pricing — NOT a hardcoded
 *    constant): qualifies when `cylinder <= threshold`;
 *  - the lens type is Single Vision or Bifocal (never Progressive — those lab
 *    processes already handle high cylinder without an extra charge);
 *  - the selected material is flagged as needing extra surfacing at high
 *    cylinder (MaterialConfig.appliesToHighCylinderSurfacing);
 *  - the selected material is NOT High Index (MaterialConfig.isHighIndex) —
 *    high-index blanks are handled by a different process and never take this
 *    prescription-based fee.
 *
 * Mutually exclusive with the Transitions custom-color surfacing fee — see
 * SINGLE_VISION_SURFACING_GROUP and the resolution logic in calculateQuote.ts.
 * The patient-facing label and warning never reveal the cylinder value; the
 * specific reason is recorded only for the internal worksheet.
 */
const highCylinderSurfacingFeeRule: ConditionalFeeRule = {
  id: "high-cylinder-surfacing-fee",
  evaluate({ input, config, lensType, material }) {
    if (!lensType || (lensType.key !== "single_vision" && lensType.key !== "bifocal")) return null;
    if (!material || !material.appliesToHighCylinderSurfacing) return null;
    if (material.isHighIndex) return null;
    if (config.highCylinderSurfacingFeeCents <= 0) return null;

    // No applied prescription yet (null) means no cylinder value exists to evaluate.
    if (!input.prescription) return null;

    const threshold = config.highCylinderThresholdDiopters;
    const odCylinder = input.prescription.od.cylinder;
    const osCylinder = input.prescription.os.cylinder;

    // Compare `cylinder <= threshold`, but in integer hundredths of a diopter.
    // Optical powers move in 0.25 D steps, yet a stored threshold can carry
    // tiny floating-point error (e.g. -2.0000000001 from a stepped number
    // input or a JSON round-trip). A naive `-2 <= -2.0000000001` is FALSE,
    // which would drop the fee for an exactly-qualifying prescription at the
    // boundary. Rounding both sides to hundredths makes the boundary
    // (cylinder === threshold) reliably qualify.
    const thresholdHundredths = Math.round(threshold * 100);
    const odQualifies = Math.round(odCylinder * 100) <= thresholdHundredths;
    const osQualifies = Math.round(osCylinder * 100) <= thresholdHundredths;
    if (!odQualifies && !osQualifies) return null;

    const eyes: string[] = [];
    if (odQualifies) eyes.push(`OD ${odCylinder.toFixed(2)}`);
    if (osQualifies) eyes.push(`OS ${osCylinder.toFixed(2)}`);

    return {
      key: "high_cylinder_surfacing",
      patientLabel: "Custom Lens Surfacing",
      internalReasonLabel: `High-cylinder surfacing: cylinder ${threshold.toFixed(2)} or higher in magnitude (${eyes.join(", ")}).`,
      customerWarning:
        "High-cylinder prescription detected. Custom lens surfacing is required for this lens and material combination.",
      amountCents: config.highCylinderSurfacingFeeCents,
      stackingGroup: SINGLE_VISION_SURFACING_GROUP,
    };
  },
};

/**
 * Ordered list of every conditional fee rule the calculation engine should
 * evaluate. Append additional rules here as new business logic is added.
 */
export const conditionalFeeRules: ConditionalFeeRule[] = [
  transitionsSurfacingFeeRule,
  highCylinderSurfacingFeeRule,
];

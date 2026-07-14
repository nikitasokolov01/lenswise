/**
 * Core domain types for the optical quote calculator.
 *
 * IMPORTANT: This application is an anonymous quoting tool. Nothing in this
 * type system should ever be extended to carry patient names, dates of
 * birth, insurance member IDs, phone numbers, addresses, or other protected
 * health information / personally identifiable information.
 *
 * Prescription values (sphere/cylinder/axis/add) ARE modeled below on
 * QuoteInput, because they are needed to compute the high-cylinder
 * surfacing fee and because lens configuration is required to be gated
 * behind a valid, applied prescription (see OrderType and
 * QuoteInput.prescription). They are NOT patient-identifying on their own,
 * but they must still never be persisted: QuoteInput lives only in React
 * state for the current browser tab and is never written to LocalStorage or
 * sent to a server. Only PricingConfiguration (office pricing settings) is
 * persisted. Do not add a prescription field to PricingConfiguration or to
 * any persistence/repository code path.
 *
 * Free-text fields (custom descriptions, adjustment labels, override/notes)
 * are intended ONLY for anonymous labels such as "Designer frame" or
 * "Manager-approved package price".
 */

/** All money is stored as an integer number of cents to avoid floating point errors. */
export type Money = number;

export type LensTypeKey = "single_vision" | "progressive" | "bifocal";

/**
 * What the finished eyewear is primarily used for. A single, optional
 * informational selection per quote (never derived from the lens type). It is
 * shown on the quote surfaces but has NO effect on pricing, insurance, the
 * surfacing rule, or the displayed prescription. (Reading/Computer
 * prescription calculations are a separate, explicit control — see
 * PrescriptionDisplayMode and prescriptionDisplay.ts.)
 */
export type UsageKey =
  | "reading"
  | "computer"
  | "distance"
  | "bifocal"
  | "sunglasses"
  | "progressive";

/**
 * How the applied prescription is DISPLAYED on the Internal Worksheet. This
 * is quote state only — it never modifies the applied prescription itself.
 * See derivePrescriptionForDisplay in prescriptionDisplay.ts. "reading" and
 * "computer" both require an ADD value.
 */
export type PrescriptionDisplayMode = "original" | "reading" | "computer";

/** Tint kind on a quote. "none" means no tint (no color/percentage, no price). */
export type TintType = "none" | "solid" | "gradient";

/**
 * What the patient is ordering on this visit. This is a first-class field on
 * QuoteInput (NOT derived from the lens type selection) because it must be
 * chosen before a lens type can even be selected: lens configuration
 * (LensType/ProgressiveDesign/Material/Coating/Photochromic) stays locked
 * behind a valid, applied prescription for "complete_pair" and "lens_only",
 * but is never applicable at all for "frame_only".
 */
export type OrderType = "complete_pair" | "lens_only" | "frame_only";

/**
 * "insurance" replaces the old separate "allowances" and "copays" modes:
 * copays and allowances can both apply to the same quote at once. See
 * InsuranceCoverageInput below.
 */
export type InsuranceMode = "retail" | "insurance" | "manual";

/**
 * How a single insurable category (frame / base lens / material / coating /
 * photochromic) is billed under Use Insurance mode. This is an explicit
 * three-way choice — NOT a plain copay number — because a $0 copay and
 * "fully covered by insurance" are different concepts that must never be
 * conflated:
 *  - "retail": no insurance copay/coverage for this category; the patient
 *    pays its retail price, which a frame/lens allowance may then offset.
 *  - "copay": the copay REPLACES this category's retail cost — the patient
 *    owes exactly `amountCents` for it (capped at its retail) and insurance
 *    covers the remainder (retail − copay). It is never added on top of
 *    retail, and a copay category does not draw from the allowance pool.
 *  - "covered": the category is fully covered by insurance — the patient
 *    owes nothing for it and insurance contributes its full retail.
 */
export type CoverageMethod =
  | { type: "retail" }
  | { type: "copay"; amountCents: Money }
  | { type: "covered" };

export type AdjustmentType =
  | "fixed_discount"
  | "percent_discount"
  | "charge"
  | "credit";

export type QuoteLineItemCategory =
  | "frame"
  | "lens"
  | "material"
  | "coating"
  | "photochromic"
  | "tint"
  | "fee"
  | "discount"
  | "insurance"
  | "custom";

export type CalculationSource = "configured" | "rule" | "manual";

export interface QuoteLineItem {
  id: string;
  /** Exact, staff-facing label (may name a specific brand/technology, e.g. "Crizal Sapphire"). Used on the optician summary and Internal Order Worksheet. */
  label: string;
  /**
   * Generalized, customer-safe label that never reveals a specific brand or
   * lab technology (e.g. "Premium Anti-Reflective Coating" instead of
   * "Crizal Sapphire"). Used by every patient/customer-facing surface
   * (Patient View, Customer Estimate print). Always set by the calculation
   * engine — the single place that knows how to generalize each category.
   */
  customerLabel: string;
  description?: string;
  category: QuoteLineItemCategory;
  amountCents: Money;
  calculationSource: CalculationSource;
}

/* -------------------------------------------------------------------------- */
/* Pricing configuration (edited from Admin Pricing, persisted via a          */
/* PricingRepository implementation).                                        */
/* -------------------------------------------------------------------------- */

export interface LensTypeConfig {
  id: string;
  key: LensTypeKey;
  name: string;
  description: string;
  active: boolean;
  sortOrder: number;
}

export interface ProgressiveDesignConfig {
  id: string;
  name: string;
  description: string;
  active: boolean;
  sortOrder: number;
}

export interface MaterialPrice {
  id: string;
  lensTypeId: string;
  progressiveDesignId?: string;
  priceCents: Money;
  /** Optional override of the office's default material coverage method for this specific priced row. */
  insuranceCoverage?: CoverageMethod;
}

export interface MaterialConfig {
  id: string;
  name: string;
  shortDescription: string;
  prices: MaterialPrice[];
  /**
   * Whether the high-cylinder surfacing fee (see
   * PricingConfiguration.highCylinderSurfacingFeeCents) can apply when this
   * material is selected. Some materials/lab processes handle high-minus
   * cylinder edging without an extra charge; others do not. Never applies
   * to Progressive lenses regardless of this flag (see calculation engine).
   */
  appliesToHighCylinderSurfacing: boolean;
  /**
   * Whether this is a high-index material. High-index lenses are explicitly
   * excluded from the prescription-based high-cylinder surfacing fee (a
   * different lab process handles them), independent of
   * appliesToHighCylinderSurfacing. See rules.ts.
   */
  isHighIndex: boolean;
  active: boolean;
  sortOrder: number;
}

export interface CoatingConfig {
  id: string;
  name: string;
  description: string;
  retailPriceCents: Money;
  priceByLensType?: Partial<Record<LensTypeKey, Money>>;
  /** Optional override of the office's default coating coverage method. */
  insuranceCoverage?: CoverageMethod;
  active: boolean;
  sortOrder: number;
}

export type PhotochromicProductKey =
  | "none"
  | "house_gray"
  | "house_brown"
  | "transitions_gen_s";

export interface PhotochromicProductConfig {
  id: string;
  key: PhotochromicProductKey;
  name: string;
  description: string;
  retailPriceCents: Money;
  /** Optional override of the office's default photochromic coverage method. */
  insuranceCoverage?: CoverageMethod;
  requiresColorSelection: boolean;
  active: boolean;
  sortOrder: number;
}

export interface PhotochromicColorConfig {
  id: string;
  name: string;
  isStandardColor: boolean;
  active: boolean;
  sortOrder: number;
}

/**
 * One admin-configured tint color. Solid and Gradient each have a single
 * integer-cents price that does NOT vary by percentage — the selected
 * percentage is cosmetic and only appears in the displayed description.
 */
export interface TintColorConfig {
  id: string;
  name: string;
  /** Customer-facing label (only ever shown when exact technology names are enabled). */
  customerLabel: string;
  active: boolean;
  sortOrder: number;
  supportsSolid: boolean;
  supportsGradient: boolean;
  solidPriceCents: Money;
  gradientPriceCents: Money;
}

export interface TintConfig {
  solidTintEnabled: boolean;
  gradientTintEnabled: boolean;
  colors: TintColorConfig[];
}

/**
 * Office-configured defaults that pre-fill every new quote's unified
 * insurance section. Every value stays fully editable per patient visit.
 * Each of the five real priced categories (frame / base lens / material /
 * coating / photochromic) uses the explicit CoverageMethod so "no copay" and
 * "fully covered" can never be confused with each other. "Other" is a
 * free-standing manual copay/charge, not tied to a priced category, so it
 * stays a plain amount.
 */
export interface DefaultInsuranceCoverage {
  frameCoverage: CoverageMethod;
  frameAllowanceCents: Money;
  lensCoverage: CoverageMethod;
  lensAllowanceCents: Money;
  materialCoverage: CoverageMethod;
  coatingCoverage: CoverageMethod;
  photochromicCoverage: CoverageMethod;
  tintCoverage: CoverageMethod;
  otherCopayCents: Money;
  additionalAllowanceCents: Money;
  otherChargeCents: Money;
}

export interface PricingConfiguration {
  schemaVersion: number;
  officeName: string;
  disclaimerText: string;
  /**
   * When true, customer-facing surfaces (Patient View, Customer Estimate
   * print, and the copied estimate text) show each line item's exact
   * technology/brand name and description — e.g. "Progressive Lenses —
   * Premium Progressive", "Crizal Sapphire", "Transitions Gen S — Ruby".
   * When false (the default), those surfaces show only the generalized,
   * brand-free customer label (e.g. "Progressive Lenses", "Premium
   * Anti-Reflective Coating") and hide the material/technology description.
   * The optician summary and Internal Order Worksheet ALWAYS show exact
   * names regardless of this setting.
   */
  showExactTechnologyNamesOnCustomerQuotes: boolean;
  lensTypes: LensTypeConfig[];
  progressiveDesigns: ProgressiveDesignConfig[];
  materials: MaterialConfig[];
  coatings: CoatingConfig[];
  photochromicProducts: PhotochromicProductConfig[];
  photochromicColors: PhotochromicColorConfig[];
  tints: TintConfig;
  transitionsSurfacingFeeCents: Money;
  /**
   * Fee applied when either eye's cylinder is at or beyond
   * highCylinderThresholdDiopters in magnitude, for materials with
   * appliesToHighCylinderSurfacing = true, and never for Progressive lenses.
   * Mutually exclusive with transitionsSurfacingFeeCents — see rules.ts.
   */
  highCylinderSurfacingFeeCents: Money;
  /**
   * The cylinder value (in minus-cylinder notation, e.g. -2) at or beyond
   * which a prescription is considered "high cylinder" for
   * highCylinderSurfacingFeeCents purposes: qualifies when
   * `cylinder <= highCylinderThresholdDiopters`. Office-configurable in
   * Admin Pricing — this is NOT a hardcoded constant, since different
   * offices/labs draw this line at different magnitudes.
   */
  highCylinderThresholdDiopters: number;
  defaultInsuranceCoverage: DefaultInsuranceCoverage;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Quote input (the optician's in-progress selections for one patient visit) */
/* -------------------------------------------------------------------------- */

export interface FrameSelection {
  retailPriceCents: Money;
  customDescription: string;
  manualAdjustmentCents: Money;
}

export interface PhotochromicSelection {
  productId: string | null;
  colorId: string | null;
}

/**
 * Tint selection for one quote. Independent of lens material, coating, and
 * photochromic. `colorId`/`percent` are only meaningful when `type` is
 * "solid" or "gradient"; both are null when `type` is "none".
 */
export interface TintSelection {
  type: TintType;
  colorId: string | null;
  percent: number | null;
}

/**
 * One eye's prescription values, entered via controlled sphere/cylinder/
 * axis/add selectors (never free text). Sphere and cylinder are always
 * present once a prescription is applied (0 displays as "SPH"/"CYL"); axis
 * is required only when cylinder is non-zero and is otherwise null; add is
 * optional ("None" = null). Only `cylinder` feeds into any calculation (the
 * high-cylinder surfacing fee); sphere/axis/add are informational only,
 * shown on the Internal Order Worksheet.
 */
export interface PrescriptionEyeValues {
  sphere: number;
  cylinder: number;
  axis: number | null;
  add: number | null;
}

export interface PrescriptionInput {
  od: PrescriptionEyeValues;
  os: PrescriptionEyeValues;
}

/**
 * Unified insurance section: copays and allowances can both apply to the
 * same quote at the same time. Frame copay/allowance live here (not on
 * FrameSelection) so every insurance-related control is grouped in one
 * place near the bottom of the Quote Builder.
 */
export interface InsuranceCoverageInput {
  frameCoverage: CoverageMethod;
  frameAllowanceCents: Money;
  lensCoverage: CoverageMethod;
  lensAllowanceCents: Money;
  materialCoverage: CoverageMethod;
  coatingCoverage: CoverageMethod;
  photochromicCoverage: CoverageMethod;
  tintCoverage: CoverageMethod;
  otherCopayCents: Money;
  additionalAllowanceCents: Money;
  otherChargeCents: Money;
  /** Optional anonymous internal note about this quote's insurance handling. */
  note: string;
}

export interface InsuranceManualOverrideInput {
  finalPatientResponsibilityCents: Money;
  note: string;
}

export interface InsuranceInput {
  mode: InsuranceMode;
  coverage: InsuranceCoverageInput;
  manualOverride: InsuranceManualOverrideInput;
}

export interface AdjustmentInput {
  id: string;
  type: AdjustmentType;
  amountCents: Money;
  percent: number;
  label: string;
}

export interface QuoteInput {
  orderType: OrderType;
  /** Optional, single "what these glasses are for" selection. `null` = none chosen. Informational only. */
  usage: UsageKey | null;
  frame: FrameSelection;
  lensTypeId: string | null;
  progressiveDesignId: string | null;
  materialId: string | null;
  coatingId: string | null;
  photochromic: PhotochromicSelection;
  tint: TintSelection;
  /** How the Internal Worksheet displays the applied prescription (never modifies it). */
  prescriptionDisplayMode: PrescriptionDisplayMode;
  /**
   * The APPLIED prescription only — never a work-in-progress draft. `null`
   * means no valid prescription has been applied yet. Required (non-null)
   * for lens configuration to unlock and price when orderType is
   * "complete_pair" or "lens_only"; always null and not applicable when
   * orderType is "frame_only". Never persisted — see the module-level
   * comment above.
   */
  prescription: PrescriptionInput | null;
  insurance: InsuranceInput;
  adjustments: AdjustmentInput[];
}

/* -------------------------------------------------------------------------- */
/* Quote calculation result                                                   */
/* -------------------------------------------------------------------------- */

export interface AllowanceBreakdown {
  frameAllowanceCents: Money;
  frameAllowanceAppliedCents: Money;
  frameAllowanceUnusedCents: Money;
  lensAllowanceCents: Money;
  lensAllowanceAppliedCents: Money;
  lensAllowanceUnusedCents: Money;
  additionalAllowanceCents: Money;
  additionalAllowanceAppliedCents: Money;
  additionalAllowanceUnusedCents: Money;
}

/**
 * Records every conditional surfacing-fee rule that was ELIGIBLE for this
 * quote, even if it was not the one actually charged (rules sharing a
 * stacking group are mutually exclusive — only the highest-amount eligible
 * rule is charged). Used by the Internal Order Worksheet so staff can see
 * why a fee did or didn't apply; never shown to the patient/customer.
 */
export interface SurfacingFeeReason {
  key: string;
  label: string;
  amountCents: Money;
  charged: boolean;
}

/**
 * Fully itemized insurance breakdown for one quote, so the summary and
 * printouts can show WHERE the money went instead of collapsing everything
 * into a single "Insurance Contribution" line. Every field is a positive
 * cents amount; surfaces render only the lines that are non-zero. Patient-
 * side lines (the copays) sum into copayTotalCents; insurance-side lines
 * (allowances applied + covered categories + the insurance portion of each
 * copay) sum into insuranceContributionCents.
 */
export interface InsuranceBreakdown {
  /* Insurance-side: allowances actually applied to eligible retail. */
  frameAllowanceAppliedCents: Money;
  lensAllowanceAppliedCents: Money;
  additionalAllowanceAppliedCents: Money;
  /* Insurance-side: categories fully covered (insurance pays their retail). */
  frameCoveredCents: Money;
  lensCoveredCents: Money;
  coatingCoveredCents: Money;
  photochromicCoveredCents: Money;
  tintCoveredCents: Money;
  /* Patient-side: per-category copays (each replaces that category's retail). */
  frameCopayCents: Money;
  lensCopayCents: Money;
  coatingCopayCents: Money;
  photochromicCopayCents: Money;
  tintCopayCents: Money;
  otherCopayCents: Money;
  /* Patient-side: flat non-covered charge owed in full. */
  otherChargeCents: Money;
}

export interface QuoteCalculationResult {
  lineItems: QuoteLineItem[];
  retailTotalCents: Money;
  discountTotalCents: Money;
  /** Total of all copays owed by the patient (kept separate from allowances). */
  copayTotalCents: Money;
  /** Total contributed by insurance: allowances applied + fully-covered categories + the insurance-paid portion of every copay (retail − copay). */
  insuranceContributionCents: Money;
  /** Flat non-covered charges the patient owes in full (e.g. "Other non-covered charge"). */
  nonCoveredChargeCents: Money;
  unusedAllowanceCents: Money;
  allowanceBreakdown: AllowanceBreakdown | null;
  /** Fully itemized per-category insurance detail (null unless in Use Insurance mode). */
  insuranceBreakdown: InsuranceBreakdown | null;
  surfacingFeeReasons: SurfacingFeeReason[];
  patientResponsibilityCents: Money;
  isManualOverride: boolean;
  overrideNote: string;
  preOverridePatientResponsibilityCents: Money | null;
  warnings: string[];
}

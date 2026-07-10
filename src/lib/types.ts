/**
 * Core domain types for the optical quote calculator.
 *
 * IMPORTANT: This application is an anonymous quoting tool. Nothing in this
 * type system should ever be extended to carry patient names, dates of
 * birth, prescriptions, insurance member IDs, phone numbers, addresses, or
 * other protected health information / personally identifiable information.
 * Free-text fields (custom descriptions, adjustment labels, override notes)
 * are intended ONLY for anonymous labels such as "Designer frame" or
 * "Manager-approved package price".
 */

/** All money is stored as an integer number of cents to avoid floating point errors. */
export type Money = number;

export type LensTypeKey =
  | "single_vision"
  | "progressive"
  | "bifocal"
  | "lens_only"
  | "frame_only";

export type CoverageStatus = "copay" | "noncovered" | "included";

export type InsuranceMode = "retail" | "allowances" | "copays" | "manual";

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
  | "fee"
  | "discount"
  | "insurance"
  | "custom";

export type CalculationSource = "configured" | "rule" | "manual";

export interface QuoteLineItem {
  id: string;
  label: string;
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
  insuranceCopayCents?: Money;
}

export interface MaterialConfig {
  id: string;
  name: string;
  shortDescription: string;
  prices: MaterialPrice[];
  active: boolean;
  sortOrder: number;
}

export interface CoatingConfig {
  id: string;
  name: string;
  description: string;
  retailPriceCents: Money;
  priceByLensType?: Partial<Record<LensTypeKey, Money>>;
  insuranceCopayCents?: Money;
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
  insuranceCopayCents?: Money;
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

export interface DefaultAllowances {
  frameAllowanceCents: Money;
  lensAllowanceCents: Money;
  additionalCreditCents: Money;
}

export interface DefaultCopays {
  frameCopayCents: Money;
  lensCopayCents: Money;
  coatingCopayCents: Money;
  photochromicCopayCents: Money;
  otherCopayCents: Money;
}

export interface PricingConfiguration {
  schemaVersion: number;
  officeName: string;
  disclaimerText: string;
  lensTypes: LensTypeConfig[];
  progressiveDesigns: ProgressiveDesignConfig[];
  materials: MaterialConfig[];
  coatings: CoatingConfig[];
  photochromicProducts: PhotochromicProductConfig[];
  photochromicColors: PhotochromicColorConfig[];
  transitionsSurfacingFeeCents: Money;
  defaultAllowances: DefaultAllowances;
  defaultCopays: DefaultCopays;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Quote input (the optician's in-progress selections for one patient visit) */
/* -------------------------------------------------------------------------- */

export interface FrameSelection {
  retailPriceCents: Money;
  frameOnly: boolean;
  customDescription: string;
  insuranceAllowanceCents: Money;
  copayCents: Money;
  manualAdjustmentCents: Money;
}

export interface PhotochromicSelection {
  productId: string | null;
  colorId: string | null;
}

export interface InsuranceAllowancesInput {
  lensAllowanceCents: Money;
  additionalCreditCents: Money;
}

export interface InsuranceCopaysInput {
  lensCopayCents: Money;
  coatingCopayCents: Money;
  photochromicCopayCents: Money;
  otherCopayCents: Money;
  frameCoverage: CoverageStatus;
  lensCoverage: CoverageStatus;
  coatingCoverage: CoverageStatus;
  photochromicCoverage: CoverageStatus;
}

export interface InsuranceManualOverrideInput {
  finalPatientResponsibilityCents: Money;
  note: string;
}

export interface InsuranceInput {
  mode: InsuranceMode;
  allowances: InsuranceAllowancesInput;
  copays: InsuranceCopaysInput;
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
  frame: FrameSelection;
  lensTypeId: string | null;
  progressiveDesignId: string | null;
  materialId: string | null;
  coatingId: string | null;
  photochromic: PhotochromicSelection;
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
  additionalCreditCents: Money;
  additionalCreditAppliedCents: Money;
  additionalCreditUnusedCents: Money;
}

export interface QuoteCalculationResult {
  lineItems: QuoteLineItem[];
  retailTotalCents: Money;
  discountTotalCents: Money;
  insuranceContributionCents: Money;
  unusedAllowanceCents: Money;
  allowanceBreakdown: AllowanceBreakdown | null;
  patientResponsibilityCents: Money;
  isManualOverride: boolean;
  overrideNote: string;
  preOverridePatientResponsibilityCents: Money | null;
  warnings: string[];
}

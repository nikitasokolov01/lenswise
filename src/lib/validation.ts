import { z } from "zod";

/**
 * Zod schemas used to defensively validate pricing configuration that comes
 * back out of LocalStorage (or, in the future, a network response from a
 * Supabase-backed repository). If validation fails after migration we fall
 * back to the seeded demonstration defaults rather than crashing the app.
 */

const lensTypeKeySchema = z.enum(["single_vision", "progressive", "bifocal"]);

/** Mirrors CoverageMethod in types.ts — a category is retail, a fixed copay, or fully covered. Never a bare number. */
const coverageMethodSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("retail") }),
  z.object({ type: z.literal("copay"), amountCents: z.number().int() }),
  z.object({ type: z.literal("covered") }),
]);

const lensTypeConfigSchema = z.object({
  id: z.string().min(1),
  key: lensTypeKeySchema,
  name: z.string().min(1),
  description: z.string(),
  active: z.boolean(),
  sortOrder: z.number(),
});

const progressiveDesignConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  active: z.boolean(),
  sortOrder: z.number(),
});

const materialPriceSchema = z.object({
  id: z.string().min(1),
  lensTypeId: z.string().min(1),
  progressiveDesignId: z.string().min(1).optional(),
  priceCents: z.number().int(),
  insuranceCoverage: coverageMethodSchema.optional(),
});

const materialConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shortDescription: z.string(),
  prices: z.array(materialPriceSchema),
  appliesToHighCylinderSurfacing: z.boolean(),
  isHighIndex: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number(),
});

const coatingConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  retailPriceCents: z.number().int(),
  priceByLensType: z.record(z.string(), z.number().int()).optional(),
  insuranceCoverage: coverageMethodSchema.optional(),
  active: z.boolean(),
  sortOrder: z.number(),
});

const photochromicProductKeySchema = z.enum([
  "none",
  "house_gray",
  "house_brown",
  "transitions_gen_s",
]);

const photochromicProductConfigSchema = z.object({
  id: z.string().min(1),
  key: photochromicProductKeySchema,
  name: z.string().min(1),
  description: z.string(),
  retailPriceCents: z.number().int(),
  insuranceCoverage: coverageMethodSchema.optional(),
  requiresColorSelection: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number(),
});

const photochromicColorConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  isStandardColor: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number(),
});

const tintColorConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  customerLabel: z.string(),
  active: z.boolean(),
  sortOrder: z.number(),
  supportsSolid: z.boolean(),
  supportsGradient: z.boolean(),
  solidPriceCents: z.number().int(),
  gradientPriceCents: z.number().int(),
});

const tintConfigSchema = z.object({
  solidTintEnabled: z.boolean(),
  gradientTintEnabled: z.boolean(),
  colors: z.array(tintColorConfigSchema),
});

const defaultInsuranceCoverageSchema = z.object({
  frameCoverage: coverageMethodSchema,
  frameAllowanceCents: z.number().int(),
  lensCoverage: coverageMethodSchema,
  lensAllowanceCents: z.number().int(),
  materialCoverage: coverageMethodSchema,
  coatingCoverage: coverageMethodSchema,
  photochromicCoverage: coverageMethodSchema,
  tintCoverage: coverageMethodSchema,
  otherCopayCents: z.number().int(),
  additionalAllowanceCents: z.number().int(),
  otherChargeCents: z.number().int(),
});

export const pricingConfigurationSchema = z.object({
  schemaVersion: z.number(),
  officeName: z.string().min(1),
  disclaimerText: z.string(),
  showExactTechnologyNamesOnCustomerQuotes: z.boolean(),
  lensTypes: z.array(lensTypeConfigSchema),
  progressiveDesigns: z.array(progressiveDesignConfigSchema),
  materials: z.array(materialConfigSchema),
  coatings: z.array(coatingConfigSchema),
  photochromicProducts: z.array(photochromicProductConfigSchema),
  photochromicColors: z.array(photochromicColorConfigSchema),
  tints: tintConfigSchema,
  transitionsSurfacingFeeCents: z.number().int(),
  highCylinderSurfacingFeeCents: z.number().int(),
  highCylinderThresholdDiopters: z.number(),
  defaultInsuranceCoverage: defaultInsuranceCoverageSchema,
  updatedAt: z.string(),
});

export type PricingConfigurationParseResult =
  ReturnType<typeof pricingConfigurationSchema.safeParse>;

/** Non-negative dollar amount typed into an admin/quote input, e.g. "45" or "45.99". */
export const nonNegativeDollarStringSchema = z
  .string()
  .refine((value) => value.trim() === "" || !Number.isNaN(Number.parseFloat(value)), {
    message: "Enter a valid amount.",
  })
  .refine((value) => value.trim() === "" || Number.parseFloat(value) >= 0, {
    message: "Amount cannot be negative.",
  });

export const percentStringSchema = z
  .string()
  .refine((value) => value.trim() === "" || !Number.isNaN(Number.parseFloat(value)), {
    message: "Enter a valid percentage.",
  })
  .refine(
    (value) =>
      value.trim() === "" ||
      (Number.parseFloat(value) >= 0 && Number.parseFloat(value) <= 100),
    { message: "Percentage must be between 0 and 100." }
  );

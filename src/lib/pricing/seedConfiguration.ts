import type {
  BlueLightOptionConfig,
  CoatingConfig,
  CoverageMethod,
  LensTypeConfig,
  MaterialConfig,
  MaterialPrice,
  PhotochromicColorConfig,
  PhotochromicProductConfig,
  PricingConfiguration,
  ProgressiveDesignConfig,
  TintColorConfig,
  TintConfig,
} from "@/lib/types";

/** Selectable tint percentages — cosmetic only (percentage does not affect price). */
export const TINT_PERCENTS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;

function seedTintColor(id: string, name: string, sortOrder: number): TintColorConfig {
  return {
    id,
    name,
    customerLabel: name,
    active: true,
    sortOrder,
    supportsSolid: true,
    supportsGradient: true,
    // Demonstration pricing only — one flat price per tint type, regardless of percentage.
    solidPriceCents: 4000,
    gradientPriceCents: 5000,
  };
}

/** Seed / restore-defaults tint configuration (also used by the Admin Tints "Restore defaults" button). */
export function createDefaultTintConfig(): TintConfig {
  return {
    solidTintEnabled: true,
    gradientTintEnabled: true,
    colors: [
      seedTintColor("tint-gray", "Gray", 0),
      seedTintColor("tint-brown", "Brown", 1),
      seedTintColor("tint-green", "Green", 2),
      seedTintColor("tint-blue", "Blue", 3),
      seedTintColor("tint-rose", "Rose", 4),
    ],
  };
}

/** Shorthand for the common case of a fixed-dollar copay coverage method. */
function copay(amountCents: number): CoverageMethod {
  return { type: "copay", amountCents };
}

/**
 * Seed / "restore defaults" pricing configuration.
 *
 * Every price below is a clearly fictional demonstration value used so the
 * interface works immediately after install. An office MUST replace these
 * with its own approved price list from Admin Pricing before using this
 * tool with real patients. Do not present these numbers as accurate or
 * industry-standard retail pricing.
 */

export const SCHEMA_VERSION = 11;

/**
 * Lens type is purely "what optical design is this lens" (Single Vision /
 * Progressive / Bifocal). Whether a frame or lenses are on the order at all
 * is a separate, top-level "order type" choice (see OrderType in types.ts)
 * made in the Frame step — Lens Only and Frame Only are NOT lens types, so
 * a Lens Only order still picks a real lens type + material here, just like
 * a Complete Pair order, only without a frame charge.
 */
const lensTypes: LensTypeConfig[] = [
  {
    id: "lens-type-single-vision",
    key: "single_vision",
    name: "Single Vision",
    description: "One correction across the full lens.",
    active: true,
    sortOrder: 0,
  },
  {
    id: "lens-type-progressive",
    key: "progressive",
    name: "Progressive",
    description: "No-line lens with a gradual range of corrections.",
    active: true,
    sortOrder: 1,
  },
  {
    id: "lens-type-bifocal",
    key: "bifocal",
    name: "Bifocal",
    description: "Two corrections with a visible dividing line.",
    active: true,
    sortOrder: 2,
  },
];

const LENS_TYPE_SINGLE_VISION = "lens-type-single-vision";
const LENS_TYPE_PROGRESSIVE = "lens-type-progressive";
const LENS_TYPE_BIFOCAL = "lens-type-bifocal";

const progressiveDesigns: ProgressiveDesignConfig[] = [
  {
    id: "progressive-design-standard",
    name: "Standard Progressive",
    description: "Conventional progressive design with a moderate viewing corridor.",
    active: true,
    sortOrder: 0,
  },
  {
    id: "progressive-design-premium",
    name: "Premium Progressive",
    description: "Wider viewing corridors with reduced peripheral distortion.",
    active: true,
    sortOrder: 1,
  },
  {
    id: "progressive-design-elite",
    name: "Elite Progressive",
    description: "Fully personalized digital design for the widest fields of view.",
    active: true,
    sortOrder: 2,
  },
];

const PROGRESSIVE_STANDARD = "progressive-design-standard";
const PROGRESSIVE_PREMIUM = "progressive-design-premium";
const PROGRESSIVE_ELITE = "progressive-design-elite";

/**
 * Builds the full MaterialPrice matrix for one material: a flat price for
 * Single Vision and Bifocal, plus one price per progressive design. This is
 * demonstration data only — see the module-level comment. A Lens Only order
 * reuses these exact same prices (it picks a real lens type + material just
 * like Complete Pair); there is no separate "Lens Only" price bucket.
 */
function buildMaterialPrices(options: {
  materialSlug: string;
  singleVisionCents: number;
  bifocalCents: number;
  progressiveStandardCents: number;
  progressivePremiumCents: number;
  progressiveEliteCents: number;
  insuranceCopayCents: number;
}): MaterialPrice[] {
  const {
    materialSlug,
    singleVisionCents,
    bifocalCents,
    progressiveStandardCents,
    progressivePremiumCents,
    progressiveEliteCents,
    insuranceCopayCents,
  } = options;
  const insuranceCoverage = copay(insuranceCopayCents);

  return [
    {
      id: `price-${materialSlug}-single-vision`,
      lensTypeId: LENS_TYPE_SINGLE_VISION,
      priceCents: singleVisionCents,
      insuranceCoverage,
    },
    {
      id: `price-${materialSlug}-bifocal`,
      lensTypeId: LENS_TYPE_BIFOCAL,
      priceCents: bifocalCents,
      insuranceCoverage,
    },
    {
      id: `price-${materialSlug}-progressive-standard`,
      lensTypeId: LENS_TYPE_PROGRESSIVE,
      progressiveDesignId: PROGRESSIVE_STANDARD,
      priceCents: progressiveStandardCents,
      insuranceCoverage,
    },
    {
      id: `price-${materialSlug}-progressive-premium`,
      lensTypeId: LENS_TYPE_PROGRESSIVE,
      progressiveDesignId: PROGRESSIVE_PREMIUM,
      priceCents: progressivePremiumCents,
      insuranceCoverage,
    },
    {
      id: `price-${materialSlug}-progressive-elite`,
      lensTypeId: LENS_TYPE_PROGRESSIVE,
      progressiveDesignId: PROGRESSIVE_ELITE,
      priceCents: progressiveEliteCents,
      insuranceCoverage,
    },
  ];
}

const materials: MaterialConfig[] = [
  {
    id: "material-cr39",
    name: "CR-39",
    shortDescription: "Standard plastic lens material.",
    active: true,
    sortOrder: 0,
    // CR-39 edges/surfaces well at high-minus cylinder without extra lab work.
    appliesToHighCylinderSurfacing: false,
    isHighIndex: false,
    compatibleLensTypeIds: [],
    compatibleProgressiveDesignIds: [],
    prices: buildMaterialPrices({
      materialSlug: "cr39",
      singleVisionCents: 6500,
      bifocalCents: 14500,
      progressiveStandardCents: 22000,
      progressivePremiumCents: 30000,
      progressiveEliteCents: 38000,
      insuranceCopayCents: 0,
    }),
  },
  {
    id: "material-polycarbonate",
    name: "Polycarbonate",
    shortDescription: "Thinner and significantly more impact-resistant than CR-39.",
    active: true,
    sortOrder: 1,
    // Polycarbonate requires custom surfacing to edge cleanly at high-minus
    // cylinder (and is not high index, so it takes the prescription fee).
    appliesToHighCylinderSurfacing: true,
    isHighIndex: false,
    compatibleLensTypeIds: [],
    compatibleProgressiveDesignIds: [],
    prices: buildMaterialPrices({
      materialSlug: "polycarbonate",
      singleVisionCents: 10000,
      bifocalCents: 18500,
      progressiveStandardCents: 26500,
      progressivePremiumCents: 34500,
      progressiveEliteCents: 42500,
      insuranceCopayCents: 1500,
    }),
  },
  {
    id: "material-hi-167",
    name: "High Index 1.67",
    shortDescription: "Thinner and lighter, recommended for stronger prescriptions.",
    active: true,
    sortOrder: 2,
    // High-index blanks need extra lab work, but the office handles them with
    // a different process, so they are EXCLUDED from the prescription-based
    // high-cylinder surfacing fee via isHighIndex (see rules.ts).
    appliesToHighCylinderSurfacing: true,
    isHighIndex: true,
    compatibleLensTypeIds: [],
    compatibleProgressiveDesignIds: [],
    prices: buildMaterialPrices({
      materialSlug: "hi167",
      singleVisionCents: 14500,
      bifocalCents: 23500,
      progressiveStandardCents: 32000,
      progressivePremiumCents: 40000,
      progressiveEliteCents: 48000,
      insuranceCopayCents: 3500,
    }),
  },
];

const coatings: CoatingConfig[] = [
  {
    id: "coating-none",
    name: "No AR",
    description: "No anti-reflective coating.",
    retailPriceCents: 0,
    active: true,
    sortOrder: 0,
  },
  {
    id: "coating-stock-ar",
    name: "Stock AR",
    description: "Basic anti-reflective coating.",
    retailPriceCents: 5000,
    insuranceCoverage: copay(2000),
    active: true,
    sortOrder: 1,
  },
  {
    id: "coating-sharpview",
    name: "SharpView",
    description: "Mid-tier anti-reflective coating with smudge resistance.",
    retailPriceCents: 8500,
    insuranceCoverage: copay(3000),
    active: true,
    sortOrder: 2,
  },
  {
    id: "coating-crizal-rock",
    name: "Crizal Rock",
    description: "Premium scratch-resistant anti-reflective coating.",
    retailPriceCents: 13500,
    insuranceCoverage: copay(4000),
    active: true,
    sortOrder: 3,
  },
  {
    id: "coating-crizal-sapphire",
    name: "Crizal Sapphire",
    description: "Premium anti-reflective coating with reduced residual reflection.",
    retailPriceCents: 15000,
    insuranceCoverage: copay(4000),
    active: true,
    sortOrder: 4,
  },
  {
    id: "coating-crizal-prevencia",
    name: "Crizal Prevencia",
    description: "Premium anti-reflective coating that also filters some blue-violet light.",
    retailPriceCents: 17500,
    insuranceCoverage: copay(4500),
    active: true,
    sortOrder: 5,
  },
];

const photochromicProducts: PhotochromicProductConfig[] = [
  {
    id: "photo-none",
    key: "none",
    name: "None",
    description: "No photochromic / light-adaptive option.",
    retailPriceCents: 0,
    requiresColorSelection: false,
    active: true,
    sortOrder: 0,
  },
  {
    id: "photo-house-gray",
    key: "house_gray",
    name: "House Photochromic Gray",
    description: "In-house light-adaptive lens tint, gray.",
    retailPriceCents: 7500,
    insuranceCoverage: copay(2000),
    requiresColorSelection: false,
    active: true,
    sortOrder: 1,
  },
  {
    id: "photo-house-brown",
    key: "house_brown",
    name: "House Photochromic Brown",
    description: "In-house light-adaptive lens tint, brown.",
    retailPriceCents: 7500,
    insuranceCoverage: copay(2000),
    requiresColorSelection: false,
    active: true,
    sortOrder: 2,
  },
  {
    id: "photo-transitions-gen-s",
    key: "transitions_gen_s",
    name: "Transitions Gen S",
    description: "Branded light-adaptive lens with a choice of colors.",
    retailPriceCents: 11000,
    insuranceCoverage: copay(2500),
    requiresColorSelection: true,
    active: true,
    sortOrder: 3,
  },
];

const photochromicColors: PhotochromicColorConfig[] = [
  { id: "color-gray", name: "Gray", isStandardColor: true, active: true, sortOrder: 0 },
  { id: "color-brown", name: "Brown", isStandardColor: true, active: true, sortOrder: 1 },
  { id: "color-graphite-green", name: "Graphite Green", isStandardColor: false, active: true, sortOrder: 2 },
  { id: "color-sapphire", name: "Sapphire", isStandardColor: false, active: true, sortOrder: 3 },
  { id: "color-amethyst", name: "Amethyst", isStandardColor: false, active: true, sortOrder: 4 },
  { id: "color-amber", name: "Amber", isStandardColor: false, active: true, sortOrder: 5 },
  { id: "color-emerald", name: "Emerald", isStandardColor: false, active: true, sortOrder: 6 },
  { id: "color-ruby", name: "Ruby", isStandardColor: false, active: true, sortOrder: 7 },
];

const blueLightOptions: BlueLightOptionConfig[] = [
  {
    id: "blue-light-none",
    name: "None",
    customerLabel: "No Blue Light Filter",
    description: "No blue-light filtering.",
    retailPriceCents: 0,
    active: true,
    sortOrder: 0,
  },
  {
    id: "blue-light-filter",
    name: "Blue Light Filter",
    customerLabel: "Blue Light Filter",
    description: "Filters a portion of blue-violet light for screen-heavy days.",
    retailPriceCents: 4000,
    active: true,
    sortOrder: 1,
  },
];

export function createDefaultConfiguration(): PricingConfiguration {
  return {
    schemaVersion: SCHEMA_VERSION,
    officeName: "Your Optical Office",
    disclaimerText:
      "This is an estimate only and may be subject to insurance verification, plan-year benefit changes, and final prescription requirements.",
    // Off by default: customer-facing quotes show generalized product names,
    // never exact brands/technologies or progressive design names.
    showExactTechnologyNamesOnCustomerQuotes: false,
    lensTypes: lensTypes.map((item) => ({ ...item })),
    progressiveDesigns: progressiveDesigns.map((item) => ({ ...item })),
    materials: materials.map((item) => ({ ...item, prices: item.prices.map((price) => ({ ...price })) })),
    coatings: coatings.map((item) => ({ ...item })),
    photochromicProducts: photochromicProducts.map((item) => ({ ...item })),
    photochromicColors: photochromicColors.map((item) => ({ ...item })),
    tints: createDefaultTintConfig(),
    blueLightOptions: blueLightOptions.map((item) => ({ ...item })),
    transitionsSurfacingFeeCents: 3000,
    highCylinderSurfacingFeeCents: 4500,
    highCylinderThresholdDiopters: -2,
    defaultInsuranceCoverage: {
      // Sensible demonstration defaults: every category starts at Retail so a
      // new quote shows real prices, and the optician opts specific categories
      // into Copay/Covered as the patient's plan dictates. Frame at retail lets
      // the frame allowance below offset it (patient pays any overage). A copay
      // would instead REPLACE that category's retail cost — see resolveCategory
      // in calculateQuote.ts. `materialCoverage` is retained only for backward
      // compatibility; the lens+material price is governed by `lensCoverage`.
      frameCoverage: { type: "retail" },
      frameAllowanceCents: 13000,
      lensCoverage: { type: "retail" },
      lensAllowanceCents: 0,
      materialCoverage: { type: "retail" },
      coatingCoverage: { type: "retail" },
      photochromicCoverage: { type: "retail" },
      tintCoverage: { type: "retail" },
      blueLightCoverage: { type: "retail" },
      surfacingCoverage: { type: "retail" },
      otherCopayCents: 0,
      additionalAllowanceCents: 0,
      otherChargeCents: 0,
    },
    updatedAt: new Date(0).toISOString(),
  };
}

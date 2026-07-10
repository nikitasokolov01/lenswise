import type {
  CoatingConfig,
  LensTypeConfig,
  MaterialConfig,
  MaterialPrice,
  PhotochromicColorConfig,
  PhotochromicProductConfig,
  PricingConfiguration,
  ProgressiveDesignConfig,
} from "@/lib/types";

/**
 * Seed / "restore defaults" pricing configuration.
 *
 * Every price below is a clearly fictional demonstration value used so the
 * interface works immediately after install. An office MUST replace these
 * with its own approved price list from Admin Pricing before using this
 * tool with real patients. Do not present these numbers as accurate or
 * industry-standard retail pricing.
 */

export const SCHEMA_VERSION = 1;

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
  {
    id: "lens-type-lens-only",
    key: "lens_only",
    name: "Lens Only",
    description: "New lenses only, e.g. into a patient-owned frame. No frame charge.",
    active: true,
    sortOrder: 3,
  },
  {
    id: "lens-type-frame-only",
    key: "frame_only",
    name: "Frame Only",
    description: "Frame purchase only. No lenses on this order.",
    active: true,
    sortOrder: 4,
  },
];

const LENS_TYPE_SINGLE_VISION = "lens-type-single-vision";
const LENS_TYPE_PROGRESSIVE = "lens-type-progressive";
const LENS_TYPE_BIFOCAL = "lens-type-bifocal";
const LENS_TYPE_LENS_ONLY = "lens-type-lens-only";

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
 * Single Vision, Bifocal, and Lens Only, plus one price per progressive
 * design. This is demonstration data only — see the module-level comment.
 */
function buildMaterialPrices(options: {
  materialSlug: string;
  singleVisionCents: number;
  bifocalCents: number;
  lensOnlyCents: number;
  progressiveStandardCents: number;
  progressivePremiumCents: number;
  progressiveEliteCents: number;
  insuranceCopayCents: number;
}): MaterialPrice[] {
  const {
    materialSlug,
    singleVisionCents,
    bifocalCents,
    lensOnlyCents,
    progressiveStandardCents,
    progressivePremiumCents,
    progressiveEliteCents,
    insuranceCopayCents,
  } = options;

  return [
    {
      id: `price-${materialSlug}-single-vision`,
      lensTypeId: LENS_TYPE_SINGLE_VISION,
      priceCents: singleVisionCents,
      insuranceCopayCents,
    },
    {
      id: `price-${materialSlug}-bifocal`,
      lensTypeId: LENS_TYPE_BIFOCAL,
      priceCents: bifocalCents,
      insuranceCopayCents,
    },
    {
      id: `price-${materialSlug}-lens-only`,
      lensTypeId: LENS_TYPE_LENS_ONLY,
      priceCents: lensOnlyCents,
      insuranceCopayCents,
    },
    {
      id: `price-${materialSlug}-progressive-standard`,
      lensTypeId: LENS_TYPE_PROGRESSIVE,
      progressiveDesignId: PROGRESSIVE_STANDARD,
      priceCents: progressiveStandardCents,
      insuranceCopayCents,
    },
    {
      id: `price-${materialSlug}-progressive-premium`,
      lensTypeId: LENS_TYPE_PROGRESSIVE,
      progressiveDesignId: PROGRESSIVE_PREMIUM,
      priceCents: progressivePremiumCents,
      insuranceCopayCents,
    },
    {
      id: `price-${materialSlug}-progressive-elite`,
      lensTypeId: LENS_TYPE_PROGRESSIVE,
      progressiveDesignId: PROGRESSIVE_ELITE,
      priceCents: progressiveEliteCents,
      insuranceCopayCents,
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
    prices: buildMaterialPrices({
      materialSlug: "cr39",
      singleVisionCents: 6500,
      bifocalCents: 14500,
      lensOnlyCents: 6500,
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
    prices: buildMaterialPrices({
      materialSlug: "polycarbonate",
      singleVisionCents: 10000,
      bifocalCents: 18500,
      lensOnlyCents: 10000,
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
    prices: buildMaterialPrices({
      materialSlug: "hi167",
      singleVisionCents: 14500,
      bifocalCents: 23500,
      lensOnlyCents: 14500,
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
    insuranceCopayCents: 2000,
    active: true,
    sortOrder: 1,
  },
  {
    id: "coating-sharpview",
    name: "SharpView",
    description: "Mid-tier anti-reflective coating with smudge resistance.",
    retailPriceCents: 8500,
    insuranceCopayCents: 3000,
    active: true,
    sortOrder: 2,
  },
  {
    id: "coating-crizal-rock",
    name: "Crizal Rock",
    description: "Premium scratch-resistant anti-reflective coating.",
    retailPriceCents: 13500,
    insuranceCopayCents: 4000,
    active: true,
    sortOrder: 3,
  },
  {
    id: "coating-crizal-sapphire",
    name: "Crizal Sapphire",
    description: "Premium anti-reflective coating with reduced residual reflection.",
    retailPriceCents: 15000,
    insuranceCopayCents: 4000,
    active: true,
    sortOrder: 4,
  },
  {
    id: "coating-crizal-prevencia",
    name: "Crizal Prevencia",
    description: "Premium anti-reflective coating that also filters some blue-violet light.",
    retailPriceCents: 17500,
    insuranceCopayCents: 4500,
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
    insuranceCopayCents: 2000,
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
    insuranceCopayCents: 2000,
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
    insuranceCopayCents: 2500,
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

export function createDefaultConfiguration(): PricingConfiguration {
  return {
    schemaVersion: SCHEMA_VERSION,
    officeName: "Sample Optical Office",
    disclaimerText:
      "This is an estimate only and may be subject to insurance verification, plan-year benefit changes, and final prescription requirements.",
    lensTypes: lensTypes.map((item) => ({ ...item })),
    progressiveDesigns: progressiveDesigns.map((item) => ({ ...item })),
    materials: materials.map((item) => ({ ...item, prices: item.prices.map((price) => ({ ...price })) })),
    coatings: coatings.map((item) => ({ ...item })),
    photochromicProducts: photochromicProducts.map((item) => ({ ...item })),
    photochromicColors: photochromicColors.map((item) => ({ ...item })),
    transitionsSurfacingFeeCents: 3000,
    defaultAllowances: {
      frameAllowanceCents: 13000,
      lensAllowanceCents: 0,
      additionalCreditCents: 0,
    },
    defaultCopays: {
      frameCopayCents: 0,
      lensCopayCents: 1000,
      coatingCopayCents: 0,
      photochromicCopayCents: 0,
      otherCopayCents: 0,
    },
    updatedAt: new Date(0).toISOString(),
  };
}

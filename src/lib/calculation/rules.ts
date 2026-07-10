import { generateId } from "@/lib/id";
import type {
  LensTypeConfig,
  PhotochromicColorConfig,
  PhotochromicProductConfig,
  PricingConfiguration,
  QuoteInput,
  QuoteLineItem,
} from "@/lib/types";

/**
 * Conditional fee rules engine.
 *
 * Each rule inspects the current quote input + configuration and returns a
 * QuoteLineItem when its condition is met, or null otherwise. To add a new
 * automatic fee later, add another entry to `conditionalFeeRules` — nothing
 * else in the calculation engine needs to change.
 */
export interface ConditionalFeeContext {
  input: QuoteInput;
  config: PricingConfiguration;
  lensType: LensTypeConfig | undefined;
  photochromicProduct: PhotochromicProductConfig | undefined;
  photochromicColor: PhotochromicColorConfig | undefined;
}

export interface ConditionalFeeRule {
  id: string;
  evaluate: (context: ConditionalFeeContext) => QuoteLineItem | null;
}

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
  evaluate({ input, config, lensType, photochromicProduct, photochromicColor }) {
    if (!lensType || lensType.key !== "single_vision") return null;
    if (!photochromicProduct || photochromicProduct.key !== "transitions_gen_s") return null;
    if (!photochromicColor) return null;
    if (photochromicColor.isStandardColor) return null;
    if (config.transitionsSurfacingFeeCents <= 0) return null;

    return {
      id: generateId("fee"),
      label: "Transitions custom-color surfacing fee",
      description: `Applies to Single Vision + Transitions Gen S in ${photochromicColor.name}.`,
      category: "fee",
      amountCents: config.transitionsSurfacingFeeCents,
      calculationSource: "rule",
    };
  },
};

/**
 * Ordered list of every conditional fee rule the calculation engine should
 * evaluate. Append additional rules here as new business logic is added.
 */
export const conditionalFeeRules: ConditionalFeeRule[] = [transitionsSurfacingFeeRule];

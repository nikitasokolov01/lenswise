import { calculateQuote } from "@/lib/calculation/calculateQuote";
import type { QuotePair } from "@/components/quote/quoteSessionReducer";
import type { InsuranceBreakdown, PricingConfiguration, QuoteCalculationResult } from "@/lib/types";

export interface CalculatedQuotePair extends QuotePair {
  label: string;
  result: QuoteCalculationResult;
}

export function calculateQuoteSession(pairs: QuotePair[], config: PricingConfiguration) {
  const calculated: CalculatedQuotePair[] = pairs.map((pair, index) => ({
    ...pair,
    label: `Pair ${index + 1}`,
    result: calculateQuote(pair.input, config),
  }));
  return {
    pairs: calculated,
    patientResponsibilityCents: calculated.reduce((total, pair) => total + pair.result.patientResponsibilityCents, 0),
    retailTotalCents: calculated.reduce((total, pair) => total + pair.result.retailTotalCents, 0),
    discountTotalCents: calculated.reduce((total, pair) => total + pair.result.discountTotalCents, 0),
    insuranceContributionCents: calculated.reduce((total, pair) => total + pair.result.insuranceContributionCents, 0),
  };
}

/** Customer display only. Each pair is calculated/clamped independently first. */
export function combineQuoteResults(pairs: CalculatedQuotePair[]): QuoteCalculationResult {
  if (pairs.length === 0) throw new Error("A quote must contain at least one pair.");
  const sum = (field: "retailTotalCents" | "discountTotalCents" | "copayTotalCents" | "insuranceContributionCents" | "nonCoveredChargeCents" | "unusedAllowanceCents" | "patientResponsibilityCents" | "surfacingFeeCents") =>
    pairs.reduce((total, pair) => total + pair.result[field], 0);
  const breakdowns = pairs.map((pair) => pair.result.insuranceBreakdown).filter((b): b is InsuranceBreakdown => b !== null);
  let insuranceBreakdown: InsuranceBreakdown | null = null;
  if (breakdowns.length) {
    insuranceBreakdown = { ...breakdowns[0] };
    for (const key of Object.keys(insuranceBreakdown) as (keyof InsuranceBreakdown)[]) {
      insuranceBreakdown[key] = breakdowns.reduce((total, b) => total + b[key], 0);
    }
  }
  return {
    ...pairs[0].result,
    lineItems: pairs.flatMap((pair) => pair.result.lineItems.map((item) => ({
      ...item,
      id: `${pair.id}-${item.id}`,
      label: `${pair.label} — ${item.label}`,
      customerLabel: `${pair.label} — ${item.customerLabel}`,
    }))),
    retailTotalCents: sum("retailTotalCents"),
    discountTotalCents: sum("discountTotalCents"),
    copayTotalCents: sum("copayTotalCents"),
    insuranceContributionCents: sum("insuranceContributionCents"),
    nonCoveredChargeCents: sum("nonCoveredChargeCents"),
    unusedAllowanceCents: sum("unusedAllowanceCents"),
    patientResponsibilityCents: sum("patientResponsibilityCents"),
    surfacingFeeCents: sum("surfacingFeeCents"),
    allowanceBreakdown: null,
    insuranceBreakdown,
    surfacingFeeReasons: [],
    isManualOverride: pairs.some((pair) => pair.result.isManualOverride),
    overrideNote: "",
    preOverridePatientResponsibilityCents: null,
    warnings: pairs.flatMap((pair) => pair.result.warnings.map((warning) => `${pair.label}: ${warning}`)),
  };
}

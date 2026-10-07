import { describe, expect, it } from "vitest";
import { createQuoteSession, quoteSessionReducer } from "@/components/quote/quoteSessionReducer";
import { createDefaultConfiguration as createSeedConfiguration } from "@/lib/pricing/seedConfiguration";
import { calculateQuoteSession, combineQuoteResults } from "@/lib/calculation/quoteSession";

describe("multi-pair totals", () => {
  it("discounts one pair only and sums the separate totals", () => {
    const config = createSeedConfiguration();
    let session = createQuoteSession(config);
    session = quoteSessionReducer(session, { type: "ADD_PAIR", config, id: "second", saleKey: "second-sale" });
    session.pairs[0].input.orderType = "frame_only";
    session.pairs[0].input.frame.retailPriceCents = 40000;
    session.pairs[1].input.orderType = "frame_only";
    session.pairs[1].input.frame.retailPriceCents = 30000;
    session.pairs[1].input.adjustments = [{ id: "bogo", type: "percent_discount", percent: 50, amountCents: 0, label: "Second pair 50% off" }];
    const result = calculateQuoteSession(session.pairs, config);
    expect(result.pairs[0].result.patientResponsibilityCents).toBe(40000);
    expect(result.pairs[1].result.patientResponsibilityCents).toBe(15000);
    expect(result.patientResponsibilityCents).toBe(55000);
    const combined = combineQuoteResults(result.pairs);
    expect(combined.patientResponsibilityCents).toBe(55000);
    expect(combined.lineItems.every((item) => item.customerLabel.startsWith("Pair "))).toBe(true);
  });

  it("never lets excess discount on one pair reduce another pair", () => {
    const config = createSeedConfiguration();
    let session = createQuoteSession(config);
    session = quoteSessionReducer(session, { type: "ADD_PAIR", config, id: "second", saleKey: "second-sale" });
    session.pairs.forEach((pair) => { pair.input.orderType = "frame_only"; pair.input.frame.retailPriceCents = 10000; });
    session.pairs[0].input.adjustments = [{ id: "huge", type: "fixed_discount", percent: 0, amountCents: 15000, label: "Discount" }];
    expect(combineQuoteResults(calculateQuoteSession(session.pairs, config).pairs).patientResponsibilityCents).toBe(10000);
  });

  it("retains each pair's separate insurance allowance math", () => {
    const config = createSeedConfiguration();
    let session = createQuoteSession(config);
    session = quoteSessionReducer(session, { type: "ADD_PAIR", config, id: "second", saleKey: "second-sale" });
    session.pairs.forEach((pair) => { pair.input.orderType = "frame_only"; pair.input.frame.retailPriceCents = 30000; });
    session.pairs[0].input.insurance.mode = "insurance";
    session.pairs[0].input.insurance.coverage.frameCoverage = { type: "retail" };
    session.pairs[0].input.insurance.coverage.frameAllowanceCents = 20000;
    const combined = combineQuoteResults(calculateQuoteSession(session.pairs, config).pairs);
    expect(combined.insuranceBreakdown?.frameAllowanceAppliedCents).toBe(20000);
    expect(combined.patientResponsibilityCents).toBe(40000);
  });
});

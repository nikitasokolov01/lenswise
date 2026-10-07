import { describe, expect, it } from "vitest";
import { quoteReducer } from "@/components/quote/quoteReducer";
import { createDefaultQuoteInput } from "@/lib/calculation/defaultQuoteInput";
import { calculateQuote } from "@/lib/calculation/calculateQuote";
import { createDefaultConfiguration } from "@/lib/pricing/seedConfiguration";

describe("frame allowance quick choices", () => {
  it("replaces only the frame allowance, keeps manual edits available, and caps coverage at frame retail", () => {
    const config = createDefaultConfiguration();
    config.frameAllowanceShortcuts.enabled = true;
    const input = { ...createDefaultQuoteInput(config), orderType: "frame_only" as const };
    input.insurance = { ...input.insurance, mode: "insurance" };
    input.frame = { ...input.frame, entryMode: "manual", retailPriceCents: 25000 };
    const next = quoteReducer(input, {
      type: "SET_INSURANCE_COVERAGE_FIELD", field: "frameAllowanceCents",
      value: config.frameAllowanceShortcuts.amountsCents[2],
    });
    expect(calculateQuote(next, config).patientResponsibilityCents).toBe(0);
    expect(next.insurance.coverage.frameCoverage).toEqual(input.insurance.coverage.frameCoverage);
    expect(next.insurance.coverage.lensAllowanceCents).toBe(input.insurance.coverage.lensAllowanceCents);
    expect(config.defaultInsuranceCoverage.frameAllowanceCents).toBe(13000);
    const edited = quoteReducer(next, {
      type: "SET_INSURANCE_COVERAGE_FIELD", field: "frameAllowanceCents", value: 10000,
    });
    expect(calculateQuote(edited, config).patientResponsibilityCents).toBe(15000);
  });
});

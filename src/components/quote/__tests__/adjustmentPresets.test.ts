import { describe, expect, it } from "vitest";
import { quoteReducer } from "@/components/quote/quoteReducer";
import { createDefaultQuoteInput } from "@/lib/calculation/defaultQuoteInput";
import { calculateQuote } from "@/lib/calculation/calculateQuote";
import { createDefaultConfiguration } from "@/lib/pricing/seedConfiguration";

describe("quick adjustment presets", () => {
  it("copies a reusable discount into the pair and allows editing without changing the preset", () => {
    const config = createDefaultConfiguration();
    const values = { label: "First purchase", amountCents: 10000, percent: 0 };
    const input = { ...createDefaultQuoteInput(config), orderType: "frame_only" as const };
    input.frame = { ...input.frame, entryMode: "manual", retailPriceCents: 20000 };
    const next = quoteReducer(input, { type: "ADD_ADJUSTMENT", adjustmentType: "fixed_discount", values });
    expect(calculateQuote(next, config).patientResponsibilityCents).toBe(10000);
    expect(input.adjustments).toEqual([]);
    const edited = quoteReducer(next, { type: "UPDATE_ADJUSTMENT", id: next.adjustments[0].id, patch: { amountCents: 5000 } });
    expect(calculateQuote(edited, config).patientResponsibilityCents).toBe(15000);
    expect(values.amountCents).toBe(10000);
  });

  it("supports a saved 50 percent second-pair discount and unique adjustment ids", () => {
    const config = createDefaultConfiguration();
    const input = { ...createDefaultQuoteInput(config), orderType: "frame_only" as const };
    input.frame = { ...input.frame, entryMode: "manual", retailPriceCents: 20000 };
    const next = quoteReducer(input, {
      type: "ADD_ADJUSTMENT", adjustmentType: "percent_discount",
      values: { label: "Second pair", amountCents: 0, percent: 50 },
    });
    expect(calculateQuote(next, config).patientResponsibilityCents).toBe(10000);
    const again = quoteReducer(next, { type: "ADD_ADJUSTMENT", adjustmentType: "charge" });
    expect(again.adjustments[0].id).not.toBe(again.adjustments[1].id);
    expect(again.adjustments[1]).toMatchObject({ amountCents: 0, percent: 0, label: "" });
  });
});

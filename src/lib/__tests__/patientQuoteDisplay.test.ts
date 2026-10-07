import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PatientView } from "@/components/quote/PatientView";
import { patientDisplaySections, patientInsuranceLines, type PatientQuotePair } from "@/lib/patientQuoteDisplay";
import { createDefaultConfiguration } from "@/lib/pricing/seedConfiguration";
import { createDefaultQuoteInput } from "@/lib/calculation/defaultQuoteInput";
import { calculateQuote } from "@/lib/calculation/calculateQuote";
import type { QuoteLineItem, QuoteLineItemCategory } from "@/lib/types";

function line(category: QuoteLineItemCategory, index: number): QuoteLineItem {
  return {
    id: `item-${index}`, category, label: `Exact technology ${index}`,
    customerLabel: `Customer option ${index}`, description: `Internal technology description ${index}`,
    amountCents: index + 100, calculationSource: "configured",
  };
}

describe("patient quote sections", () => {
  it("groups all selections in a consistent order without omitting fees or custom charges", () => {
    const categories: QuoteLineItemCategory[] = ["discount", "custom", "fee", "blue_light", "tint", "photochromic", "coating", "material", "lens", "frame", "insurance"];
    const items = categories.map(line);
    const sections = patientDisplaySections(items, false);
    expect(sections.map((section) => section.title)).toEqual(["Frame", "Lenses", "Coating", "Upgrades", "Discounts Applied", "Insurance"]);
    expect(sections.find((section) => section.title === "Upgrades")?.items).toHaveLength(5);
    expect(sections.flatMap((section) => section.items)).toHaveLength(items.length);
    expect(sections.find((section) => section.title === "Discounts Applied")?.items[0].amountCents).toBe(-100);
    expect(items[0].amountCents).toBe(100);
  });

  it("keeps exact names and technical descriptions hidden unless the office enables them", () => {
    const items = [line("coating", 1)];
    expect(patientDisplaySections(items, false)[0].items[0]).toEqual({ id: "item-1", label: "Customer option 1", amountCents: 101 });
    expect(patientDisplaySections(items, true)[0].items[0]).toMatchObject({ label: "Exact technology 1", description: "Internal technology description 1", amountCents: 101 });
    expect(patientDisplaySections([], false)).toEqual([]);
  });
});

describe("pair cards in patient view", () => {
  function fixture() {
    const config = createDefaultConfiguration();
    const first = createDefaultQuoteInput(config);
    first.orderType = "frame_only";
    first.frame = { ...first.frame, entryMode: "manual", customDescription: "Frame A", retailPriceCents: 20000 };
    first.insurance.mode = "insurance";
    first.insurance.coverage.frameAllowanceCents = 10000;
    const second = createDefaultQuoteInput(config);
    second.orderType = "frame_only";
    second.frame = { ...second.frame, entryMode: "manual", customDescription: "Frame B", retailPriceCents: 10000 };
    second.adjustments = [{ id: "half-off", type: "percent_discount", label: "Second pair discount", percent: 50, amountCents: 0 }];
    const pairs: PatientQuotePair[] = [
      { id: "first", label: "Pair 1", result: calculateQuote(first, config), usage: null },
      { id: "second", label: "Pair 2", result: calculateQuote(second, config), usage: "sunglasses" },
    ];
    return { config, pairs };
  }

  it("renders separate cards, each pair's insurance/discount and subtotal, and a combined total", () => {
    const { config, pairs } = fixture();
    const markup = renderToStaticMarkup(createElement(PatientView, { config, pairs, result: pairs[0].result, usage: null, onClose: () => {} }));
    expect(markup).toContain('id="patient-first-title"');
    expect(markup).toContain('id="patient-second-title"');
    expect(markup).toContain(">Pair 1</h2>");
    expect(markup).toContain(">Pair 2</h2>");
    expect(markup).not.toContain("Pair 1 —");
    expect(markup).not.toContain("Pair 2 —");
    expect(markup).toContain("Frame allowance");
    expect(markup).toContain("Discounts Applied");
    expect(markup).toContain("$100.00");
    expect(markup).toContain("$50.00");
    expect(markup).toContain("$150.00");
    expect(markup).toContain("Combined total");
    const insurance = patientInsuranceLines(pairs[0].result.insuranceBreakdown!);
    expect(insurance.insurance).toContainEqual({ label: "Frame allowance", cents: 10000 });
    expect(pairs[1].result.insuranceBreakdown).toBeNull();
  });

  it("uses one card for the single-pair fallback and hides internal override notes", () => {
    const { config, pairs } = fixture();
    pairs[0].result.overrideNote = "Internal only sentinel";
    pairs[0].result.isManualOverride = true;
    const markup = renderToStaticMarkup(createElement(PatientView, { config, result: pairs[0].result, usage: null, onClose: () => {} }));
    expect(markup).toContain(">Pair 1</h2>");
    expect(markup).not.toContain("Pair 2");
    expect(markup).toContain("Your total");
    expect(markup).toContain("Final price set by your optician");
    expect(markup).not.toContain("Internal only sentinel");
  });
});

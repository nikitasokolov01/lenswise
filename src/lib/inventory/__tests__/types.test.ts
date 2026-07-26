import { describe, expect, it } from "vitest";
import {
  groupQuoteFrameInventoryByModel,
  type QuoteFrameInventoryOption,
} from "@/lib/inventory/types";

function frame(
  id: string,
  model: string,
  color: string,
  eyeSizeMm: number
): QuoteFrameInventoryOption {
  return {
    id,
    brand: "Genevieve Boutique",
    model,
    color,
    imageUrl: null,
    eyeSizeMm,
    bridgeSizeMm: 18,
    templeLengthMm: 135,
    sku: null,
    upc: null,
    retailPriceCents: 14900,
    quantityOnHand: 1,
  };
}

describe("quote frame inventory model groups", () => {
  it("keeps color and size inventory variants under one brand and model", () => {
    const groups = groupQuoteFrameInventoryByModel([
      frame("blue-52", "Alibi", "Blue", 52),
      frame("black-52", "Alibi", "Black", 52),
      frame("black-54", "Alibi", "Black", 54),
      frame("ruby-52", "Amour", "Ruby", 52),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      brand: "Genevieve Boutique",
      model: "Alibi",
    });
    expect(groups[0].variants.map((variant) => variant.id)).toEqual([
      "black-52",
      "black-54",
      "blue-52",
    ]);
  });
});

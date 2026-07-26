import { describe, expect, it } from "vitest";
import { toggleCatalogVariantSelection } from "@/lib/catalog/selection";

describe("toggleCatalogVariantSelection", () => {
  it("keeps previously selected colors from the same model", () => {
    const firstColor = "genevieve-alibi-blue-52";
    const secondColor = "genevieve-alibi-tortoise-52";

    const withFirstColor = toggleCatalogVariantSelection([], firstColor);
    const withBothColors = toggleCatalogVariantSelection(withFirstColor, secondColor);

    expect(withBothColors).toEqual([firstColor, secondColor]);
  });

  it("only removes the exact color and size selected again", () => {
    const selected = [
      "genevieve-alibi-blue-52",
      "genevieve-alibi-tortoise-52",
      "genevieve-alibi-tortoise-54",
    ];

    expect(
      toggleCatalogVariantSelection(selected, "genevieve-alibi-tortoise-52")
    ).toEqual([
      "genevieve-alibi-blue-52",
      "genevieve-alibi-tortoise-54",
    ]);
  });
});

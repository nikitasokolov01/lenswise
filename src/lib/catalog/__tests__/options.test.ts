import { describe, expect, it } from "vitest";
import {
  catalogImageUrl,
  catalogColorSwatch,
  filterCatalogOptions,
  formatCatalogFrameSize,
  frameCatalogOptionFromRow,
  groupCatalogOptionsByModel,
  type FrameCatalogRow,
} from "@/lib/catalog/options";

const row: FrameCatalogRow = {
  id: "949f4aa9-6a9e-43c6-bbbe-ea050a73c8f6",
  provider: "frames_data",
  manufacturer: "Modern Optical",
  brand: "Modern Art",
  model: "A358",
  color_name: "burgundy",
  color_code: "2756F054",
  eye_size_mm: 54,
  bridge_size_mm: 18,
  temple_length_mm: 140,
  material: "Metal",
  shape: "Modified Oval",
  frame_type: "Metal",
  rim_type: "Semi-Rimless",
  suggested_retail_price_cents: null,
  image_url: "https://www.framesdata.com/ColorSm/275/2756F054.jpg",
  source_image_url: "https://www.framesdata.com/ColorSm/275/2756F054.jpg",
  hosted_image_path: null,
};

describe("catalog inventory options", () => {
  it("maps catalog rows and marks variants already held by the office", () => {
    const option = frameCatalogOptionFromRow(row, new Set([row.id]));

    expect(option).toMatchObject({
      brand: "Modern Art",
      model: "A358",
      colorName: "burgundy",
      alreadyInInventory: true,
    });
    expect(formatCatalogFrameSize(option)).toBe("54-18-140");
    expect(option.imageUrl).toBe(
      "/api/catalog/frame-images/949f4aa9-6a9e-43c6-bbbe-ea050a73c8f6"
    );
  });

  it("searches across product, color, shape, and sizing details", () => {
    const option = frameCatalogOptionFromRow(row, new Set());

    expect(filterCatalogOptions([option], "burgundy", "all")).toHaveLength(1);
    expect(filterCatalogOptions([option], "modified oval", "all")).toHaveLength(1);
    expect(filterCatalogOptions([option], "54-18-140", "all")).toHaveLength(1);
    expect(filterCatalogOptions([option], "not-this-frame", "all")).toHaveLength(0);
  });

  it("filters by the exact catalog material", () => {
    const option = frameCatalogOptionFromRow(row, new Set());

    expect(filterCatalogOptions([option], "", "Metal")).toHaveLength(1);
    expect(filterCatalogOptions([option], "", "Plastic")).toHaveLength(0);
  });

  it("filters and sorts by the exact catalog brand", () => {
    const modernArt = frameCatalogOptionFromRow(row, new Set());
    const genevieve = frameCatalogOptionFromRow(
      {
        ...row,
        id: "103843f0-0e6c-4718-99e6-b267f141dcd8",
        brand: "Genevieve Paris Design",
        model: "Advance",
      },
      new Set()
    );

    expect(
      filterCatalogOptions([modernArt, genevieve], "", "all", "Genevieve Paris Design")
    ).toEqual([genevieve]);
    expect(
      filterCatalogOptions([modernArt, genevieve], "", "all").map((frame) => frame.brand)
    ).toEqual(["Genevieve Paris Design", "Modern Art"]);
  });

  it("groups color and size variants into one brand and model", () => {
    const burgundy = frameCatalogOptionFromRow(row, new Set());
    const black = frameCatalogOptionFromRow(
      {
        ...row,
        id: "4cac3db7-923b-457a-a5f7-9262268519b7",
        color_name: "black",
        color_code: "BLACK",
        image_url: "https://www.framesdata.com/ColorSm/BLA/BLACK.jpg",
      },
      new Set()
    );
    const otherModel = frameCatalogOptionFromRow(
      {
        ...row,
        id: "68e3ee0c-459a-44c7-a513-ac9d82f5a8b8",
        model: "A359",
      },
      new Set()
    );

    const groups = groupCatalogOptionsByModel([burgundy, black, otherModel]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      brand: "Modern Art",
      model: "A358",
    });
    expect(groups[0].variants.map((variant) => variant.colorName)).toEqual([
      "black",
      "burgundy",
    ]);
  });

  it("uses the LensWise fallback for Frames Data placeholder images", () => {
    const option = frameCatalogOptionFromRow(
      {
        ...row,
        image_url: "https://www.framesdata.com/images/imgnotavail_large.jpg",
        source_image_url:
          "https://www.framesdata.com/images/imgnotavail_large.jpg",
      },
      new Set()
    );

    expect(option.imageUrl).toBeNull();
  });

  it("keeps unrelated catalog image URLs unchanged", () => {
    expect(catalogImageUrl("https://images.example.com/frame.jpg")).toBe(
      "https://images.example.com/frame.jpg"
    );
  });

  it("creates recognizable solid and mixed color swatches from catalog names", () => {
    expect(catalogColorSwatch("Navy")).toBe("#1e3a8a");
    expect(catalogColorSwatch("Black / Crystal")).toContain("linear-gradient");
    expect(catalogColorSwatch("Classic Tortoise")).toContain("conic-gradient");
  });
});

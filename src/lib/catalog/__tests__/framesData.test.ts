import { describe, expect, it } from "vitest";
import {
  FRAMES_DATA_IMPORT_BATCH_LIMIT,
  framesDataCatalogItemSchema,
  framesDataCatalogRow,
  framesDataImportRequestSchema,
} from "@/lib/catalog/framesData";

const normalizedItem = {
  providerItemId: "fd-123",
  brand: "Modern Optical",
  model: "MODZ 101",
  colorName: "Navy",
  upc: "012345678905",
  eyeSizeMm: 52,
  bridgeSizeMm: 18,
  templeLengthMm: 140,
  wholesalePriceCents: 3295,
  suggestedRetailPriceCents: 9900,
  imageUrl: "https://example.com/frame.jpg",
  sourceUpdatedAt: "2026-07-25T05:00:00.000Z",
  rawData: { sourceCode: "A" },
};

describe("Frames Data normalized import contract", () => {
  it("accepts a normalized frame variant and creates a database row", () => {
    const item = framesDataCatalogItemSchema.parse(normalizedItem);
    const row = framesDataCatalogRow(item, "1a338a04-8024-44a6-91ca-858f75e262c0");

    expect(row).toMatchObject({
      provider: "frames_data",
      provider_item_id: "fd-123",
      brand: "Modern Optical",
      model: "MODZ 101",
      color_name: "Navy",
      wholesale_price_cents: 3295,
      is_active: true,
    });
  });

  it("rejects ambiguous prices and invalid frame measurements", () => {
    expect(
      framesDataCatalogItemSchema.safeParse({
        ...normalizedItem,
        wholesalePriceCents: 32.95,
        eyeSizeMm: 999,
      }).success
    ).toBe(false);
  });

  it("requires the provider's stable item identifier", () => {
    const { providerItemId: _providerItemId, ...withoutProviderId } = normalizedItem;
    expect(framesDataCatalogItemSchema.safeParse(withoutProviderId).success).toBe(false);
  });

  it("caps each HTTP batch for predictable Vercel execution time", () => {
    const result = framesDataImportRequestSchema.safeParse({
      operation: "batch",
      runId: "1a338a04-8024-44a6-91ca-858f75e262c0",
      items: Array.from({ length: FRAMES_DATA_IMPORT_BATCH_LIMIT + 1 }, () => normalizedItem),
    });

    expect(result.success).toBe(false);
  });
});

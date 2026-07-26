import { z } from "zod";

export const FRAMES_DATA_PROVIDER = "frames_data" as const;
export const FRAMES_DATA_IMPORT_BATCH_LIMIT = 500;

const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .optional()
    .nullable()
    .transform((value) => value || null);

const optionalInteger = (minimum: number, maximum: number) =>
  z.number().int().min(minimum).max(maximum).optional().nullable();

const optionalMeasurement = z.number().positive().max(120).optional().nullable();
const optionalPrice = z.number().int().nonnegative().max(100_000_000).optional().nullable();

/**
 * Stable contract between a licensed Frames Data adapter and LensWise.
 *
 * Frames Data's private delivery format is intentionally not guessed here.
 * Once their specification arrives, one small adapter should translate each
 * source record into this normalized shape.
 */
export const framesDataCatalogItemSchema = z
  .object({
    providerItemId: z.string().trim().min(1).max(160),
    manufacturer: optionalText(120),
    brand: z.string().trim().min(1).max(100),
    collection: optionalText(120),
    model: z.string().trim().min(1).max(120),
    colorCode: optionalText(80),
    colorName: optionalText(120),
    sku: optionalText(100),
    upc: optionalText(32),
    eyeSizeMm: optionalInteger(20, 80),
    bridgeSizeMm: optionalInteger(5, 40),
    templeLengthMm: optionalInteger(80, 180),
    aMeasurementMm: optionalMeasurement,
    bMeasurementMm: optionalMeasurement,
    effectiveDiameterMm: optionalMeasurement,
    gender: optionalText(50),
    material: optionalText(80),
    shape: optionalText(80),
    frameType: optionalText(80),
    rimType: optionalText(80),
    wholesalePriceCents: optionalPrice,
    suggestedRetailPriceCents: optionalPrice,
    imageUrl: z.string().url().max(2000).optional().nullable(),
    isActive: z.boolean().default(true),
    sourceStatus: optionalText(80),
    sourceUpdatedAt: z.string().datetime({ offset: true }).optional().nullable(),
    rawData: z.record(z.unknown()).default({}),
  })
  .strict();

export type FramesDataCatalogItem = z.infer<typeof framesDataCatalogItemSchema>;

const startImportSchema = z
  .object({
    operation: z.literal("start"),
    mode: z.enum(["full", "incremental"]),
    sourceCursor: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

const batchImportSchema = z
  .object({
    operation: z.literal("batch"),
    runId: z.string().uuid(),
    items: z
      .array(framesDataCatalogItemSchema)
      .min(1)
      .max(FRAMES_DATA_IMPORT_BATCH_LIMIT),
  })
  .strict();

const finishImportSchema = z
  .object({
    operation: z.literal("finish"),
    runId: z.string().uuid(),
  })
  .strict();

const failImportSchema = z
  .object({
    operation: z.literal("fail"),
    runId: z.string().uuid(),
    error: z.string().trim().min(1).max(2000),
  })
  .strict();

export const framesDataImportRequestSchema = z.discriminatedUnion("operation", [
  startImportSchema,
  batchImportSchema,
  finishImportSchema,
  failImportSchema,
]);

export type FramesDataImportRequest = z.infer<typeof framesDataImportRequestSchema>;

export function framesDataCatalogRow(item: FramesDataCatalogItem, runId: string) {
  return {
    provider: FRAMES_DATA_PROVIDER,
    provider_item_id: item.providerItemId,
    manufacturer: item.manufacturer,
    brand: item.brand,
    collection: item.collection,
    model: item.model,
    color_code: item.colorCode,
    color_name: item.colorName,
    sku: item.sku,
    upc: item.upc,
    eye_size_mm: item.eyeSizeMm,
    bridge_size_mm: item.bridgeSizeMm,
    temple_length_mm: item.templeLengthMm,
    a_measurement_mm: item.aMeasurementMm,
    b_measurement_mm: item.bMeasurementMm,
    effective_diameter_mm: item.effectiveDiameterMm,
    gender: item.gender,
    material: item.material,
    shape: item.shape,
    frame_type: item.frameType,
    rim_type: item.rimType,
    wholesale_price_cents: item.wholesalePriceCents,
    suggested_retail_price_cents: item.suggestedRetailPriceCents,
    image_url: item.imageUrl,
    source_image_url: item.imageUrl,
    is_active: item.isActive,
    source_status: item.sourceStatus,
    source_updated_at: item.sourceUpdatedAt,
    discontinued_at: item.isActive ? null : new Date().toISOString(),
    last_seen_import_run_id: runId,
    raw_data: item.rawData,
  };
}

import { z } from "zod";
import { parseDollarsToCents } from "@/lib/money";

const optionalInteger = (minimum: number, maximum: number) =>
  z.preprocess(
    (value) => (value === "" || value == null ? null : value),
    z.coerce.number().int().min(minimum).max(maximum).nullable()
  );

const optionalText = (maximum: number) =>
  z.preprocess(
    (value) => {
      const trimmed = String(value ?? "").trim();
      return trimmed === "" ? null : trimmed;
    },
    z.string().max(maximum).nullable()
  );

export const frameInventoryFormSchema = z.object({
  brand: z.string().trim().min(1, "Brand is required.").max(80),
  model: z.string().trim().min(1, "Model is required.").max(100),
  color: z.string().trim().max(80).default(""),
  eyeSizeMm: optionalInteger(20, 80),
  bridgeSizeMm: optionalInteger(5, 40),
  templeLengthMm: optionalInteger(80, 180),
  sku: optionalText(80),
  upc: optionalText(32),
  wholesaleCost: z.string().trim().max(20).default(""),
  retailPrice: z.string().trim().max(20).default(""),
  quantityOnHand: z.coerce.number().int().min(0).max(99999),
  reorderLevel: z.coerce.number().int().min(0).max(99999),
  notes: z.string().trim().max(1000).default(""),
});

export type ParsedFrameInventoryForm = z.infer<typeof frameInventoryFormSchema>;

export function frameInventoryValuesFromFormData(formData: FormData) {
  const parsed = frameInventoryFormSchema.safeParse({
    brand: formData.get("brand"),
    model: formData.get("model"),
    color: formData.get("color"),
    eyeSizeMm: formData.get("eyeSizeMm"),
    bridgeSizeMm: formData.get("bridgeSizeMm"),
    templeLengthMm: formData.get("templeLengthMm"),
    sku: formData.get("sku"),
    upc: formData.get("upc"),
    wholesaleCost: formData.get("wholesaleCost"),
    retailPrice: formData.get("retailPrice"),
    quantityOnHand: formData.get("quantityOnHand"),
    reorderLevel: formData.get("reorderLevel"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) return parsed;

  return {
    ...parsed,
    data: {
      brand: parsed.data.brand,
      model: parsed.data.model,
      color: parsed.data.color,
      eye_size_mm: parsed.data.eyeSizeMm,
      bridge_size_mm: parsed.data.bridgeSizeMm,
      temple_length_mm: parsed.data.templeLengthMm,
      sku: parsed.data.sku,
      upc: parsed.data.upc,
      wholesale_cost_cents: Math.max(0, parseDollarsToCents(parsed.data.wholesaleCost)),
      retail_price_cents: Math.max(0, parseDollarsToCents(parsed.data.retailPrice)),
      quantity_on_hand: parsed.data.quantityOnHand,
      reorder_level: parsed.data.reorderLevel,
      notes: parsed.data.notes,
    },
  };
}


export interface FrameInventoryItem {
  id: string;
  organizationId: string;
  locationId: string;
  brand: string;
  model: string;
  color: string;
  eyeSizeMm: number | null;
  bridgeSizeMm: number | null;
  templeLengthMm: number | null;
  sku: string | null;
  upc: string | null;
  wholesaleCostCents: number;
  retailPriceCents: number;
  quantityOnHand: number;
  reorderLevel: number;
  notes: string;
  isActive: boolean;
  imageUrl: string | null;
  catalogSource: string;
  catalogItemId: string | null;
  catalogRecordId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The small, non-sensitive inventory shape sent to the quote builder.
 * Wholesale cost, notes, and catalog metadata stay on the server/inventory page.
 */
export interface QuoteFrameInventoryOption {
  id: string;
  brand: string;
  model: string;
  color: string;
  imageUrl: string | null;
  eyeSizeMm: number | null;
  bridgeSizeMm: number | null;
  templeLengthMm: number | null;
  sku: string | null;
  upc: string | null;
  retailPriceCents: number;
  quantityOnHand: number;
}

export interface QuoteFrameInventoryModelGroup {
  key: string;
  brand: string;
  model: string;
  variants: QuoteFrameInventoryOption[];
}

export interface QuoteFrameInventoryRow {
  id: string;
  brand: string;
  model: string;
  color: string;
  image_url: string | null;
  eye_size_mm: number | null;
  bridge_size_mm: number | null;
  temple_length_mm: number | null;
  sku: string | null;
  upc: string | null;
  retail_price_cents: number;
  quantity_on_hand: number;
}

export function quoteFrameInventoryOptionFromRow(
  row: QuoteFrameInventoryRow
): QuoteFrameInventoryOption {
  return {
    id: row.id,
    brand: row.brand,
    model: row.model,
    color: row.color,
    imageUrl: row.image_url,
    eyeSizeMm: row.eye_size_mm,
    bridgeSizeMm: row.bridge_size_mm,
    templeLengthMm: row.temple_length_mm,
    sku: row.sku,
    upc: row.upc,
    retailPriceCents: row.retail_price_cents,
    quantityOnHand: row.quantity_on_hand,
  };
}

export function formatQuoteFrameName(frame: QuoteFrameInventoryOption): string {
  const name = formatQuoteFrameProductName(frame);
  return frame.color ? `${name} — ${frame.color}` : name;
}

export function formatQuoteFrameProductName(frame: QuoteFrameInventoryOption): string {
  return [frame.brand, frame.model].filter(Boolean).join(" ");
}

export function formatQuoteFrameSize(frame: QuoteFrameInventoryOption): string {
  if (frame.eyeSizeMm == null && frame.bridgeSizeMm == null && frame.templeLengthMm == null) {
    return "";
  }

  const front =
    frame.eyeSizeMm != null || frame.bridgeSizeMm != null
      ? `${frame.eyeSizeMm ?? "—"}-${frame.bridgeSizeMm ?? "—"}`
      : "";
  return [front, frame.templeLengthMm].filter((value) => value !== "").join("-");
}

export function quoteFrameInventoryModelKey(
  frame: Pick<QuoteFrameInventoryOption, "brand" | "model">
): string {
  return `${frame.brand}\u0000${frame.model}`;
}

export function groupQuoteFrameInventoryByModel(
  frames: QuoteFrameInventoryOption[]
): QuoteFrameInventoryModelGroup[] {
  const groups = new Map<string, QuoteFrameInventoryModelGroup>();

  for (const frame of frames) {
    const key = quoteFrameInventoryModelKey(frame);
    const existing = groups.get(key);
    if (existing) {
      existing.variants.push(frame);
    } else {
      groups.set(key, {
        key,
        brand: frame.brand,
        model: frame.model,
        variants: [frame],
      });
    }
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    variants: group.variants.sort(
      (left, right) =>
        left.color.localeCompare(right.color) ||
        formatQuoteFrameSize(left).localeCompare(formatQuoteFrameSize(right))
    ),
  }));
}

export interface FrameInventoryRow {
  id: string;
  organization_id: string;
  location_id: string;
  brand: string;
  model: string;
  color: string;
  eye_size_mm: number | null;
  bridge_size_mm: number | null;
  temple_length_mm: number | null;
  sku: string | null;
  upc: string | null;
  wholesale_cost_cents: number;
  retail_price_cents: number;
  quantity_on_hand: number;
  reorder_level: number;
  notes: string;
  is_active: boolean;
  image_url: string | null;
  catalog_source: string;
  catalog_item_id: string | null;
  catalog_record_id: string | null;
  created_at: string;
  updated_at: string;
}

export function frameInventoryFromRow(row: FrameInventoryRow): FrameInventoryItem {
  return {
    id: row.id,
    organizationId: row.organization_id,
    locationId: row.location_id,
    brand: row.brand,
    model: row.model,
    color: row.color,
    eyeSizeMm: row.eye_size_mm,
    bridgeSizeMm: row.bridge_size_mm,
    templeLengthMm: row.temple_length_mm,
    sku: row.sku,
    upc: row.upc,
    wholesaleCostCents: row.wholesale_cost_cents,
    retailPriceCents: row.retail_price_cents,
    quantityOnHand: row.quantity_on_hand,
    reorderLevel: row.reorder_level,
    notes: row.notes,
    isActive: row.is_active,
    imageUrl: row.image_url,
    catalogSource: row.catalog_source,
    catalogItemId: row.catalog_item_id,
    catalogRecordId: row.catalog_record_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

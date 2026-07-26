import { frameCatalogImageUrl } from "@/lib/catalog/imageHosting";

export interface FrameCatalogOption {
  id: string;
  provider: string;
  manufacturer: string | null;
  brand: string;
  model: string;
  colorName: string;
  colorCode: string | null;
  eyeSizeMm: number | null;
  bridgeSizeMm: number | null;
  templeLengthMm: number | null;
  material: string | null;
  shape: string | null;
  frameType: string | null;
  rimType: string | null;
  suggestedRetailPriceCents: number | null;
  imageUrl: string | null;
  alreadyInInventory: boolean;
}

export interface FrameCatalogModelGroup {
  key: string;
  brand: string;
  model: string;
  variants: FrameCatalogOption[];
}

export interface FrameCatalogRow {
  id: string;
  provider: string;
  manufacturer: string | null;
  brand: string;
  model: string;
  color_name: string | null;
  color_code: string | null;
  eye_size_mm: number | null;
  bridge_size_mm: number | null;
  temple_length_mm: number | null;
  material: string | null;
  shape: string | null;
  frame_type: string | null;
  rim_type: string | null;
  suggested_retail_price_cents: number | null;
  image_url: string | null;
  source_image_url: string | null;
  hosted_image_path: string | null;
}

export function catalogImageUrl(value: string | null): string | null {
  if (!value || /\/imgnotavail(?:_|\.|\/)/i.test(value)) return null;

  return value.replace(
    /^(https:\/\/www\.framesdata\.com)\/ColorSm\//i,
    "$1/Q120WEB/color_b/"
  );
}

export function frameCatalogOptionFromRow(
  row: FrameCatalogRow,
  existingCatalogRecordIds: ReadonlySet<string>
): FrameCatalogOption {
  const sourceImageUrl = catalogImageUrl(row.source_image_url ?? row.image_url);
  const imageUrl =
    row.hosted_image_path || sourceImageUrl
      ? frameCatalogImageUrl(row.id)
      : null;

  return {
    id: row.id,
    provider: row.provider,
    manufacturer: row.manufacturer,
    brand: row.brand,
    model: row.model,
    colorName: row.color_name ?? row.color_code ?? "Color not listed",
    colorCode: row.color_code,
    eyeSizeMm: row.eye_size_mm,
    bridgeSizeMm: row.bridge_size_mm,
    templeLengthMm: row.temple_length_mm,
    material: row.material,
    shape: row.shape,
    frameType: row.frame_type,
    rimType: row.rim_type,
    suggestedRetailPriceCents: row.suggested_retail_price_cents,
    imageUrl,
    alreadyInInventory: existingCatalogRecordIds.has(row.id),
  };
}

export function formatCatalogFrameSize(frame: FrameCatalogOption): string {
  if (
    frame.eyeSizeMm == null &&
    frame.bridgeSizeMm == null &&
    frame.templeLengthMm == null
  ) {
    return "Size not listed";
  }

  const front =
    frame.eyeSizeMm != null || frame.bridgeSizeMm != null
      ? `${frame.eyeSizeMm ?? "—"}-${frame.bridgeSizeMm ?? "—"}`
      : "";
  return [front, frame.templeLengthMm]
    .filter((value) => value !== "")
    .join("-");
}

export function frameCatalogModelKey(
  frame: Pick<FrameCatalogOption, "brand" | "model">
): string {
  return `${frame.brand}\u0000${frame.model}`;
}

const CATALOG_SWATCH_COLORS: Array<[RegExp, string]> = [
  [/\b(black|blk|onyx|jet)\b/i, "#111827"],
  [/\b(gunmetal|charcoal)\b/i, "#4b5563"],
  [/\b(silver|pewter)\b/i, "#cbd5e1"],
  [/\b(gray|grey|smoke)\b/i, "#94a3b8"],
  [/\b(rose gold|rose-gold)\b/i, "#c9828c"],
  [/\b(gold|champagne)\b/i, "#d6a84b"],
  [/\b(bronze|copper)\b/i, "#a05a2c"],
  [/\b(burgundy|wine|merlot)\b/i, "#7f1d3f"],
  [/\b(red|ruby|scarlet)\b/i, "#dc2626"],
  [/\b(pink|blush|rose)\b/i, "#ec4899"],
  [/\b(purple|violet|plum|lavender)\b/i, "#9333ea"],
  [/\b(navy|midnight)\b/i, "#1e3a8a"],
  [/\b(blue|cobalt|sapphire)\b/i, "#3b82f6"],
  [/\b(teal|turquoise|aqua)\b/i, "#14b8a6"],
  [/\b(olive|khaki)\b/i, "#6b7a31"],
  [/\b(green|emerald|mint)\b/i, "#22c55e"],
  [/\b(yellow|lemon)\b/i, "#eab308"],
  [/\b(orange|coral)\b/i, "#f97316"],
  [/\b(brown|chocolate|espresso)\b/i, "#784421"],
  [/\b(beige|tan|sand|taupe)\b/i, "#c4a484"],
  [/\b(white|ivory|pearl|clear|crystal)\b/i, "#f8fafc"],
];

export function catalogColorSwatch(colorName: string): string {
  if (/\b(tortoise|havana|havanna|demi|horn)\b/i.test(colorName)) {
    return "conic-gradient(from 35deg, #3f2417, #c17a2b, #5b321d, #e2a64c, #3f2417)";
  }
  if (/\b(multi|rainbow|confetti)\b/i.test(colorName)) {
    return "conic-gradient(#ef4444, #f59e0b, #22c55e, #3b82f6, #a855f7, #ef4444)";
  }

  const matches = CATALOG_SWATCH_COLORS.filter(([pattern]) => pattern.test(colorName))
    .map(([, color]) => color)
    .filter((color, index, colors) => colors.indexOf(color) === index)
    .slice(0, 3);

  if (matches.length === 0) return "#94a3b8";
  if (matches.length === 1) return matches[0];

  const stopSize = 100 / matches.length;
  const stops = matches
    .flatMap((color, index) => [
      `${color} ${Math.round(index * stopSize)}%`,
      `${color} ${Math.round((index + 1) * stopSize)}%`,
    ])
    .join(", ");
  return `linear-gradient(135deg, ${stops})`;
}

export function groupCatalogOptionsByModel(
  frames: FrameCatalogOption[]
): FrameCatalogModelGroup[] {
  const groups = new Map<string, FrameCatalogModelGroup>();

  for (const frame of frames) {
    const key = frameCatalogModelKey(frame);
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
        left.colorName.localeCompare(right.colorName) ||
        formatCatalogFrameSize(left).localeCompare(formatCatalogFrameSize(right))
    ),
  }));
}

export function filterCatalogOptions(
  frames: FrameCatalogOption[],
  query: string,
  material: string,
  brand = "all"
): FrameCatalogOption[] {
  const normalizedQuery = query.trim().toLowerCase();
  return frames
    .filter((frame) => {
      if (brand !== "all" && frame.brand !== brand) return false;
      if (material !== "all" && frame.material !== material) return false;
      if (!normalizedQuery) return true;

      return [
        frame.manufacturer ?? "",
        frame.brand,
        frame.model,
        frame.colorName,
        frame.colorCode ?? "",
        frame.material ?? "",
        frame.shape ?? "",
        frame.frameType ?? "",
        frame.rimType ?? "",
        formatCatalogFrameSize(frame),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    })
    .sort(
      (left, right) =>
        left.brand.localeCompare(right.brand) ||
        left.model.localeCompare(right.model) ||
        left.colorName.localeCompare(right.colorName) ||
        formatCatalogFrameSize(left).localeCompare(formatCatalogFrameSize(right))
    );
}

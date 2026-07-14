import type { TintColorConfig, TintConfig, TintSelection } from "@/lib/types";

/**
 * Pure tint pricing lookup. The price depends ONLY on the color and the tint
 * type (Solid / Gradient) — the selected percentage is cosmetic and never
 * affects price (it only appears in the displayed description).
 *
 * A missing/invalid configured price is a VALIDATION ERROR — never silently
 * free. Callers add a tint line item only when `error` is null; otherwise
 * they surface `error`. Returns null when no tint is selected ("none").
 */
export interface TintResolution {
  color: TintColorConfig | undefined;
  priceCents: number;
  /** Staff-facing label, e.g. "Brown Gradient Tint — 70%". */
  internalLabel: string;
  error: string | null;
}

function typeLabel(type: TintSelection["type"]): string {
  return type === "solid" ? "Solid Tint" : type === "gradient" ? "Gradient Tint" : "Tint";
}

export function resolveTint(tintConfig: TintConfig, selection: TintSelection): TintResolution | null {
  if (selection.type === "none") return null;

  const label = typeLabel(selection.type);
  const fail = (error: string, color?: TintColorConfig): TintResolution => ({
    color,
    priceCents: 0,
    internalLabel: color ? `${color.name} ${label}` : label,
    error,
  });

  const color = selection.colorId ? tintConfig.colors.find((c) => c.id === selection.colorId) : undefined;
  if (!color) return fail("Select a tint color to price the tint.");
  if (!color.active) return fail(`The selected tint color (${color.name}) is no longer available. Choose another.`, color);

  const globallyEnabled = selection.type === "solid" ? tintConfig.solidTintEnabled : tintConfig.gradientTintEnabled;
  const colorSupports = selection.type === "solid" ? color.supportsSolid : color.supportsGradient;
  if (!globallyEnabled || !colorSupports) {
    return fail(`${label} is not available for ${color.name}.`, color);
  }

  if (selection.percent == null) return fail(`Select a tint percentage for ${color.name}.`, color);

  // Price depends only on color + type; the percentage is cosmetic (label only).
  const price = selection.type === "solid" ? color.solidPriceCents : color.gradientPriceCents;
  const internalLabel = `${color.name} ${label} — ${selection.percent}%`;

  if (typeof price !== "number") {
    return {
      color,
      priceCents: 0,
      internalLabel,
      error: `No ${label} price is configured for ${color.name}. Add one in Admin Pricing.`,
    };
  }

  return { color, priceCents: price, internalLabel, error: null };
}

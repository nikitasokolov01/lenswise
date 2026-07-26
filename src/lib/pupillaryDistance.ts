import type { PupillaryDistanceInput } from "@/lib/types";

export type PupillaryDistanceField = "binocular" | "right" | "left";

/**
 * PD values remain text while being typed so an in-progress decimal does not
 * jump around. Accept at most two whole-number digits and one decimal digit.
 */
export function sanitizePupillaryDistanceValue(rawValue: string): string {
  const normalized = rawValue.replace(",", ".").replace(/[^\d.]/g, "");
  const firstDecimal = normalized.indexOf(".");
  const hasDecimal = firstDecimal >= 0;
  const wholeSource = hasDecimal ? normalized.slice(0, firstDecimal) : normalized;
  const decimalSource = hasDecimal ? normalized.slice(firstDecimal + 1).replace(/\./g, "") : "";
  const whole = wholeSource.slice(0, 2);

  if (!hasDecimal || whole.length === 0) return whole;
  return `${whole}.${decimalSource.slice(0, 1)}`;
}

export function formatPupillaryDistance(pd: PupillaryDistanceInput): string {
  if (pd.mode === "binocular") return pd.binocular.trim();

  const right = pd.right.trim();
  const left = pd.left.trim();
  if (!right && !left) return "";
  return `OD ${right || "—"} / OS ${left || "—"}`;
}


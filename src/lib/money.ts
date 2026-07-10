/**
 * Currency helpers. All arithmetic in this app happens in integer cents to
 * avoid floating-point rounding errors. These helpers are the ONLY place
 * that should convert between a human-entered dollar string and cents.
 */

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** Formats an integer cents value as "$1,234.56". */
export function formatCents(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0;
  return currencyFormatter.format(safe / 100);
}

/** Formats cents with an explicit sign, e.g. "+$10.00" / "-$10.00", useful for adjustments. */
export function formatCentsSigned(cents: number): string {
  const sign = cents < 0 ? "-" : "+";
  return `${sign}${formatCents(Math.abs(cents))}`;
}

/**
 * Parses a human-entered dollar string (e.g. from a text/number input) into
 * integer cents. Returns 0 for empty/invalid input rather than throwing, so
 * the UI can stay responsive while a user is mid-edit.
 */
export function parseDollarsToCents(value: string | number): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100);
  }
  const trimmed = value.trim();
  if (trimmed === "") return 0;
  const parsed = Number.parseFloat(trimmed.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

/** Converts integer cents back to a plain dollar number for populating numeric inputs. */
export function centsToDollarInputValue(cents: number): string {
  if (!Number.isFinite(cents) || cents === 0) return "";
  return (cents / 100).toFixed(2);
}

/** Clamp a cents value so it can never be negative. */
export function clampNonNegative(cents: number): number {
  return cents < 0 ? 0 : cents;
}

export function sumCents(values: number[]): number {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

import type { UsageKey } from "@/lib/types";

/**
 * Usage options + labels. Usage is INFORMATIONAL ONLY — it never affects
 * pricing, insurance, the surfacing rule, or the displayed prescription (the
 * prescription display modes on the Internal Worksheet are a separate,
 * explicit control — see prescriptionDisplay.ts).
 */

export interface UsageOption {
  key: UsageKey;
  /** Exact label shown to staff (optician summary / Internal Order Worksheet). */
  label: string;
  /**
   * Customer-safe wording used on patient/customer surfaces when exact
   * technology hiding is enabled — it avoids naming a lens technology and
   * instead describes the vision purpose.
   */
  customerLabel: string;
  /** Short helper text for the picker. */
  description: string;
}

export const USAGE_OPTIONS: UsageOption[] = [
  { key: "reading", label: "Reading", customerLabel: "Reading", description: "Near vision only." },
  {
    key: "computer",
    label: "Computer",
    customerLabel: "Computer / Intermediate",
    description: "Intermediate / screen working distance.",
  },
  { key: "distance", label: "Distance", customerLabel: "Distance", description: "Far vision only." },
  {
    key: "bifocal",
    label: "Bifocal",
    customerLabel: "Reading + Distance",
    description: "Near and distance in one lens.",
  },
  { key: "sunglasses", label: "Sunglasses", customerLabel: "Sunglasses", description: "Tinted outdoor wear." },
  {
    key: "progressive",
    label: "Progressive",
    customerLabel: "All Distances",
    description: "Seamless range of vision.",
  },
];

export function getUsageOption(usage: UsageKey | null): UsageOption | undefined {
  return usage ? USAGE_OPTIONS.find((option) => option.key === usage) : undefined;
}

/** Exact (staff-facing) usage label, or null when no usage is selected. */
export function formatUsageLabel(usage: UsageKey | null): string | null {
  return getUsageOption(usage)?.label ?? null;
}

/**
 * Customer-facing usage label. Generalized (customerLabel) when exact
 * technology hiding is enabled; exact otherwise. Null when none is selected.
 */
export function formatUsageLabelForCustomer(usage: UsageKey | null, showExactTechnologyNames: boolean): string | null {
  const option = getUsageOption(usage);
  if (!option) return null;
  return showExactTechnologyNames ? option.label : option.customerLabel;
}

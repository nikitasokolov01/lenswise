import type { PrescriptionEyeValues, PrescriptionInput, UsageKey } from "@/lib/types";

/**
 * Usage options + labels, and the display-only internal prescription
 * transformation. This module is purely additive: it never mutates the
 * applied prescription in quote state, and it has no effect on pricing,
 * insurance, or the surfacing rule.
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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface DerivedPrescription {
  /** A NEW prescription object for display only — the applied prescription in state is never changed. */
  prescription: PrescriptionInput;
  /** True when the usage actually altered the prescription (e.g. Reading). */
  transformed: boolean;
  /** The usage's exact label (for the "Usage: …" section heading). */
  usageLabel: string;
}

/**
 * Builds a display-only prescription derived from the applied one for the
 * given usage. NEVER mutates or overwrites the entered prescription — the
 * caller renders the returned copy.
 *
 * Reading: the full ADD is folded into each eye's sphere (a single-vision
 * near Rx), the ADD is cleared so it is not shown separately, and cylinder /
 * axis are unchanged. Every other usage returns the prescription unchanged.
 * Returns null when no usage is selected or no prescription is applied.
 */
export function deriveUsagePrescription(
  prescription: PrescriptionInput | null,
  usage: UsageKey | null
): DerivedPrescription | null {
  const option = getUsageOption(usage);
  if (!option || !prescription) return null;

  if (usage === "reading") {
    const toNear = (eye: PrescriptionEyeValues): PrescriptionEyeValues => ({
      sphere: round2(eye.sphere + (eye.add ?? 0)),
      cylinder: eye.cylinder,
      axis: eye.axis,
      add: null,
    });
    return {
      prescription: { od: toNear(prescription.od), os: toNear(prescription.os) },
      transformed: true,
      usageLabel: option.label,
    };
  }

  return { prescription, transformed: false, usageLabel: option.label };
}

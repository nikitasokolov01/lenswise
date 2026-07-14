import type { PrescriptionDisplayMode, PrescriptionEyeValues, PrescriptionInput } from "@/lib/types";

/**
 * Pure, React-free helpers for the Internal Worksheet's prescription display
 * modes. NONE of these ever mutate the applied prescription — they return a
 * new object for display only. Reading/Computer both require an ADD value.
 */

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** True when at least one eye has an ADD value (required for Reading/Computer calculations). */
export function prescriptionHasAdd(prescription: PrescriptionInput | null): boolean {
  if (!prescription) return false;
  return prescription.od.add !== null || prescription.os.add !== null;
}

/** Human label for a display mode. */
export function prescriptionDisplayLabel(mode: PrescriptionDisplayMode): string {
  if (mode === "reading") return "Reading Prescription";
  if (mode === "computer") return "Computer Prescription";
  return "Original Prescription";
}

export interface PrescriptionDisplay {
  prescription: PrescriptionInput;
  label: string;
  mode: PrescriptionDisplayMode;
}

/**
 * Builds the display-only prescription for the given mode.
 *  - original: the prescription unchanged.
 *  - reading:  each eye's sphere += full ADD; ADD hidden; cyl/axis unchanged.
 *  - computer: each eye's sphere += ADD / 2; ADD hidden; cyl/axis unchanged.
 * An eye with no ADD (null) is treated as +0.00 for the arithmetic. The
 * applied prescription passed in is never modified.
 */
export function derivePrescriptionForDisplay(
  prescription: PrescriptionInput,
  mode: PrescriptionDisplayMode
): PrescriptionDisplay {
  if (mode === "original") {
    return { prescription, label: prescriptionDisplayLabel("original"), mode };
  }

  const addFactor = mode === "computer" ? 0.5 : 1;
  const apply = (eye: PrescriptionEyeValues): PrescriptionEyeValues => ({
    sphere: round2(eye.sphere + (eye.add ?? 0) * addFactor),
    cylinder: eye.cylinder,
    axis: eye.axis,
    add: null,
  });

  return {
    prescription: { od: apply(prescription.od), os: apply(prescription.os) },
    label: prescriptionDisplayLabel(mode),
    mode,
  };
}

/**
 * Resolves the mode after pressing a toggle button. Pressing the active
 * mode's button returns to "original"; pressing the other button switches to
 * it (even from the other calculated mode). This makes both buttons
 * reversible without ever re-entering the prescription.
 */
export function toggledDisplayMode(
  current: PrescriptionDisplayMode,
  pressed: "reading" | "computer"
): PrescriptionDisplayMode {
  return current === pressed ? "original" : pressed;
}

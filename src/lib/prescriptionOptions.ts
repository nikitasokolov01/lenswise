import type { PrescriptionEyeValues, PrescriptionInput } from "@/lib/types";

/**
 * Controlled option lists and display formatting for prescription entry.
 *
 * Sphere and cylinder are NEVER free-text — the Prescription step only ever
 * lets the optician choose from these fixed, 0.25-diopter-increment lists,
 * so a value like "-2.5" or "2.5" (missing the second decimal) can never be
 * entered. Cylinder uses minus-cylinder notation only (0.00 down to -8.00).
 */

const DIOPTER_STEP = 0.25;

export const SPHERE_MIN = -20;
export const SPHERE_MAX = 20;
export const CYLINDER_MIN = -8;
export const CYLINDER_MAX = 0;
export const AXIS_MIN = 1;
export const AXIS_MAX = 180;
export const ADD_MIN = 0.75;
export const ADD_MAX = 4.0;

/** Builds an inclusive list of diopter values from min to max in 0.25 steps. */
function diopterRange(min: number, max: number): number[] {
  const stepCount = Math.round((max - min) / DIOPTER_STEP);
  const values: number[] = [];
  for (let i = 0; i <= stepCount; i++) {
    // Round to 2 decimals to guard against any incidental floating point drift.
    values.push(Math.round((min + i * DIOPTER_STEP) * 100) / 100);
  }
  return values;
}

export const SPHERE_VALUES: number[] = diopterRange(SPHERE_MIN, SPHERE_MAX);
export const CYLINDER_VALUES: number[] = diopterRange(CYLINDER_MIN, CYLINDER_MAX);
export const ADD_VALUES: number[] = diopterRange(ADD_MIN, ADD_MAX);
export const AXIS_VALUES: number[] = Array.from({ length: AXIS_MAX - AXIS_MIN + 1 }, (_, i) => AXIS_MIN + i);

/** Sphere: 0 displays as "SPH"; every other value shows two decimals with an explicit sign. */
export function formatSphere(value: number): string {
  if (value === 0) return "SPH";
  const sign = value > 0 ? "+" : "-";
  return `${sign}${Math.abs(value).toFixed(2)}`;
}

/** Cylinder (minus-cylinder notation only): 0 displays as "CYL"; otherwise always "-X.XX". */
export function formatCylinder(value: number): string {
  if (value === 0) return "CYL";
  return `-${Math.abs(value).toFixed(2)}`;
}

/**
 * Shared optical-power formatter for the high-cylinder qualifying threshold.
 * Always renders a signed value with exactly two decimals, e.g.
 *   formatCylinderThreshold(-2)    // "-2.00"
 *   formatCylinderThreshold(-2.5)  // "-2.50"
 * Never JavaScript's default number formatting (which would drop the decimals).
 */
export function formatCylinderThreshold(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe > 0 ? "+" : "-";
  return `${sign}${Math.abs(safe).toFixed(2)}`;
}

/** Minus-cylinder threshold choices for Admin Pricing: -0.25 D down to -8.00 D in 0.25 steps (least to most negative). */
export const CYLINDER_THRESHOLD_VALUES: number[] = diopterRange(CYLINDER_MIN, -0.25).reverse();

export const CYLINDER_THRESHOLD_OPTIONS: PrescriptionSelectOption[] = CYLINDER_THRESHOLD_VALUES.map((value) => ({
  value,
  label: formatCylinderThreshold(value),
}));

/** Axis is a whole number, 1-180, with no decimal places. */
export function formatAxis(value: number | null): string {
  return value === null ? "—" : String(value);
}

/** Add power: "None" when not set, otherwise always two decimals with an explicit plus sign. */
export function formatAdd(value: number | null): string {
  return value === null ? "None" : `+${value.toFixed(2)}`;
}

export interface PrescriptionSelectOption {
  value: number;
  label: string;
}

export const SPHERE_OPTIONS: PrescriptionSelectOption[] = SPHERE_VALUES.map((value) => ({
  value,
  label: formatSphere(value),
}));
export const CYLINDER_OPTIONS: PrescriptionSelectOption[] = CYLINDER_VALUES.map((value) => ({
  value,
  label: formatCylinder(value),
}));
export const ADD_OPTIONS: PrescriptionSelectOption[] = ADD_VALUES.map((value) => ({
  value,
  label: formatAdd(value),
}));
export const AXIS_OPTIONS: PrescriptionSelectOption[] = AXIS_VALUES.map((value) => ({
  value,
  label: formatAxis(value),
}));

export function createBlankEyeValues(): PrescriptionEyeValues {
  return { sphere: 0, cylinder: 0, axis: null, add: null };
}

export function createBlankPrescription(): PrescriptionInput {
  return { od: createBlankEyeValues(), os: createBlankEyeValues() };
}

/**
 * One eye is valid when: axis is required and in range (1-180) whenever
 * cylinder is non-zero, and axis must be cleared (null) whenever cylinder is
 * CYL / 0.00. Sphere, cylinder, and add always hold a valid selected option
 * (or "None" for add) because they only ever come from the controlled
 * option lists above, so no further check is needed for them.
 */
export function isValidEyePrescription(eye: PrescriptionEyeValues): boolean {
  if (eye.cylinder !== 0) {
    return eye.axis !== null && eye.axis >= AXIS_MIN && eye.axis <= AXIS_MAX;
  }
  return eye.axis === null;
}

export function isValidPrescription(prescription: PrescriptionInput): boolean {
  return isValidEyePrescription(prescription.od) && isValidEyePrescription(prescription.os);
}

function formatEyeSummaryLine(label: string, eye: PrescriptionEyeValues): string {
  const axisPart = eye.cylinder !== 0 && eye.axis !== null ? ` × ${eye.axis}` : "";
  return `${label}  ${formatSphere(eye.sphere)} ${formatCylinder(eye.cylinder)}${axisPart}`;
}

/**
 * Builds the compact, formatted summary shown after a prescription is
 * applied, e.g.:
 *   OD  -2.00 -2.50 × 180
 *   OS  -1.50 -1.25 × 175
 *   ADD +2.00
 * When OD and OS add power differ, they are shown on separate lines
 * instead of being combined into one shared "ADD" line.
 */
export function formatPrescriptionSummaryLines(prescription: PrescriptionInput): string[] {
  const lines: string[] = [formatEyeSummaryLine("OD", prescription.od), formatEyeSummaryLine("OS", prescription.os)];

  if (prescription.od.add === prescription.os.add) {
    if (prescription.od.add !== null) {
      lines.push(`ADD ${formatAdd(prescription.od.add)}`);
    }
  } else {
    if (prescription.od.add !== null) lines.push(`OD ADD ${formatAdd(prescription.od.add)}`);
    if (prescription.os.add !== null) lines.push(`OS ADD ${formatAdd(prescription.os.add)}`);
  }

  return lines;
}

import {
  ADD_VALUES,
  AXIS_VALUES,
  CYLINDER_VALUES,
  SPHERE_VALUES,
} from "@/lib/prescriptionOptions";
import type { PrescriptionInput, PupillaryDistanceInput } from "@/lib/types";

export interface ScannedEyeValues {
  sphere: number | null;
  cylinder: number | null;
  axis: number | null;
  add: number | null;
}

export interface PrescriptionScanResult {
  od: ScannedEyeValues;
  os: ScannedEyeValues;
  pupillaryDistance: PupillaryDistanceInput | null;
  warnings: string[];
}

export interface ReviewedPrescriptionScan {
  prescription: PrescriptionInput;
  pupillaryDistance: PupillaryDistanceInput | null;
}

const blankEye = (): ScannedEyeValues => ({ sphere: null, cylinder: null, axis: null, add: null });
const numericToken = /[+-]?\d+(?:[.,]\d+)?|\bPLANO\b|\bPL\b|\bDS\b|\bSPH\b/gi;
const fieldLabels = /\b(SPHERE|SPH|CYLINDER|CYL|AXIS|AX|ADD|PD|PRISM|BASE)\b/gi;

function normalizeText(text: string): string {
  return text
    .replace(/[−–—]/g, "-")
    .replace(/[＋]/g, "+")
    .replace(/\bO\.?\s*D\.?\b/gi, "OD")
    .replace(/\bO\.?\s*S\.?\b/gi, "OS")
    .replace(/\r/g, "");
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  if (/^(PLANO|PL|DS|SPH)$/i.test(value)) return 0;
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function columnName(label: string): keyof ScannedEyeValues | null {
  if (/^SPH/i.test(label)) return "sphere";
  if (/^CYL/i.test(label)) return "cylinder";
  if (/^AX/i.test(label)) return "axis";
  if (/^ADD/i.test(label)) return "add";
  return null;
}

function parseEyeRow(row: string, columns: string[]): ScannedEyeValues {
  const eye = blankEye();
  const labels = [...row.matchAll(fieldLabels)];
  const firstPowerIndex = row.search(/[+-]?\d+(?:[.,]\d+)?|\bPLANO\b|\bPL\b/i);
  const firstFieldLabel = labels.find((label) => columnName(label[0]) !== null);
  if (firstFieldLabel && firstPowerIndex >= 0 && (firstFieldLabel.index ?? 0) < firstPowerIndex) {
    // Labelled rows are safe even when a printed cell is blank.
    for (let index = 0; index < labels.length; index++) {
      const label = labels[index];
      const field = columnName(label[0]);
      if (!field) continue;
      const valueArea = row.slice((label.index ?? 0) + label[0].length, labels[index + 1]?.index);
      const token = valueArea.match(numericToken)?.[0];
      eye[field] = parseNumber(token);
    }
    return eye;
  }

  const tokens = row.match(numericToken) ?? [];
  // A missing optical cell plus a numeric prism/PD cell can appear to have
  // the correct token count and silently shift values. Without column
  // coordinates, mixed tables must be cropped or entered manually.
  if (columns.some((column) => columnName(column) === null)) return eye;
  // Reject partially missing numeric cells rather than shifting an axis or
  // ADD into a different field. Headerless compact Rx requires three cells.
  const expectedColumns = columns.length ? columns : ["SPH", "CYL", "AXIS", "ADD"];
  const requiredTokens = columns.length
    ? Math.max(3, ...columns.map((column, index) => columnName(column) ? index + 1 : 0))
    : 3;
  if (tokens.length < requiredTokens) return eye;
  expectedColumns.forEach((column, index) => {
    const field = columnName(column);
    if (field) eye[field] = parseNumber(tokens[index]);
  });
  return eye;
}

function validateEye(eye: ScannedEyeValues, name: string, warnings: string[]): ScannedEyeValues {
  const next = { ...eye };
  if (next.cylinder !== null && next.cylinder > 0) {
    if (next.sphere !== null && next.axis !== null && AXIS_VALUES.includes(next.axis)) {
      next.sphere = Math.round((next.sphere + next.cylinder) * 100) / 100;
      next.cylinder = -next.cylinder;
      next.axis = next.axis > 90 ? next.axis - 90 : next.axis + 90;
      warnings.push(`${name}: plus cylinder was converted to equivalent minus-cylinder notation. Check the converted values.`);
    } else {
      next.cylinder = null;
      warnings.push(`${name}: plus cylinder could not be converted. Enter a complete minus-cylinder prescription manually.`);
    }
  }
  if (next.sphere !== null && !SPHERE_VALUES.includes(next.sphere)) {
    next.sphere = null;
    warnings.push(`${name}: sphere is outside the supported values. Select it manually.`);
  }
  if (next.cylinder !== null && !CYLINDER_VALUES.includes(next.cylinder)) {
    next.cylinder = null;
    warnings.push(`${name}: cylinder is outside the supported values. Select it manually.`);
  }
  if (next.axis !== null && !AXIS_VALUES.includes(next.axis)) {
    next.axis = null;
    warnings.push(`${name}: axis could not be read reliably. Select it manually.`);
  }
  if (next.cylinder === 0) next.axis = null;
  if (next.add === 0) next.add = null;
  if (next.add !== null && !ADD_VALUES.includes(next.add)) {
    next.add = null;
    warnings.push(`${name}: ADD is outside the supported values. Check it manually.`);
  }
  return next;
}

function parsePd(lines: string[], warnings: string[]): PupillaryDistanceInput | null {
  const candidates = lines.filter((line) => /\b(?:PD|PUPILLARY\s+DISTANCE)\b/i.test(line));
  if (candidates.length !== 1) return null;
  const line = candidates[0];
  // Near PD must not overwrite a distance measurement used by this quote.
  if (/\bNEAR\b/i.test(line)) return null;
  const valueArea = line.replace(/^.*?\b(?:PD|PUPILLARY\s+DISTANCE)\b[:\s]*/i, "");
  const values = (valueArea.match(/[+-]?\s*\d+(?:[.,]\d+)?/g) ?? [])
    .map((value) => Number(value.replace(/\s/g, "").replace(",", ".")));
  const validPd = (value: number, minimum: number, maximum: number) =>
    value >= minimum && value <= maximum && Number.isInteger(value * 10);
  if (values.length === 1 && validPd(values[0], 40, 85)) {
    return { mode: "binocular", binocular: String(values[0]), right: "", left: "" };
  }
  if (values.length === 2 && values.every((value) => validPd(value, 20, 45))) {
    // Require an explicit right-first label; do not assume ordering for a
    // bare slash pair or a left-first printed prescription.
    if (/\b(?:OD|RIGHT|R)\b.*\b(?:OS|LEFT|L)\b/i.test(valueArea)) {
      return { mode: "monocular", binocular: "", right: String(values[0]), left: String(values[1]) };
    }
    if (/\b(?:OS|LEFT|L)\b.*\b(?:OD|RIGHT|R)\b/i.test(valueArea)) {
      return { mode: "monocular", binocular: "", right: String(values[1]), left: String(values[0]) };
    }
    warnings.push("Two PD numbers were found without eye labels. Enter right and left PD manually.");
  } else if (values.length) {
    warnings.push("PD could not be read reliably. Check the paper and enter it manually.");
  }
  return null;
}

/** Parse only optical values. Names, dates, and the full OCR text are never retained. */
export function parsePrescriptionScan(rawText: string): PrescriptionScanResult {
  const lines = normalizeText(rawText).split("\n").map((line) => line.trim()).filter(Boolean);
  const warnings: string[] = [];
  const rows: Record<"od" | "os", ScannedEyeValues[]> = { od: [], os: [] };
  let columns: string[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const rowMatch = line.match(/^(OD|OS|RIGHT(?:\s+EYE)?|LEFT(?:\s+EYE)?|R|L)\b\s*[:|]?\s*(.*)$/i);
    if (rowMatch) {
      const eye = /^(OD|RIGHT|R)$/i.test(rowMatch[1].replace(/\s+EYE$/i, "")) ? "od" : "os";
      const body = rowMatch[2] || lines[index + 1] || "";
      const parsed = parseEyeRow(body, columns);
      if (parsed.sphere !== null || parsed.cylinder !== null || parsed.axis !== null || parsed.add !== null) {
        rows[eye].push(parsed);
      }
      continue;
    }
    const labels = [...line.matchAll(fieldLabels)].map((match) => match[0].toUpperCase());
    if (labels.includes("SPH") || labels.includes("SPHERE")) {
      if (labels.some((label) => /^CYL/.test(label)) && labels.some((label) => /^AX/.test(label))) columns = labels;
    }
  }

  const sharedAddLine = lines.filter((line) => /^ADD\b/i.test(line));
  const sharedAdd = sharedAddLine.length === 1 ? parseNumber(sharedAddLine[0].replace(/^ADD\b/i, "").match(numericToken)?.[0]) : null;
  const getEye = (eye: "od" | "os") => {
    const name = eye.toUpperCase();
    if (rows[eye].length > 1) {
      warnings.push(`${name}: multiple prescriptions were found. Crop to one prescription and scan again, or enter this eye manually.`);
      return blankEye();
    }
    const values = rows[eye][0] ?? blankEye();
    if (values.add === null && sharedAdd !== null) values.add = sharedAdd;
    if (!rows[eye].length) {
      warnings.push(columns.some((column) => columnName(column) === null)
        ? `${name}: this table has extra columns that could shift values. Crop to the SPH, CYL, AXIS, and ADD columns and scan again, or enter this eye manually.`
        : `${name}: no clear prescription row found. Enter this eye manually.`);
    }
    return validateEye(values, name, warnings);
  };
  const od = getEye("od");
  const os = getEye("os");
  if (/\b(PRISM|BASE\s+(?:IN|OUT|UP|DOWN)|BI|BO|BU|BD)\b/i.test(rawText)) {
    warnings.push("Prism information may be present. This scanner does not import prism; check and record it separately.");
  }
  return { od, os, pupillaryDistance: parsePd(lines, warnings), warnings };
}

export function reviewedScanPrescription(result: Pick<PrescriptionScanResult, "od" | "os">): PrescriptionInput | null {
  const validEye = (eye: ScannedEyeValues) =>
    eye.sphere !== null && SPHERE_VALUES.includes(eye.sphere) &&
    eye.cylinder !== null && CYLINDER_VALUES.includes(eye.cylinder) &&
    (eye.cylinder === 0 ? eye.axis === null : eye.axis !== null && AXIS_VALUES.includes(eye.axis)) &&
    (eye.add === null || ADD_VALUES.includes(eye.add));
  if (!validEye(result.od) || !validEye(result.os)) return null;
  return { od: { ...result.od } as PrescriptionInput["od"], os: { ...result.os } as PrescriptionInput["os"] };
}

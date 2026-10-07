import {
  parseObservedPrescriptionRows,
  type ObservedPrescriptionRow,
  type PrescriptionScanRegion,
  type PrescriptionScanResult,
  type PrescriptionScanWord,
  type ScannedEyeValues,
} from "@/lib/prescriptionScan";
import type { PrescriptionScanGrid } from "@/lib/prescriptionScanGrid";

export type PrescriptionTableCellKind = "heading" | "eye" | "value";
export interface PrescriptionTableReading {
  result: PrescriptionScanResult | null;
  /** Ephemeral OCR evidence for local review/diagnostics, never persisted. */
  words: PrescriptionScanWord[];
  metadata: {
    gridsExamined: number;
    matchedTables: number;
    eyeRows: number;
    cellReads: number;
    cancelled: boolean;
    blocker: "none" | "limits" | "invalid_geometry" | "ambiguous_prescription" | "uncertain_labels";
  };
}

const FIELDS = ["sphere", "cylinder", "axis", "add"] as const;
const HEADER_NAMES: Record<keyof ScannedEyeValues, RegExp> = {
  sphere: /^(?:SPHERE|SPH)$/i, cylinder: /^(?:CYLINDER|CYL)$/i,
  axis: /^(?:AXIS|AX)$/i, add: /^(?:ADD|ADDITION)$/i,
};
const bareLabel = (text: string) => text.trim().replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, "");
const headerField = (word: PrescriptionScanWord) => FIELDS.find((field) => HEADER_NAMES[field].test(bareLabel(word.text)));
const eyeLabel = (word: PrescriptionScanWord): "od" | "os" | null => {
  const label = bareLabel(word.text).replace(/[.\s]/g, "").toUpperCase();
  if (/^(OD|RIGHT|RIGHTEYE|RE|R)$/.test(label)) return "od";
  if (/^(OS|LEFT|LEFTEYE|LE|L)$/.test(label)) return "os";
  return null;
};
const confident = (word: PrescriptionScanWord) => Number.isFinite(word.confidence) && word.confidence! >= 60 && word.confidence! <= 100;

const ruleInset = (widths: number[] | undefined, index: number) => widths ? widths[index] / 2 + 1 : 2;

function cellRegion(grid: PrescriptionScanGrid, column: number, row: number): PrescriptionScanRegion | null {
  // Exclude only the observed rules, never broad portions of numeric ink.
  const left = Math.ceil(grid.columns[column] + ruleInset(grid.columnWidths, column));
  const right = Math.floor(grid.columns[column + 1] - ruleInset(grid.columnWidths, column + 1));
  const top = Math.ceil(grid.rows[row] + ruleInset(grid.rowWidths, row));
  const bottom = Math.floor(grid.rows[row + 1] - ruleInset(grid.rowWidths, row + 1));
  return right > left && bottom > top ? { left, top, width: right - left, height: bottom - top } : null;
}

/**
 * At most two small ruled tables. Callback words/symbols MUST already be mapped
 * to the original image coordinates; never manufacture labels or their boxes.
 * Every candidate's headings and labels are checked before any values are read.
 */
export async function readPrescriptionTableGrids(
  grids: PrescriptionScanGrid[],
  imageWidth: number,
  imageHeight: number,
  recognizeCell: (region: PrescriptionScanRegion, kind: PrescriptionTableCellKind) => Promise<PrescriptionScanWord[]>,
  shouldCancel: () => boolean = () => false,
): Promise<PrescriptionTableReading> {
  const reading: PrescriptionTableReading = {
    result: null, words: [], metadata: { gridsExamined: 0, matchedTables: 0, eyeRows: 0, cellReads: 0, cancelled: false, blocker: "none" },
  };
  const cancel = () => {
    if (!shouldCancel()) return false;
    reading.result = null; reading.words = []; reading.metadata.cancelled = true;
    return true;
  };
  const refuse = (blocker: PrescriptionTableReading["metadata"]["blocker"], ambiguous = false) => {
    reading.metadata.blocker = blocker;
    if (ambiguous) reading.result = {
      od: { sphere: null, cylinder: null, axis: null, add: null },
      os: { sphere: null, cylinder: null, axis: null, add: null }, pupillaryDistance: null, requiresRescan: true,
      warnings: ["Multiple prescription tables or eye labels were found. Crop to one prescription and scan again."],
    };
    return reading;
  };
  if (cancel()) return reading;
  if (!Number.isInteger(imageWidth) || !Number.isInteger(imageHeight) || imageWidth < 1 || imageHeight < 1
    || imageWidth > 4800 || imageHeight > 4800 || imageWidth * imageHeight > 8_000_000 || grids.length > 2) return refuse("limits");
  for (const grid of grids) {
    const { left, top, width, height } = grid.bbox;
    if (grid.columns.length < 4 || grid.columns.length > 13 || grid.rows.length < 3 || grid.rows.length > 7) return refuse("limits");
    if (![left, top, width, height, ...grid.columns, ...grid.rows].every(Number.isFinite)
      || left < 0 || top < 0 || width <= 0 || height <= 0 || left + width > imageWidth || top + height > imageHeight
      || grid.columns.some((value, index) => value < left || value > left + width || index > 0 && value <= grid.columns[index - 1])
      || grid.rows.some((value, index) => value < top || value > top + height || index > 0 && value <= grid.rows[index - 1])) return refuse("invalid_geometry");
    const validWidths = (lines: number[], widths: number[] | undefined) => widths === undefined
      || Array.isArray(widths) && widths.length === lines.length && widths.every((value) => Number.isFinite(value) && value > 0);
    if (!validWidths(grid.columns, grid.columnWidths) || !validWidths(grid.rows, grid.rowWidths)) return refuse("invalid_geometry");
    // Contradictory stroke envelopes cannot be repaired into a guessed cell.
    for (const [lines, widths] of [[grid.columns, grid.columnWidths], [grid.rows, grid.rowWidths]] as const) {
      if (lines.slice(0, -1).some((line, index) => Math.ceil(line + ruleInset(widths, index))
        >= Math.floor(lines[index + 1] - ruleInset(widths, index + 1)))) return refuse("invalid_geometry");
    }
  }
  let invalidWords = false;
  const read = async (region: PrescriptionScanRegion, kind: PrescriptionTableCellKind) => {
    if (cancel()) return [];
    reading.metadata.cellReads++;
    const words = await recognizeCell(region, kind);
    if (cancel()) return [];
    if (words.some((word) => {
      // OCR can give an isolated table rule a box extending into the white
      // border. It cannot establish a heading/eye, so its crop containment is
      // irrelevant there. Retain the evidence; NEVER exempt numeric cells,
      // signs, letters, mixed tokens, or malformed boxes from geometry checks.
      const onlyRule = kind !== "value" && /^[|_]+$/.test(word.text.trim());
      return !Object.values(word.bbox).every(Number.isFinite)
        || word.bbox.x1 <= word.bbox.x0 || word.bbox.y1 <= word.bbox.y0
        || !onlyRule && (word.bbox.x0 < region.left || word.bbox.x1 > region.left + region.width
          || word.bbox.y0 < region.top || word.bbox.y1 > region.top + region.height);
    })) invalidWords = true;
    reading.words.push(...words);
    return words;
  };
  interface Candidate {
    grid: PrescriptionScanGrid;
    headings: Partial<Record<keyof ScannedEyeValues, PrescriptionScanWord>>;
    columns: Partial<Record<keyof ScannedEyeValues, number>>;
    rows: { index: number; eye: "od" | "os"; label: PrescriptionScanWord }[];
    prism: boolean;
  }
  const candidates: Candidate[] = [];
  let uncertainHeaders = false;
  for (const grid of grids) {
    if (cancel()) return reading;
    reading.metadata.gridsExamined++;
    const cells: PrescriptionScanWord[][] = [];
    for (let column = 0; column < grid.columns.length - 1; column++) {
      const region = cellRegion(grid, column, 0);
      if (!region) return refuse("invalid_geometry");
      cells.push(await read(region, "heading"));
      if (cancel()) return reading;
    }
    if (invalidWords) return refuse("invalid_geometry");
    const found = FIELDS.map((field) => ({ field, matches: cells.flatMap((words, column) => words.filter((word) => headerField(word) === field).map((word) => ({ word, column }))) }));
    if (!found.slice(0, 3).every(({ matches }) => matches.length > 0)) continue;
    reading.metadata.matchedTables++;
    if (found.some(({ matches }) => matches.length > 1)) return refuse("ambiguous_prescription", true);
    // A labelled values row is not a table heading. Keep extra OCR evidence
    // visible rather than stripping numbers/unknown words to create an anchor.
    const clearHeadingCells = !cells.flat().some((word) => eyeLabel(word))
      && found.every(({ matches }) => matches.every(({ word, column }) => cells[column].every((other) => other === word
        || !other.text.trim() || /^[\p{P}\p{S}\s]+$/u.test(other.text))));
    if (!clearHeadingCells || !found.slice(0, 3).every(({ matches }) => confident(matches[0].word))) {
      uncertainHeaders = true;
      continue;
    }
    const headings: Candidate["headings"] = {}, columns: Candidate["columns"] = {};
    for (const { field, matches } of found) if (matches.length && confident(matches[0].word)) {
      headings[field] = matches[0].word; columns[field] = matches[0].column;
    }
    if (new Set(Object.values(columns)).size !== Object.values(columns).length
      || columns.sphere! >= columns.cylinder! || columns.cylinder! >= columns.axis!
      || columns.add !== undefined && columns.add <= columns.axis!) return refuse("ambiguous_prescription", true);
    candidates.push({ grid, headings, columns, rows: [], prism: cells.flat().some((word) => /^PRISM$/i.test(bareLabel(word.text))) });
  }
  if (cancel()) return reading;
  if (reading.metadata.matchedTables > 1) return refuse("ambiguous_prescription", true);
  if (uncertainHeaders) return refuse("uncertain_labels");
  const candidate = candidates[0];
  if (!candidate) return reading;
  const { grid } = candidate;
  for (let row = 1; row < grid.rows.length - 1; row++) {
    const height = grid.rows[row + 1] - grid.rows[row];
    const left = Math.max(0, Math.ceil(grid.bbox.left - height * 4));
    const sphereColumn = candidate.columns.sphere!;
    const right = Math.floor(grid.columns[sphereColumn] - ruleInset(grid.columnWidths, sphereColumn));
    const top = Math.ceil(grid.rows[row] + ruleInset(grid.rowWidths, row));
    const bottom = Math.floor(grid.rows[row + 1] - ruleInset(grid.rowWidths, row + 1));
    // Covers the real left gutter AND any leading Rx/Balance columns.
    if (right <= left || bottom <= top) return refuse("invalid_geometry");
    const words = await read({ left, top, width: right - left, height: bottom - top }, "eye");
    if (cancel()) return reading;
    if (invalidWords) return refuse("invalid_geometry");
    const labels = words.filter((word) => eyeLabel(word));
    if (labels.length > 1) return refuse("ambiguous_prescription", true);
    if (labels.some((word) => !confident(word))) return refuse("uncertain_labels");
    if (labels.length) candidate.rows.push({ index: row, eye: eyeLabel(labels[0])!, label: labels[0] });
  }
  reading.metadata.eyeRows = candidate.rows.length;
  if (candidate.rows.some((row, index) => candidate.rows.some((other, otherIndex) => otherIndex < index && other.eye === row.eye))) return refuse("ambiguous_prescription", true);
  if (!candidate.rows.length) return reading;
  const observed: ObservedPrescriptionRow[] = [];
  for (const row of candidate.rows) {
    const cells: ObservedPrescriptionRow["cells"] = {};
    for (const field of FIELDS) {
      const column = candidate.columns[field];
      if (column === undefined) continue;
      // Axis is inapplicable only after the SAME exact-cell parser has
      // validated explicit zero cylinder evidence (e.g. D.S., PL, or 0.00).
      // Do not OCR that usually blank box: isolated rules can become junk.
      // Missing, uncertain, ambiguous, and nonzero cylinders still read axis.
      if (field === "axis" && parseObservedPrescriptionRows(candidate.headings,
        [{ eye: row.eye, label: row.label, cells }])[row.eye].cylinder === 0) continue;
      const region = cellRegion(grid, column, row.index);
      if (!region) return refuse("invalid_geometry");
      cells[field] = await read(region, "value");
      if (cancel()) return reading;
      if (invalidWords) return refuse("invalid_geometry");
    }
    observed.push({ eye: row.eye, label: row.label, cells });
  }
  reading.result = parseObservedPrescriptionRows(candidate.headings, observed, candidate.prism);
  return reading;
}

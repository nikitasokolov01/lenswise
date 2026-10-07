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
  /** Multiple tables/rows cannot be resolved by another automatic reading. */
  requiresRescan?: boolean;
}

export interface ReviewedPrescriptionScan {
  prescription: PrescriptionInput;
  pupillaryDistance: PupillaryDistanceInput | null;
}

/** Optional OCR coordinates let tables retain blank cells and extra columns. */
export interface PrescriptionScanWord {
  text: string;
  confidence?: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

const blankEye = (): ScannedEyeValues => ({ sphere: null, cylinder: null, axis: null, add: null });
const numericToken = /[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)|\bPLANO\b|\bPL\b|\bDS\b|\bSPH\b/gi;
const fieldLabels = /\b(SPHERE|SPH|CYLINDER|CYL|AXIS|AX|ADD|PD|PRISM|BASE)\b/gi;
const eyeRowPattern = /^(OD|OS|RIGHT(?:\s+EYE)?|LEFT(?:\s+EYE)?|R|L)\b\s*[:|]?\s*(.*)$/i;

function normalizeText(text: string): string {
  return text
    .replace(/[−–—]/g, "-")
    .replace(/[＋]/g, "+")
    .replace(/\bO\.?[ \t]*D\.?\b/gi, "OD")
    .replace(/\bO\.?[ \t]*S\.?\b/gi, "OS")
    .replace(/(^|\n)([ \t]*)0([DS])(?=[. \t:|])/gi, "$1$2O$3")
    .replace(/\bR\.[ \t]*E\.?\b/gi, "RIGHT")
    .replace(/\bL\.[ \t]*E\.?\b/gi, "LEFT")
    .replace(/([+-])[ \t]+(?=\d|[.,]\d)/g, "$1")
    .replace(/(\d)[ \t]*([.,])[ \t]*(?=\d)/g, "$1$2")
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

function wordColumnName(text: string): keyof ScannedEyeValues | null {
  const label = text.replace(/[^a-z]/gi, "").toUpperCase();
  if (/^(SPHERE|SPH)$/.test(label)) return "sphere";
  if (/^(CYLINDER|CYL)$/.test(label)) return "cylinder";
  if (/^(AXIS|AX)$/.test(label)) return "axis";
  if (/^(ADD|ADDITION)$/.test(label)) return "add";
  return null;
}

function wordEye(text: string): "od" | "os" | null {
  const label = text.replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (/^(OD|0D|RIGHT|RIGHTEYE|RE|R)$/.test(label)) return "od";
  if (/^(OS|0S|LEFT|LEFTEYE|LE|L)$/.test(label)) return "os";
  return null;
}

const wordX = (word: PrescriptionScanWord) => (word.bbox.x0 + word.bbox.x1) / 2;
const wordY = (word: PrescriptionScanWord) => (word.bbox.y0 + word.bbox.y1) / 2;
const wordHeight = (word: PrescriptionScanWord) => word.bbox.y1 - word.bbox.y0;

function readSpatialCell(words: PrescriptionScanWord[], eye: string, field: keyof ScannedEyeValues, warnings: string[]): number | null {
  if (!words.length) return null;
  const ordered = [...words].sort((a, b) => a.bbox.x0 - b.bbox.x0);
  // Adjacent sign and decimal fragments are often separate OCR words.
  const source = normalizeText(ordered.map((word) => word.text).join(" ")).trim()
    .replace(field === "axis" ? /^(?:x|×)\s*|[°º]/gi : /$^/g, "");
  const tokens = source.match(numericToken) ?? [];
  if (tokens.length !== 1 || !/^[\s+\-\d.,]*$|^(PLANO|PL|DS|SPH)$/i.test(source)) {
    warnings.push(`${eye}: ${field} contains an unclear or extra character. Select it manually.`);
    return null;
  }
  if (ordered.some((word) => word.confidence !== undefined && word.confidence < 45)) {
    warnings.push(`${eye}: ${field} was difficult to read. Select it manually.`);
    return null;
  }
  const value = parseNumber(tokens[0]);
  if ((field === "sphere" || field === "cylinder") && value !== null && value !== 0 && !/^[+-]/.test(tokens[0])) {
    warnings.push(`${eye}: ${field} has no clear plus/minus sign. Check the sign against the paper.`);
  }
  return value;
}

/** Align values by printed columns instead of flattening blank cells away. */
function spatialRows(words: PrescriptionScanWord[], warnings: string[]): {
  rows: Record<"od" | "os", ScannedEyeValues[]>; hasTable: boolean; ambiguous: boolean;
} {
  const rows: Record<"od" | "os", ScannedEyeValues[]> = { od: [], os: [] };
  let tables = 0;
  let ambiguous = false;
  const usable = words.filter((word) => word.text.trim() && Object.values(word.bbox).every(Number.isFinite)
    && word.bbox.x1 > word.bbox.x0 && word.bbox.y1 > word.bbox.y0);
  const anchors = usable.filter((word) => wordColumnName(word.text) === "sphere" && (word.confidence ?? 100) >= 45);
  const usedHeaders = new Set<PrescriptionScanWord>();

  for (const anchor of anchors) {
    if (usedHeaders.has(anchor)) continue;
    const headerWords = usable.filter((word) => Math.abs(wordY(word) - wordY(anchor)) <= Math.max(wordHeight(word), wordHeight(anchor)) * 0.7)
      .sort((a, b) => wordX(a) - wordX(b));
    const opticalHeaders = headerWords.filter((word) => wordColumnName(word.text) && (word.confidence ?? 100) >= 45);
    const fields = opticalHeaders.map((word) => wordColumnName(word.text));
    if (!["sphere", "cylinder", "axis"].every((field) => fields.includes(field as keyof ScannedEyeValues))
      || new Set(fields).size !== fields.length) continue;
    opticalHeaders.forEach((word) => usedHeaders.add(word));
    const firstX = Math.min(...opticalHeaders.map(wordX));
    const headerBottom = Math.max(...headerWords.map((word) => word.bbox.y1));
    // Restrict the search to the table immediately below these headings.
    const maximumRowY = headerBottom + Math.max(wordHeight(anchor) * 12, 180);
    const labels = usable.filter((word) => wordEye(word.text) && wordY(word) > headerBottom && wordY(word) < maximumRowY
      && wordX(word) < firstX && (word.confidence ?? 100) >= 40).sort((a, b) => wordY(a) - wordY(b));
    const groups: { eye: "od" | "os"; labels: PrescriptionScanWord[]; y: number }[] = [];
    for (const label of labels) {
      const eye = wordEye(label.text)!;
      const previous = groups.find((group) => group.eye === eye && Math.abs(group.y - wordY(label)) <= wordHeight(label)
        * (group.labels.some((item) => item.text.replace(/\W/g, "").toUpperCase() === label.text.replace(/\W/g, "").toUpperCase()) ? 0.6 : 1.5)
        && Math.abs(wordX(group.labels[0]) - wordX(label)) < wordHeight(label) * 4);
      if (previous) {
        previous.labels.push(label);
        previous.y = previous.labels.reduce((sum, word) => sum + wordY(word), 0) / previous.labels.length;
      } else groups.push({ eye, labels: [label], y: wordY(label) });
    }
    groups.sort((a, b) => a.y - b.y);
    if (!groups.some((group) => group.eye === "od") || !groups.some((group) => group.eye === "os")) continue;
    tables += 1;
    if (groups.length !== 2) {
      ambiguous = true;
      continue;
    }
    for (let rowIndex = 0; rowIndex < groups.length; rowIndex++) {
      const group = groups[rowIndex];
      const rowHeight = Math.max(...group.labels.map(wordHeight), wordHeight(anchor));
      const top = Math.max(headerBottom, group.y - rowHeight * 1.5, rowIndex > 0 ? (groups[rowIndex - 1].y + group.y) / 2 : 0);
      const bottom = Math.min(group.y + rowHeight * 1.5, groups[rowIndex + 1] ? (group.y + groups[rowIndex + 1].y) / 2 : Number.POSITIVE_INFINITY);
      const values = blankEye();
      for (const heading of opticalHeaders) {
        const field = wordColumnName(heading.text)!;
        const index = headerWords.indexOf(heading);
        const left = index > 0 ? (wordX(headerWords[index - 1]) + wordX(heading)) / 2 : heading.bbox.x0 - wordHeight(heading) * 2;
        const right = headerWords[index + 1] ? (wordX(heading) + wordX(headerWords[index + 1])) / 2 : heading.bbox.x1 + wordHeight(heading) * 2;
        const cell = usable.filter((word) => wordY(word) > top && wordY(word) < bottom && wordX(word) > left && wordX(word) < right
          && !group.labels.includes(word));
        values[field] = readSpatialCell(cell, group.eye.toUpperCase(), field, warnings);
      }
      rows[group.eye].push(values);
    }
  }
  return { rows, hasTable: tables > 0, ambiguous: ambiguous || tables > 1 };
}

function parseEyeRow(row: string, columns: string[], warnings: string[], name: string): ScannedEyeValues {
  const eye = blankEye();
  const allLabels = [...row.matchAll(fieldLabels)];
  const labels = allLabels.filter((label, index) => {
    const previous = allLabels[index - 1];
    // SPH in an otherwise blank cylinder cell explicitly means spherical.
    // It is a cell value, not a second sphere heading.
    return !(label[0].toUpperCase() === "SPH" && previous && columnName(previous[0]) === "cylinder"
      && /^[\s:=|]*$/.test(row.slice((previous.index ?? 0) + previous[0].length, label.index)));
  });
  const firstPowerIndex = row.search(/[+-]?\d+(?:[.,]\d+)?|\bPLANO\b|\bPL\b/i);
  const firstFieldLabel = labels.find((label) => columnName(label[0]) !== null);
  if (firstFieldLabel && firstPowerIndex >= 0 && (firstFieldLabel.index ?? 0) < firstPowerIndex) {
    // Labelled rows are safe even when a printed cell is blank.
    const seenFields = new Set<keyof ScannedEyeValues>();
    const ambiguousFields = new Set<keyof ScannedEyeValues>();
    for (let index = 0; index < labels.length; index++) {
      const label = labels[index];
      const field = columnName(label[0]);
      if (!field) continue;
      const valueArea = row.slice((label.index ?? 0) + label[0].length, labels[index + 1]?.index)
        .replace(/^[\s:=|]+|[\s|;]+$/g, "")
        .replace(field === "axis" ? /^(?:x|×)\s*|[°º]/gi : /$^/g, "")
        .replace(/\s*D(?:IOPTERS?)?\.?$/i, "").trim()
        .replace(/^\((.*)\)$/, "$1");
      const tokens = valueArea.match(numericToken) ?? [];
      const clearToken = /^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$|^(PLANO|PL|DS|SPH)$/i.test(valueArea);
      if (seenFields.has(field) || (valueArea && (tokens.length !== 1 || !clearToken))) {
        ambiguousFields.add(field);
      } else eye[field] = parseNumber(tokens[0]);
      seenFields.add(field);
    }
    for (const field of ambiguousFields) {
      eye[field] = null;
      warnings.push(`${name}: ${field} has duplicate or unclear values. Select it manually from the paper.`);
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
export function parsePrescriptionScan(rawText: string, words: PrescriptionScanWord[] = []): PrescriptionScanResult {
  const lines = normalizeText(rawText).split("\n").map((line) => line.trim()).filter(Boolean);
  const warnings: string[] = [];
  const rows: Record<"od" | "os", ScannedEyeValues[]> = { od: [], os: [] };
  const claimedAddLines = new Set<number>();
  const credibleRawRows = { od: 0, os: 0 };
  let rawTableHeadings = 0;
  let columns: string[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const rowMatch = line.match(eyeRowPattern);
    if (rowMatch) {
      const eye = /^(OD|RIGHT|R)$/i.test(rowMatch[1].replace(/\s+EYE$/i, "")) ? "od" : "os";
      const followingLine = lines[index + 1] ?? "";
      const clearContinuation = !eyeRowPattern.test(followingLine) && (
        /^(?:SPHERE|SPH|CYLINDER|CYL|AXIS|AX|ADD)\b/i.test(followingLine) && /\d/.test(followingLine)
        || Boolean(followingLine.match(numericToken)?.length) && !followingLine.replace(numericToken, "").replace(/[\s|,:()×x]/gi, "")
      );
      let body = rowMatch[2] || (clearContinuation ? followingLine : "");
      if (!rowMatch[2] && clearContinuation && /^ADD\b/i.test(followingLine)) claimedAddLines.add(index + 1);
      // Wrapped labelled cells are unambiguous; bare numbers are not joined
      // across lines because their column/eye association would be unknown.
      if (/\b(?:SPHERE|SPH|CYLINDER|CYL|AXIS|AX|ADD)\b/i.test(body)) {
        for (let continuation = rowMatch[2] ? index + 1 : index + 2; continuation < Math.min(index + 5, lines.length); continuation++) {
          if (!/^(?:SPHERE|SPH|CYLINDER|CYL|AXIS|AX|ADD)\b/i.test(lines[continuation])) break;
          body += ` ${lines[continuation]}`;
          if (/^ADD\b/i.test(lines[continuation])) claimedAddLines.add(continuation);
        }
      }
      // Count optical-looking rows before parsing: mixed columns may reject
      // their values, but must not hide evidence of a second prescription.
      const rawTokens = body.match(numericToken) ?? [];
      if (rawTokens.length >= 3 && rawTokens.some((token) => /[.,]|^(?:PLANO|PL|DS|SPH)$/i.test(token))) credibleRawRows[eye] += 1;
      const parsed = parseEyeRow(body, columns, warnings, eye.toUpperCase());
      if (parsed.sphere !== null || parsed.cylinder !== null || parsed.axis !== null || parsed.add !== null) {
        rows[eye].push(parsed);
      }
      continue;
    }
    const labels = [...line.matchAll(fieldLabels)].map((match) => match[0].toUpperCase());
    if (!/\d/.test(line) && (labels.includes("SPH") || labels.includes("SPHERE"))) {
      if (labels.some((label) => /^CYL/.test(label)) && labels.some((label) => /^AX/.test(label))) {
        columns = labels;
        if (!line.replace(fieldLabels, "").replace(/[\s|:/.,()\-]/g, "")) rawTableHeadings += 1;
      }
    }
  }

  const spatial = spatialRows(words, warnings);
  const rawAmbiguous = rawTableHeadings > 1 || credibleRawRows.od > 1 || credibleRawRows.os > 1;
  const sharedAddLine = lines.filter((line, index) => /^OU\s+ADD\b/i.test(line) || (!claimedAddLines.has(index) && /^ADD\b/i.test(line)));
  const sharedAdd = sharedAddLine.length === 1 ? parseNumber(sharedAddLine[0].replace(/^(?:OU\s+)?ADD\b/i, "").match(numericToken)?.[0]) : null;
  const getEye = (eye: "od" | "os") => {
    const name = eye.toUpperCase();
    if (spatial.ambiguous || rawAmbiguous) {
      warnings.push(`${name}: multiple prescriptions or eye rows were found. Crop to one prescription and scan again.`);
      return blankEye();
    }
    const eyeRows = spatial.hasTable ? spatial.rows[eye] : rows[eye];
    if (eyeRows.length > 1 || rows[eye].length > 1) {
      warnings.push(`${name}: multiple prescriptions were found. Crop to one prescription and scan again, or enter this eye manually.`);
      return blankEye();
    }
    const values = eyeRows[0] ?? blankEye();
    if (values.add === null && sharedAdd !== null) values.add = sharedAdd;
    if (!eyeRows.length) {
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
  return {
    od, os, pupillaryDistance: parsePd(lines, warnings), warnings,
    ...(spatial.ambiguous || rawAmbiguous || rows.od.length > 1 || rows.os.length > 1 ? { requiresRescan: true } : {}),
  };
}

/** A retry can recover missing cells, but disagreements must be reviewed. */
export function combinePrescriptionScanPasses(first: PrescriptionScanResult, second: PrescriptionScanResult): PrescriptionScanResult {
  const warnings = [...first.warnings, ...second.warnings];
  if (first.requiresRescan || second.requiresRescan) {
    return { od: blankEye(), os: blankEye(), pupillaryDistance: null, warnings: [...new Set(warnings)], requiresRescan: true };
  }
  const mergeEye = (eye: "od" | "os") => {
    const merged = blankEye();
    for (const field of ["sphere", "cylinder", "axis", "add"] as const) {
      const a = first[eye][field];
      const b = second[eye][field];
      if (warnings.some((warning) => warning.startsWith(`${eye.toUpperCase()}: ${field} has duplicate or unclear`))) {
        merged[field] = null;
      } else if (a !== null && b !== null && a !== b) {
        warnings.push(`${eye.toUpperCase()}: two readings disagree on ${field}. Select it manually from the paper.`);
        merged[field] = null;
      } else merged[field] = a ?? b;
    }
    if (merged.cylinder === 0) merged.axis = null;
    return merged;
  };
  let pd = first.pupillaryDistance ?? second.pupillaryDistance;
  if (first.pupillaryDistance && second.pupillaryDistance && JSON.stringify(first.pupillaryDistance) !== JSON.stringify(second.pupillaryDistance)) {
    pd = null;
    warnings.push("Two readings disagree on PD. Enter it manually from the paper.");
  }
  return { od: mergeEye("od"), os: mergeEye("os"), pupillaryDistance: pd, warnings: [...new Set(warnings)] };
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

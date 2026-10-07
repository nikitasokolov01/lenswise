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
  /** Only a newly aligned source may replace this blank reading. */
  requiresAlignment?: boolean;
  /** Parser evidence of a unique horizontal table with an observed eye row. */
  hasAlignedTable?: boolean;
  /** One observed eye anchor spans more than one possible numeric row. */
  requiresRowReview?: boolean;
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

export interface PrescriptionScanRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Coordinates are in OCR-input pixels, not CSS pixels. No text is retained. */
export interface PrescriptionScanRegions {
  header: PrescriptionScanRegion;
  table: PrescriptionScanRegion;
  rows: Partial<Record<"od" | "os", PrescriptionScanRegion>>;
  cells: Partial<Record<"od" | "os", Partial<Record<keyof ScannedEyeValues, PrescriptionScanRegion>>>>;
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
    // D.S. explicitly means spherical; a blank cylinder still stays blank.
    .replace(/\bD\.[ \t]*S\.?(?=\s|$|[|,;])/gi, "DS")
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
  if (tokens.length > 1) {
    // A tighter automatic crop may drop one of two printed values. This
    // definite cell ambiguity stays blank across retries until reviewed.
    warnings.push(`${eye}: ${field} has duplicate or unclear values. Select it manually from the paper.`);
    return null;
  }
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

function isOpticalHeader(text: string): boolean {
  return /\b(?:SPHERE|SPH)\b/i.test(text) && /\b(?:CYLINDER|CYL)\b/i.test(text) && /\b(?:AXIS|AX)\b/i.test(text);
}

function isAuxiliaryHeader(text: string): boolean {
  if (/\b(?:SPHERE|SPH|CYLINDER|CYL|AXIS|AX|ADD)\b/i.test(text) || /\d/.test(text)) return false;
  const terms = text.toUpperCase().match(/\b(?:PRISM|BASE|DEC|DECENTRATION|INSET|BC|VERTEX)\b/g) ?? [];
  return new Set(terms).size >= 2;
}

function tableWordEye(text: string): "od" | "os" | null {
  const eye = wordEye(text);
  if (eye) return eye;
  // Only used in the eye-label gutter of a confirmed optical table.
  // Never substitute these characters inside a numeric prescription cell.
  return /^(?:O5|QS)[.:]?$/i.test(text.trim()) ? "os" : null;
}

const isGridPunctuation = (text: string) => /^[\p{P}\p{S}\s]+$/u.test(text);

interface SpatialEyeGroup {
  eye: "od" | "os";
  labels: PrescriptionScanWord[];
  y: number;
  top: number;
  bottom: number;
}

interface SpatialTableLayout {
  headerWords: PrescriptionScanWord[];
  opticalHeaders: PrescriptionScanWord[];
  headerHeight: number;
  headerBottom: number;
  boundary: number;
  groups: SpatialEyeGroup[];
}

function columnBounds(layout: SpatialTableLayout, heading: PrescriptionScanWord): { left: number; right: number } {
  const headers = layout.headerWords.filter((word) => !isGridPunctuation(word.text));
  const index = headers.indexOf(heading);
  return {
    left: index > 0 ? (wordX(headers[index - 1]) + wordX(heading)) / 2 : heading.bbox.x0 - wordHeight(heading) * 2,
    right: headers[index + 1] ? (wordX(heading) + wordX(headers[index + 1])) / 2 : heading.bbox.x1 + wordHeight(heading) * 2,
  };
}

/** Geometry recognizes explicit labels, not an assumed first/right row order. */
function spatialLayouts(words: PrescriptionScanWord[]): {
  usable: PrescriptionScanWord[]; layouts: SpatialTableLayout[]; ambiguous: boolean; requiresAlignment: boolean; requiresRowReview: boolean;
} {
  const usable = words.filter((word) => word.text.trim() && Object.values(word.bbox).every(Number.isFinite)
    && word.bbox.x1 > word.bbox.x0 && word.bbox.y1 > word.bbox.y0);
  const sameBand = (anchor: PrescriptionScanWord) => usable.filter((word) =>
    Math.abs(wordY(word) - wordY(anchor)) <= Math.max(wordHeight(word), wordHeight(anchor)) * 0.7)
    .sort((a, b) => wordX(a) - wordX(b));
  const anchors = usable.filter((word) => wordColumnName(word.text) === "sphere" && (word.confidence ?? 100) >= 30);
  const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const usedHeaders = new Set<PrescriptionScanWord>();
  const layouts: SpatialTableLayout[] = [];
  const tiltedHeaderTops: number[] = [];
  let requiresAlignment = false;
  let requiresRowReview = false;
  for (const anchor of anchors) {
    if (usedHeaders.has(anchor)) continue;
    // A wider candidate search is ONLY for detecting/refusing tilt. Values
    // are still assigned using the narrow, horizontal header/row bands.
    const candidates = usable.filter((word) => wordColumnName(word.text) && (word.confidence ?? 100) >= 30
      && Math.abs(wordY(word) - wordY(anchor)) <= Math.max(wordHeight(word), wordHeight(anchor)) * 0.7 + Math.abs(wordX(word) - wordX(anchor)) * 0.18);
    const nearest = (field: keyof ScannedEyeValues, afterX: number) => candidates.filter((word) => wordColumnName(word.text) === field && wordX(word) > afterX)
      .sort((a, b) => Math.abs(wordY(a) - wordY(anchor)) - Math.abs(wordY(b) - wordY(anchor)))[0];
    const cylinder = nearest("cylinder", wordX(anchor));
    const axis = cylinder && nearest("axis", wordX(cylinder));
    if (!cylinder || !axis) continue;
    const core = [anchor, cylinder, axis];
    const headerCenter = median(core.map(wordY));
    const headerHeight = median(core.map(wordHeight));
    const credible = core.filter((word) => wordHeight(word) >= headerHeight * 0.6 && wordHeight(word) <= headerHeight * 1.4);
    const slopes: number[] = [];
    for (let first = 0; first < credible.length; first++) for (let second = first + 1; second < credible.length; second++) {
      const distance = wordX(credible[second]) - wordX(credible[first]);
      if (Math.abs(distance) > headerHeight * 4) slopes.push((wordY(credible[second]) - wordY(credible[first])) / distance);
    }
    const slope = slopes.length ? median(slopes) : 0;
    const tilted = Math.abs(slope) > 0.04;
    const isNumericArtifact = (word: PrescriptionScanWord) => /^[+\-\d.,]+$/.test(normalizeText(word.text).trim())
      && ((word.confidence ?? 100) < 30 || wordHeight(word) < headerHeight * 0.25);
    // One inflated word box must not drag the values row into the heading
    // band. Tiny/low-confidence numeric specks are not printed headings.
    const intercept = median(credible.map((word) => wordY(word) - slope * wordX(word)));
    const headerWords = usable.filter((word) => Math.abs(wordY(word) - (tilted ? intercept + slope * wordX(word) : headerCenter))
      <= Math.max(headerHeight, Math.min(wordHeight(word), headerHeight * 1.5)) * 0.6 && !isNumericArtifact(word) && !isGridPunctuation(word.text))
      .sort((a, b) => wordX(a) - wordX(b));
    const opticalHeaders = headerWords.filter((word) => wordColumnName(word.text) && (word.confidence ?? 100) >= 30);
    const fields = opticalHeaders.map((word) => wordColumnName(word.text));
    if (!["sphere", "cylinder", "axis"].every((field) => fields.includes(field as keyof ScannedEyeValues))
      || new Set(fields).size !== fields.length
      // A labelled values row is not a second table heading.
      || headerWords.some((word) => wordEye(word.text) || /^[+\-\d.,]+$/.test(normalizeText(word.text).trim()))) continue;
    opticalHeaders.forEach((word) => usedHeaders.add(word));
    if (tilted) {
      requiresAlignment = true;
      tiltedHeaderTops.push(Math.min(...headerWords.map((word) => word.bbox.y0)));
      continue;
    }
    layouts.push({
      headerWords, opticalHeaders, headerHeight,
      headerBottom: Math.min(Math.max(...headerWords.map((word) => word.bbox.y1)), headerCenter + headerHeight * 0.65),
      boundary: Number.POSITIVE_INFINITY, groups: [],
    });
  }

  const auxiliaryTops = usable.filter((word) => /\b(?:PRISM|BASE|DEC|INSET|BC|VERTEX)\b/i.test(word.text))
    .map((anchor) => sameBand(anchor)).filter((band) => isAuxiliaryHeader(band.map((word) => word.text).join(" ")))
    .map((band) => Math.min(...band.map((word) => word.bbox.y0)));
  const sectionTops = usable.filter((word) => /^(?:NOTES?|INSTRUCTIONS?|COMMENTS?|SAMPLE|ASSESSMENT|DIAGNOSIS|SIGNATURE)[.:]?$/i.test(word.text.trim()))
    .map((word) => word.bbox.y0);
  let ambiguous = layouts.length + tiltedHeaderTops.length > 1;
  for (const layout of layouts) {
    const nextTops = [...layouts.filter((other) => other !== layout).map((other) => Math.min(...other.headerWords.map((word) => word.bbox.y0))), ...tiltedHeaderTops, ...auxiliaryTops, ...sectionTops]
      .filter((top) => top > layout.headerBottom);
    layout.boundary = Math.min(...nextTops, Number.POSITIVE_INFINITY);
    const firstX = Math.min(...layout.opticalHeaders.map(wordX));
    const labels = usable.filter((word) => tableWordEye(word.text) && wordY(word) > layout.headerBottom && wordY(word) < layout.boundary
      && wordX(word) < firstX).sort((a, b) => wordY(a) - wordY(b));
    const groups: SpatialEyeGroup[] = [];
    for (const label of labels) {
      const eye = tableWordEye(label.text)!;
      const previous = groups.find((group) => group.eye === eye && Math.abs(group.y - wordY(label)) <= wordHeight(label)
        * (group.labels.some((item) => item.text.replace(/\W/g, "").toUpperCase() === label.text.replace(/\W/g, "").toUpperCase()) ? 0.6 : 1.5)
        && Math.abs(wordX(group.labels[0]) - wordX(label)) < wordHeight(label) * 4);
      if (previous) {
        previous.labels.push(label);
        previous.y = previous.labels.reduce((sum, word) => sum + wordY(word), 0) / previous.labels.length;
      } else groups.push({ eye, labels: [label], y: wordY(label), top: 0, bottom: 0 });
    }
    groups.sort((a, b) => a.y - b.y);
    for (let index = 0; index < groups.length; index++) {
      const group = groups[index];
      const rowHeight = Math.max(...group.labels.map(wordHeight), layout.headerHeight);
      const previous = groups[index - 1];
      const next = groups[index + 1];
      // Mirror the neighboring observed row spacing at the outside edges.
      // An oversized last-eye label must not extend the crop into a blank
      // OU/measurement row or the next table's rule. No eye is inferred.
      const topSpacing = previous ? (previous.y + group.y) / 2 : next ? group.y - (next.y - group.y) / 2 : 0;
      const bottomSpacing = next ? (group.y + next.y) / 2 : previous ? group.y + (group.y - previous.y) / 2 : Number.POSITIVE_INFINITY;
      group.top = Math.max(layout.headerBottom, group.y - rowHeight * 1.5, topSpacing);
      group.bottom = Math.min(layout.boundary, group.y + rowHeight * 1.5, bottomSpacing);
      const opticalGeometry = usable.filter((word) => wordY(word) > group.top && wordY(word) < group.bottom
        && !tableWordEye(word.text) && wordHeight(word) >= layout.headerHeight * 0.4 && wordHeight(word) <= layout.headerHeight * 1.5
        && layout.opticalHeaders.some((heading) => {
          const { left, right } = columnBounds(layout, heading);
          return wordX(word) > left && wordX(word) < right;
        }));
      // A label box can be shifted upward relative to its printed values.
      // Keep the full normal-sized glyphs already associated with this row
      // inside outside-edge crops. Their text/confidence affects recognition,
      // never this geometry; neighboring-row midpoints stay hard boundaries.
      if (opticalGeometry.length) {
        const margin = layout.headerHeight * 0.1;
        if (!previous) group.top = Math.max(layout.headerBottom, Math.min(group.top, ...opticalGeometry.map((word) => word.bbox.y0 - margin)));
        if (!next) group.bottom = Math.min(layout.boundary, Math.max(group.bottom, ...opticalGeometry.map((word) => word.bbox.y1 + margin)));
      }
      if (groups.length === 1) {
        // An inflated lone OS/OD box can span both printed eye rows. Never
        // borrow an unlabelled row's axis merely because only one label read.
        for (const heading of layout.opticalHeaders) {
          const { left, right } = columnBounds(layout, heading);
          const numericWords = usable.filter((word) => wordY(word) > group.top && wordY(word) < group.bottom
            && wordX(word) > left && wordX(word) < right && !layout.headerWords.includes(word) && !group.labels.includes(word)
            && wordHeight(word) >= layout.headerHeight * 0.35 && Boolean(normalizeText(word.text).match(numericToken)?.length))
            .sort((a, b) => wordY(a) - wordY(b));
          const clusters: PrescriptionScanWord[][] = [];
          for (const word of numericWords) {
            const previousCluster = clusters[clusters.length - 1];
            if (previousCluster && previousCluster.some((item) => Math.abs(wordY(item) - wordY(word)) <= Math.max(wordHeight(item), wordHeight(word)) * 0.65)) previousCluster.push(word);
            else clusters.push([word]);
          }
          if (clusters.length > 1) requiresRowReview = true;
        }
      }
      const hasValues = layout.opticalHeaders.some((heading) => {
        const { left, right } = columnBounds(layout, heading);
        return usable.some((word) => wordY(word) > group.top && wordY(word) < group.bottom && wordX(word) > left && wordX(word) < right
          && !group.labels.includes(word) && Boolean(normalizeText(word.text).match(numericToken)?.length));
      });
      if (hasValues) layout.groups.push(group);
    }
    if (layout.groups.filter((group) => group.eye === "od").length > 1 || layout.groups.filter((group) => group.eye === "os").length > 1) ambiguous = true;
  }
  return { usable, layouts, ambiguous, requiresAlignment, requiresRowReview };
}

/** Align values by printed columns instead of flattening blank cells away. */
function spatialRows(words: PrescriptionScanWord[], warnings: string[]): {
  rows: Record<"od" | "os", ScannedEyeValues[]>; hasTable: boolean; ambiguous: boolean; requiresAlignment: boolean; requiresRowReview: boolean;
} {
  const { usable, layouts, ambiguous, requiresAlignment, requiresRowReview } = spatialLayouts(words);
  const rows: Record<"od" | "os", ScannedEyeValues[]> = { od: [], os: [] };
  if (!ambiguous && !requiresAlignment && !requiresRowReview) for (const layout of layouts) {
    for (const group of layout.groups) {
      if (group.labels.some((label) => (label.confidence ?? 100) < 40 || !wordEye(label.text))) {
        warnings.push(`${group.eye.toUpperCase()}: the eye label was faint. Confirm right/left against the paper.`);
      }
      const values = blankEye();
      for (const heading of layout.opticalHeaders) {
        const field = wordColumnName(heading.text)!;
        const { left, right } = columnBounds(layout, heading);
        const cell = usable.filter((word) => wordY(word) > group.top && wordY(word) < group.bottom && wordX(word) > left && wordX(word) < right
          && !group.labels.includes(word));
        values[field] = readSpatialCell(cell, group.eye.toUpperCase(), field, warnings);
      }
      rows[group.eye].push(values);
    }
  }
  return { rows, hasTable: layouts.some((layout) => layout.groups.length > 0), ambiguous, requiresAlignment, requiresRowReview };
}

/** Local retry crops include only a uniquely identified optical table section. */
export function findPrescriptionScanRegions(words: PrescriptionScanWord[]): PrescriptionScanRegions | null {
  const { usable, layouts, ambiguous, requiresAlignment, requiresRowReview } = spatialLayouts(words);
  if (ambiguous || requiresAlignment || requiresRowReview || layouts.length !== 1 || !layouts[0].groups.length) return null;
  const layout = layouts[0];
  const labelWords = layout.groups.flatMap((group) => group.labels);
  const left = Math.max(0, Math.floor(Math.min(...layout.headerWords.map((word) => word.bbox.x0), ...labelWords.map((word) => word.bbox.x0))));
  const right = Math.ceil(Math.max(...layout.headerWords.map((word) => word.bbox.x1)));
  const top = Math.max(0, Math.floor(Math.min(...layout.headerWords.map((word) => word.bbox.y0))));
  const headerBottom = Math.ceil(layout.headerBottom);
  // Include unlabelled value rows for a table-level retry, but never guess
  // their eye. A later recognized auxiliary/notes section is a hard stop.
  const values = usable.filter((word) => wordY(word) > layout.headerBottom && wordY(word) < layout.boundary && wordX(word) > left && wordX(word) < right
    && Boolean(normalizeText(word.text).match(numericToken)?.length));
  const bottom = Math.ceil(Math.min(layout.boundary, Math.max(...values.map((word) => word.bbox.y1), ...layout.groups.map((group) => group.bottom))));
  const rows: PrescriptionScanRegions["rows"] = {};
  const cells: PrescriptionScanRegions["cells"] = {};
  for (const group of layout.groups) {
    const rowTop = Math.floor(group.top);
    rows[group.eye] = { left, top: rowTop, width: right - left, height: Math.ceil(group.bottom) - rowTop };
    const eyeCells: NonNullable<PrescriptionScanRegions["cells"]["od"]> = {};
    for (const heading of layout.opticalHeaders) {
      const bounds = columnBounds(layout, heading);
      const cellLeft = Math.max(left, Math.floor(bounds.left));
      const cellRight = Math.min(right, Math.ceil(bounds.right));
      if (cellRight > cellLeft) {
        eyeCells[wordColumnName(heading.text)!] = {
          left: cellLeft, top: rowTop, width: cellRight - cellLeft, height: Math.ceil(group.bottom) - rowTop,
        };
      }
    }
    cells[group.eye] = eyeCells;
  }
  return {
    header: { left, top, width: right - left, height: headerBottom - top },
    table: { left, top, width: right - left, height: bottom - top },
    rows, cells,
  };
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
      // Until plus-cylinder transposition is possible, none of this eye's
      // power/axis fields are in the canonical minus-cylinder notation.
      // Do not compare an unconverted axis against a later complete retry.
      next.sphere = null;
      next.cylinder = null;
      next.axis = null;
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
  let auxiliarySection = false;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (isOpticalHeader(line)) {
      auxiliarySection = false;
      if (!/\d/.test(line)) {
        // Keep extra MVE columns visible to the positional parser, which
        // must not flatten blanks and accidentally import Far/Near/height.
        columns = line.match(/\b(?:SPHERE|SPH|CYLINDER|CYL|AXIS|AX|ADD|PD|PRISM|BASE|BALANCE|SEG\s*HT|OC\s*HT|FAR|NEAR)\b/gi) ?? [];
        rawTableHeadings += 1;
        continue;
      }
    }
    if (isAuxiliaryHeader(line)) {
      auxiliarySection = true;
      columns = [];
      continue;
    }
    const rowMatch = line.match(eyeRowPattern);
    if (rowMatch) {
      // MVE prints another OD/OS pair below the optical table for prism,
      // decentration, inset, etc. Those values are not another spectacle Rx.
      if (auxiliarySection) continue;
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
  }

  const spatial = spatialRows(words, warnings);
  const rawAmbiguous = rawTableHeadings > 1 || credibleRawRows.od > 1 || credibleRawRows.os > 1;
  if (spatial.requiresAlignment) warnings.push("Photo appears tilted. Straighten the prescription table and scan again; no values from this reading were imported.");
  if (spatial.requiresRowReview) warnings.push("One eye label spans multiple possible numeric rows. Keep both printed eye labels visible and scan again, or enter the values manually.");
  const sharedAddLine = lines.filter((line, index) => /^OU\s+ADD\b/i.test(line) || (!claimedAddLines.has(index) && /^ADD\b/i.test(line)));
  const sharedAdd = sharedAddLine.length === 1 ? parseNumber(sharedAddLine[0].replace(/^(?:OU\s+)?ADD\b/i, "").match(numericToken)?.[0]) : null;
  const getEye = (eye: "od" | "os") => {
    const name = eye.toUpperCase();
    if (spatial.requiresAlignment || spatial.requiresRowReview) return blankEye();
    if (spatial.ambiguous || rawAmbiguous) {
      warnings.push(`${name}: multiple prescriptions or eye rows were found. Crop to one prescription and scan again.`);
      return blankEye();
    }
    // A readable OD row does not require a readable OS label (or vice
    // versa). A missing eye may use its own explicit text row, never the
    // other eye's geometry or an assumed top/bottom ordering.
    const eyeRows = spatial.rows[eye].length ? spatial.rows[eye] : rows[eye];
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
  const requiresRescan = spatial.ambiguous || rawAmbiguous || spatial.requiresRowReview || rows.od.length > 1 || rows.os.length > 1;
  return {
    od, os, pupillaryDistance: spatial.requiresAlignment || spatial.requiresRowReview ? null : parsePd(lines, warnings), warnings,
    ...(requiresRescan ? { requiresRescan: true } : {}),
    ...(spatial.requiresAlignment ? { requiresAlignment: true } : {}),
    ...(spatial.hasTable && !requiresRescan && !spatial.requiresAlignment ? { hasAlignedTable: true } : {}),
    ...(spatial.requiresRowReview ? { requiresRowReview: true } : {}),
  };
}

/** A retry can recover missing cells, but disagreements must be reviewed. */
export function combinePrescriptionScanPasses(first: PrescriptionScanResult, second: PrescriptionScanResult): PrescriptionScanResult {
  let warnings = [...first.warnings, ...second.warnings];
  if (first.requiresRescan || second.requiresRescan) {
    return {
      od: blankEye(), os: blankEye(), pupillaryDistance: null, warnings: [...new Set(warnings)], requiresRescan: true,
      ...(first.requiresRowReview || second.requiresRowReview ? { requiresRowReview: true } : {}),
    };
  }
  if (first.requiresAlignment || second.requiresAlignment) {
    const alignedEvidence = !first.requiresAlignment && first.hasAlignedTable || !second.requiresAlignment && second.hasAlignedTable;
    if (!alignedEvidence) {
      return { od: blankEye(), os: blankEye(), pupillaryDistance: null, warnings: [...new Set(warnings)], requiresAlignment: true };
    }
    warnings = warnings.filter((warning) => !warning.startsWith("Photo appears tilted."));
  }
  const mergeEye = (eye: "od" | "os") => {
    const merged = blankEye();
    for (const field of ["sphere", "cylinder", "axis", "add"] as const) {
      const a = first.requiresAlignment ? null : first[eye][field];
      const b = second.requiresAlignment ? null : second[eye][field];
      if (warnings.some((warning) => warning.startsWith(`${eye.toUpperCase()}: ${field} has duplicate or unclear`)
        || warning.startsWith(`${eye.toUpperCase()}: two readings disagree on ${field}.`))) {
        merged[field] = null;
      } else if (a !== null && b !== null && a !== b) {
        warnings.push(`${eye.toUpperCase()}: two readings disagree on ${field}. Select it manually from the paper.`);
        merged[field] = null;
      } else merged[field] = a ?? b;
    }
    if (merged.cylinder === 0) merged.axis = null;
    return merged;
  };
  const firstPd = first.requiresAlignment ? null : first.pupillaryDistance;
  const secondPd = second.requiresAlignment ? null : second.pupillaryDistance;
  let pd = warnings.some((warning) => warning.startsWith("Two readings disagree on PD.")) ? null : firstPd ?? secondPd;
  if (firstPd && secondPd && JSON.stringify(firstPd) !== JSON.stringify(secondPd)) {
    pd = null;
    warnings.push("Two readings disagree on PD. Enter it manually from the paper.");
  }
  return {
    od: mergeEye("od"), os: mergeEye("os"), pupillaryDistance: pd, warnings: [...new Set(warnings)],
    ...(!first.requiresAlignment && first.hasAlignedTable || !second.requiresAlignment && second.hasAlignedTable ? { hasAlignedTable: true } : {}),
  };
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

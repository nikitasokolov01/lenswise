/** Observed ruled-table geometry only. No OCR, clinical inference, storage, or network. */
export interface PrescriptionScanGrid {
  bbox: { left: number; top: number; width: number; height: number };
  /** Centers of observed vertical rules, in original-image pixels. */
  columns: number[];
  /** Centers of observed horizontal rules, in original-image pixels. */
  rows: number[];
  /** Observed stroke envelopes, aligned with centers; source-image pixels. */
  columnWidths?: number[];
  rowWidths?: number[];
}

interface Rule {
  position: number;
  start: number;
  end: number;
  thickness: number;
}

const MAX_SOURCE_SIDE = 4800;
const MAX_SOURCE_PIXELS = 8_000_000;
const MAX_SAMPLE_SIDE = 1600;
const MAX_RULES = 384;
const MAX_CANDIDATES = 6;
const MAX_BOUNDARIES = 24;
const MAX_GRID_GROUPS = 96;
const MAX_STROKE_WIDTH = 8;

function mergeHorizontalAliases(rules: Rule[]): Rule[] {
  const merged: Rule[] = [];
  for (const rule of rules) {
    let observed = { ...rule };
    for (let index = merged.length - 1; index >= 0; index--) {
      const previous = merged[index];
      const first = Math.min(previous.position - (previous.thickness - 1) / 2,
        observed.position - (observed.thickness - 1) / 2);
      const last = Math.max(previous.position + (previous.thickness - 1) / 2,
        observed.position + (observed.thickness - 1) / 2);
      const gap = observed.position - (observed.thickness - 1) / 2
        - (previous.position + (previous.thickness - 1) / 2);
      const overlap = Math.min(previous.end, observed.end) - Math.max(previous.start, observed.start);
      if (last - first + 1 > MAX_STROKE_WIDTH || gap > 1
        || overlap < Math.min(previous.end - previous.start, observed.end - observed.start) * 0.5) continue;
      // A photographed rule may split into overlapping runs on adjacent rows.
      // Keep the full observed ink envelope; never bridge a horizontal gap or
      // use this mask as recognition pixels. Merge every connected alias so
      // left/right fragments cannot remain duplicate boundaries of one rule.
      observed = { position: (first + last) / 2, thickness: last - first + 1,
        start: Math.min(previous.start, observed.start), end: Math.max(previous.end, observed.end) };
      merged.splice(index, 1);
    }
    merged.push(observed);
  }
  return merged;
}

function sampledGray(pixels: Uint8ClampedArray | Uint8Array, width: number, height: number) {
  const area = width * height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1
    || width > MAX_SOURCE_SIDE || height > MAX_SOURCE_SIDE || area > MAX_SOURCE_PIXELS
    || (pixels.length !== area && pixels.length !== area * 4)) {
    throw new RangeError("Grid detection requires bounded, matching RGBA or grayscale pixels.");
  }
  const channels = pixels.length === area ? 1 : 4;
  const scale = Math.min(1, MAX_SAMPLE_SIDE / Math.max(width, height));
  const sampleWidth = Math.max(1, Math.floor(width * scale));
  const sampleHeight = Math.max(1, Math.floor(height * scale));
  const gray = new Uint8Array(sampleWidth * sampleHeight);
  const histogram = new Uint32Array(256);
  // Minimum pooling preserves a one-pixel rule in a larger whole-page photo.
  // This mask is only for geometry; callers must OCR original image pixels.
  for (let y = 0; y < sampleHeight; y++) {
    const top = Math.floor(y * height / sampleHeight);
    const bottom = Math.floor((y + 1) * height / sampleHeight);
    for (let x = 0; x < sampleWidth; x++) {
      const left = Math.floor(x * width / sampleWidth);
      const right = Math.floor((x + 1) * width / sampleWidth);
      let value = 255;
      for (let sy = top; sy < bottom; sy++) for (let sx = left; sx < right; sx++) {
        const offset = (sy * width + sx) * channels;
        const alpha = channels === 4 ? pixels[offset + 3] / 255 : 1;
        const luminance = channels === 4
          ? pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722
          : pixels[offset];
        value = Math.min(value, Math.round(luminance * alpha + 255 * (1 - alpha)));
      }
      gray[y * sampleWidth + x] = value;
      histogram[value]++;
    }
  }
  let accumulated = 0;
  let background = 0;
  for (; background < 255; background++) {
    accumulated += histogram[background];
    if (accumulated >= gray.length * 0.9) break;
  }
  return { gray, width: sampleWidth, height: sampleHeight, background };
}

function rules(mask: Uint8Array, width: number, height: number, horizontal: boolean): Rule[] {
  const positions = horizontal ? height : width;
  const along = horizontal ? width : height;
  const minimumLength = horizontal ? 64 : 24;
  const raw: Rule[] = [];
  const hit = (position: number, point: number) => mask[horizontal ? position * width + point : point * width + position];
  for (let position = 0; position < positions; position++) {
    let start = -1;
    let last = -1;
    let hits = 0;
    const finish = () => {
      if (last - start + 1 >= minimumLength && hits / (last - start + 1) >= 0.88) {
        raw.push({ position, start, end: last + 1, thickness: 1 });
      }
      start = last = -1;
      hits = 0;
    };
    for (let point = 0; point < along; point++) {
      if (hit(position, point)) {
        if (start < 0) start = point;
        last = point;
        hits++;
      } else if (start >= 0 && point - last > 2) finish();
    }
    if (start >= 0) finish();
    // Pathological patterns are not worth expensive candidate combinations.
    if (raw.length > MAX_RULES * 6) return [];
  }
  const merged: Rule[] = [];
  for (const rule of raw) {
    let previous: Rule | undefined;
    for (let index = merged.length - 1; index >= 0; index--) {
      const candidate = merged[index];
      if (rule.position - (candidate.position + (candidate.thickness - 1) / 2) <= 1
        && Math.abs(candidate.start - rule.start) <= 3 && Math.abs(candidate.end - rule.end) <= 3) {
        previous = candidate;
        break;
      }
    }
    if (previous) {
      const first = previous.position - (previous.thickness - 1) / 2;
      previous.thickness = rule.position - first + 1;
      previous.position = (first + rule.position) / 2;
      previous.start = Math.min(previous.start, rule.start);
      previous.end = Math.max(previous.end, rule.end);
    } else merged.push({ ...rule });
  }
  // Broad dark stripes and solid blocks are not thin printed grid rules.
  const thin = merged.filter((rule) => rule.thickness <= MAX_STROKE_WIDTH);
  if (thin.length > MAX_RULES) return [];
  return horizontal ? mergeHorizontalAliases(thin) : thin;
}

/** Geometry-only local contrast: smooth illumination is not a printed rule. */
function ruleMask(gray: Uint8Array, width: number, height: number) {
  const mask = new Uint8Array(gray.length);
  const value = (x: number, y: number) => gray[Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const center = value(x, y);
    const up = Math.max(value(x - 4, y - 4), value(x + 4, y - 4), value(x - 4, y - 8), value(x + 4, y - 8));
    const down = Math.max(value(x - 4, y + 4), value(x + 4, y + 4), value(x - 4, y + 8), value(x + 4, y + 8));
    const left = Math.max(value(x - 4, y - 4), value(x - 4, y + 4), value(x - 8, y - 4), value(x - 8, y + 4));
    const right = Math.max(value(x + 4, y - 4), value(x + 4, y + 4), value(x + 8, y - 4), value(x + 8, y + 4));
    // Require brighter paper on BOTH sides of a horizontal or vertical stroke.
    // Unlike a global threshold this does not turn a shaded photo into a block.
    mask[y * width + x] = Math.max(Math.min(up, down), Math.min(left, right)) - center >= 8 ? 1 : 0;
  }
  return mask;
}

function observedColumns(vertical: Rule[], left: number, right: number, top: number, bottom: number) {
  // A slightly slanted/thick rule can appear as several adjacent long runs.
  // Merge only one narrow observed envelope with substantially overlapping ink.
  const tall = vertical.filter((rule) => rule.position >= left - 4 && rule.position <= right + 4
    && rule.end - rule.start >= (bottom - top) * 0.7).sort((a, b) => a.position - b.position);
  const merged: (Rule & { first: number; last: number })[] = [];
  for (const rule of tall) {
    const first = rule.position - (rule.thickness - 1) / 2;
    const last = rule.position + (rule.thickness - 1) / 2;
    const previous = merged[merged.length - 1];
    const envelopeEnd = previous ? Math.max(previous.last, last) : last;
    if (previous && envelopeEnd - previous.first + 1 <= MAX_STROKE_WIDTH
      && Math.min(previous.end, rule.end) - Math.max(previous.start, rule.start)
        >= Math.min(previous.end - previous.start, rule.end - rule.start) * 0.7) {
      previous.last = envelopeEnd;
      previous.position = (previous.first + envelopeEnd) / 2;
      previous.thickness = envelopeEnd - previous.first + 1;
      previous.start = Math.min(previous.start, rule.start);
      previous.end = Math.max(previous.end, rule.end);
    } else merged.push({ ...rule, first, last });
  }
  return merged.filter((rule) => rule.start <= top + 3 && rule.end - 1 >= bottom - 3);
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

function observedIntersection(mask: Uint8Array, width: number, height: number, x: number, y: number) {
  const cx = Math.round(x);
  const cy = Math.round(y);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const sx = cx + dx;
    const sy = cy + dy;
    if (sx >= 0 && sy >= 0 && sx < width && sy < height && mask[sy * width + sx]) return true;
  }
  return false;
}

/**
 * Finds small, near-axis-aligned ruled tables, including within larger pages.
 * Returns candidates, NOT identified prescriptions. At least three observed
 * rows and three observed columns are required; the caller must recognize the
 * headings/eye labels and validate every value separately. Borderless, skewed,
 * very faint, or uncertain grids are intentionally missed rather than guessed.
 */
export function findPrescriptionGrids(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
): PrescriptionScanGrid[] {
  const sampled = sampledGray(pixels, width, height);
  if (sampled.background < 150) return [];
  const sw = sampled.width;
  const sh = sampled.height;
  const mask = ruleMask(sampled.gray, sw, sh);
  const horizontal = rules(mask, sw, sh, true);
  const vertical = rules(mask, sw, sh, false);
  if (horizontal.length < 4 || vertical.length < 4) return [];
  const candidates: { grid: PrescriptionScanGrid; area: number }[] = [];
  const visited = new Set<string>();
  let checkedGroups = 0;
  anchors: for (const anchor of horizontal) {
    const tolerance = Math.max(3, (anchor.end - anchor.start) * 0.015);
    const matching = horizontal.filter((rule) => Math.abs(rule.start - anchor.start) <= tolerance
      && Math.abs(rule.end - anchor.end) <= tolerance).sort((a, b) => a.position - b.position);
    if (matching.length < 4) continue;
    const key = matching.map((rule) => `${rule.position}:${rule.start}:${rule.end}`).join(";");
    if (visited.has(key)) continue;
    visited.add(key);
    const gaps = matching.slice(1).map((rule, index) => rule.position - matching[index].position);
    const typicalGap = median(gaps);
    const groups: Rule[][] = [[]];
    matching.forEach((rule, index) => {
      if (index > 0 && gaps[index - 1] > Math.max(48, typicalGap * 3)) groups.push([]);
      groups[groups.length - 1].push(rule);
    });
    for (const rows of groups) {
      if (rows.length < 4 || rows.length > MAX_BOUNDARIES) continue;
      if (++checkedGroups > MAX_GRID_GROUPS) break anchors;
      const rowGaps = rows.slice(1).map((rule, index) => rule.position - rows[index].position);
      const minGap = Math.min(...rowGaps);
      if (minGap < 6 || Math.max(...rowGaps) / minGap > 3) continue;
      const top = rows[0].position;
      const bottom = rows[rows.length - 1].position;
      const left = median(rows.map((rule) => rule.start));
      const right = median(rows.map((rule) => rule.end - 1));
      const columns = observedColumns(vertical, left, right, top, bottom);
      // Horizontal rules may continue into a photo-clipped outer cell. Only
      // complete cells BETWEEN actually observed verticals are ever returned.
      if (columns.length < 4 || columns.length > MAX_BOUNDARIES) continue;
      const columnGaps = columns.slice(1).map((rule, index) => rule.position - columns[index].position);
      if (Math.min(...columnGaps) < 8) continue;
      // Check every observed boundary meets the opposing family of rules.
      if (rows.some((row) => columns.filter((column) => observedIntersection(mask, sw, sh, column.position, row.position)).length < Math.ceil(columns.length * 0.85))
        || columns.some((column) => rows.filter((row) => observedIntersection(mask, sw, sh, column.position, row.position)).length < Math.ceil(rows.length * 0.85))) continue;
      const xScale = width / sw;
      const yScale = height / sh;
      const xLines = columns.map((rule) => (rule.position + 0.5) * xScale - 0.5);
      const yLines = rows.map((rule) => (rule.position + 0.5) * yScale - 0.5);
      const bbox = {
        left: Math.max(0, Math.floor(xLines[0])), top: Math.max(0, Math.floor(yLines[0])),
        width: Math.min(width, Math.ceil(xLines[xLines.length - 1]) + 1) - Math.max(0, Math.floor(xLines[0])),
        height: Math.min(height, Math.ceil(yLines[yLines.length - 1]) + 1) - Math.max(0, Math.floor(yLines[0])),
      };
      // Min-pooling can include one additional sample block around a stroke.
      // Give callers the observed envelope plus that bounded uncertainty so
      // OCR crops can start inside inked rules without broadly trimming cells.
      const columnWidths = columns.map((rule) => (rule.thickness + (xScale > 1 ? 1 : 0)) * xScale);
      const rowWidths = rows.map((rule) => (rule.thickness + (yScale > 1 ? 1 : 0)) * yScale);
      const grid = { bbox, columns: xLines, rows: yLines, columnWidths, rowWidths };
      if (!candidates.some((candidate) => Math.abs(candidate.grid.bbox.left - bbox.left) <= xScale * 3
        && Math.abs(candidate.grid.bbox.top - bbox.top) <= yScale * 3
        && Math.abs(candidate.grid.bbox.width - bbox.width) <= xScale * 3
        && Math.abs(candidate.grid.bbox.height - bbox.height) <= yScale * 3)) {
        candidates.push({ grid, area: bbox.width * bbox.height });
      }
    }
  }
  return candidates.sort((a, b) => b.area - a.area).slice(0, MAX_CANDIDATES).map((candidate) => candidate.grid);
}

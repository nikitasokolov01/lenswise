import type { PrescriptionScanRegion, PrescriptionScanWord } from "@/lib/prescriptionScan";
import { normalizePrescriptionCellPixels } from "@/lib/prescriptionScanImage";

export interface PrescriptionTableCellImagePlan {
  source: PrescriptionScanRegion;
  width: number;
  height: number;
  padding: number;
  scaleX: number;
  scaleY: number;
}

/** Normalize cell size, not page size; keep the complete observed cell intact. */
export function planPrescriptionTableCellImage(
  area: PrescriptionScanRegion, sourceWidth: number, sourceHeight: number,
): PrescriptionTableCellImagePlan {
  if (![sourceWidth, sourceHeight, area.left, area.top, area.width, area.height].every(Number.isFinite)
    || sourceWidth <= 0 || sourceHeight <= 0 || sourceWidth > 4800 || sourceHeight > 4800
    || sourceWidth * sourceHeight > 8_000_000 || area.left < 0 || area.top < 0
    || area.width < 1 || area.height < 1 || area.left + area.width > sourceWidth || area.top + area.height > sourceHeight) {
    throw new RangeError("Invalid observed prescription cell.");
  }
  const padding = 12;
  const scale = Math.min(3, Math.max(0.5, 72 / area.height), 1200 / area.width, 240 / area.height);
  const contentWidth = Math.max(1, Math.round(area.width * scale));
  const contentHeight = Math.max(1, Math.round(area.height * scale));
  return {
    source: { ...area }, padding, width: contentWidth + padding * 2, height: contentHeight + padding * 2,
    scaleX: contentWidth / area.width, scaleY: contentHeight / area.height,
  };
}

/** Real OCR boxes are mapped back exactly; never clamp or invent missing ink. */
export function mapPrescriptionTableCellWords(words: PrescriptionScanWord[], plan: PrescriptionTableCellImagePlan): PrescriptionScanWord[] {
  if (![plan.scaleX, plan.scaleY].every((value) => Number.isFinite(value) && value > 0)) throw new RangeError("Invalid OCR cell scale.");
  const mapBox = (box: PrescriptionScanWord["bbox"]) => ({
    x0: (box.x0 - plan.padding) / plan.scaleX + plan.source.left,
    x1: (box.x1 - plan.padding) / plan.scaleX + plan.source.left,
    y0: (box.y0 - plan.padding) / plan.scaleY + plan.source.top,
    y1: (box.y1 - plan.padding) / plan.scaleY + plan.source.top,
  });
  return words.map((word) => ({
    ...word, bbox: mapBox(word.bbox),
    ...(word.symbols ? { symbols: word.symbols.map((symbol) => ({ ...symbol, bbox: mapBox(symbol.bbox) })) } : {}),
  }));
}

/** Original pixels only, mild contrast normalization, no digit whitelist or reconstruction. */
export function preparePrescriptionTableCell(source: HTMLCanvasElement, area: PrescriptionScanRegion) {
  const plan = planPrescriptionTableCellImage(area, source.width, source.height);
  const canvas = document.createElement("canvas");
  canvas.width = plan.width;
  canvas.height = plan.height;
  try {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Local table-cell preparation unavailable.");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, area.left, area.top, area.width, area.height, plan.padding, plan.padding,
      plan.width - plan.padding * 2, plan.height - plan.padding * 2);
    // Estimate paper/ink contrast from photographed pixels, not the artificial
    // white border. Including padding can leave shaded paper as a dark box
    // which OCR incorrectly includes in the word's geometry.
    const pixels = context.getImageData(plan.padding, plan.padding, plan.width - plan.padding * 2, plan.height - plan.padding * 2);
    pixels.data.set(normalizePrescriptionCellPixels(pixels.data, pixels.width, pixels.height, { sharpen: false }));
    context.putImageData(pixels, plan.padding, plan.padding);
    return { canvas, plan, dispose: () => { canvas.width = canvas.height = 0; } };
  } catch (error) {
    canvas.width = canvas.height = 0;
    throw error;
  }
}

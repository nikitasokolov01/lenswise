import { findPrescriptionScanRegions, type PrescriptionScanResult, type PrescriptionScanWord } from "@/lib/prescriptionScan";

export type PrescriptionScanDiagnosticPass = "initial" | "enhanced" | "final";
type Heading = "sphere" | "cylinder" | "axis" | "add";
type Blocker = "none" | "alignment" | "ambiguous_prescription" | "overlapping_rows";

export interface PrescriptionScanDiagnosticInput {
  pass: PrescriptionScanDiagnosticPass;
  sourceWidth: number;
  sourceHeight: number;
  ocrWidth: number;
  ocrHeight: number;
  fullCrop: boolean;
  words: PrescriptionScanWord[];
  result: PrescriptionScanResult;
}

/** Fixed metadata only. Never include recognized text, clinical values, or file details. */
export interface PrescriptionScanDiagnostics {
  pass: PrescriptionScanDiagnosticPass | "unknown";
  sourcePixels: { width: number | null; height: number | null };
  ocrPixels: { width: number | null; height: number | null };
  fullCrop: boolean;
  wordCount: number;
  standaloneHeadings: Record<Heading, number>;
  mergedHeadings: {
    candidates: number;
    withSymbols: number;
    minimumLetterConfidence: number | null;
    missingLetterConfidence: number;
    symbolTextMatches: number;
    validSymbolBoxes: number;
    orderedSymbolBoxes: number;
  };
  eyeLabels: { od: number; os: number };
  table: {
    aligned: boolean;
    regionsAvailable: boolean;
    anchors: { od: boolean; os: boolean };
    blocker: Blocker;
  };
}

const heading = (text: string): Heading | null => {
  const letters = text.replace(/[^a-z]/gi, "").toUpperCase();
  if (/^(?:SPHERE|SPH)$/.test(letters)) return "sphere";
  if (/^(?:CYLINDER|CYL)$/.test(letters)) return "cylinder";
  if (/^(?:AXIS|AX)$/.test(letters)) return "axis";
  if (/^(?:ADD|ADDITION)$/.test(letters)) return "add";
  return null;
};
const validBox = (box: PrescriptionScanWord["bbox"]) => box && Object.values(box).every(Number.isFinite)
  && box.x1 > box.x0 && box.y1 > box.y0;
const dimension = (value: number) => Number.isFinite(value) && value > 0 ? Math.round(value) : null;

/** Character facts are not parser acceptance/rejection verdicts. */
export function prescriptionScanDiagnostics(input: PrescriptionScanDiagnosticInput): PrescriptionScanDiagnostics {
  const words = input.words.filter((word) => typeof word.text === "string" && word.text.trim() && validBox(word.bbox));
  const standaloneHeadings: Record<Heading, number> = { sphere: 0, cylinder: 0, axis: 0, add: 0 };
  const merged: PrescriptionScanDiagnostics["mergedHeadings"] = {
    candidates: 0, withSymbols: 0, minimumLetterConfidence: null, missingLetterConfidence: 0,
    symbolTextMatches: 0, validSymbolBoxes: 0, orderedSymbolBoxes: 0,
  };
  const eyeLabels = { od: 0, os: 0 };
  for (const word of words) {
    const field = heading(word.text);
    if (field) standaloneHeadings[field]++;
    const eye = word.text.replace(/[^a-z0-9]/gi, "").toUpperCase();
    if (/^(?:OD|0D|RIGHT|RIGHTEYE|RE|R)$/.test(eye)) eyeLabels.od++;
    if (/^(?:OS|0S|O5|QS|LEFT|LEFTEYE|LE|L)$/.test(eye)) eyeLabels.os++;
    const terms = word.text.toUpperCase().match(/BALANCE|SPHERE|SPH|CYLINDER|CYL|AXIS|AX|ADDITION|ADD|PRISM|BASE|PD|FAR|NEAR|SEG\s*HT|OC\s*HT/g) ?? [];
    if (/\p{N}/u.test(word.text) || terms.length < 2 || !terms.some((term) => heading(term))) continue;
    merged.candidates++;
    const symbols = word.symbols?.filter((symbol) => !/^\s*$/.test(symbol.text));
    if (!symbols?.length) continue;
    merged.withSymbols++;
    if (symbols.map((symbol) => symbol.text).join("").toUpperCase() === word.text.replace(/\s/g, "").toUpperCase()) merged.symbolTextMatches++;
    for (const symbol of symbols.filter((item) => /^[a-z]$/i.test(item.text))) {
      const confidence = symbol.confidence;
      if (confidence === undefined || !Number.isFinite(confidence) || confidence < 0 || confidence > 100) merged.missingLetterConfidence++;
      else merged.minimumLetterConfidence = Math.min(merged.minimumLetterConfidence ?? 100, Math.floor(confidence));
    }
    if (symbols.every((symbol) => validBox(symbol.bbox) && symbol.bbox.x0 >= word.bbox.x0 && symbol.bbox.x1 <= word.bbox.x1
      && symbol.bbox.y0 >= word.bbox.y0 && symbol.bbox.y1 <= word.bbox.y1)) {
      merged.validSymbolBoxes++;
      if (symbols.every((symbol, index) => !index || symbol.bbox.x0 >= symbols[index - 1].bbox.x0
        && symbol.bbox.x0 + symbol.bbox.x1 >= symbols[index - 1].bbox.x0 + symbols[index - 1].bbox.x1)) merged.orderedSymbolBoxes++;
    }
  }
  const regions = findPrescriptionScanRegions(words);
  const blocker: Blocker = input.result.requiresRowReview ? "overlapping_rows" : input.result.requiresRescan ? "ambiguous_prescription"
    : input.result.requiresAlignment ? "alignment" : "none";
  return {
    pass: ["initial", "enhanced", "final"].includes(input.pass) ? input.pass : "unknown",
    sourcePixels: { width: dimension(input.sourceWidth), height: dimension(input.sourceHeight) },
    ocrPixels: { width: dimension(input.ocrWidth), height: dimension(input.ocrHeight) },
    fullCrop: input.fullCrop === true, wordCount: words.length, standaloneHeadings, mergedHeadings: merged, eyeLabels,
    table: { aligned: input.result.hasAlignedTable === true, regionsAvailable: Boolean(regions),
      anchors: { od: Boolean(regions?.rows.od), os: Boolean(regions?.rows.os) }, blocker },
  };
}

import { describe, expect, it } from "vitest";
import { parsePrescriptionScan, type PrescriptionScanResult, type PrescriptionScanWord } from "@/lib/prescriptionScan";
import { prescriptionScanDiagnostics, type PrescriptionScanDiagnosticInput } from "@/lib/prescriptionScanDiagnostics";

const word = (text: string, x: number, y: number): PrescriptionScanWord => ({
  text, confidence: 95, bbox: { x0: x, y0: y, x1: x + 60, y1: y + 18 },
});
const blank: PrescriptionScanResult = {
  od: { sphere: null, cylinder: null, axis: null, add: null },
  os: { sphere: null, cylinder: null, axis: null, add: null }, pupillaryDistance: null, warnings: [],
};
const input = (words: PrescriptionScanWord[] = [], result = blank): PrescriptionScanDiagnosticInput => ({
  pass: "initial", sourceWidth: 1280, sourceHeight: 240, ocrWidth: 1280, ocrHeight: 240, fullCrop: true, words, result,
});
const merged = (): PrescriptionScanWord => {
  const text = "Sphere|Cylinder|";
  const symbols = [...text].map((text, index) => ({ text, confidence: 98,
    bbox: { x0: 100 + index * 8, y0: 0, x1: 106 + index * 8, y1: 18 },
  }));
  return { text, confidence: 14, bbox: { x0: 100, y0: 0, x1: 106 + (text.length - 1) * 8, y1: 18 }, symbols };
};

describe("privacy-safe prescription scan diagnostics", () => {
  it("returns a fixed metadata whitelist without raw words, clinical values, warnings, or identity", () => {
    const words = [word("PRIVATE PATIENT NAME", 0, 200), word("01/01/1988", 100, 200), word("-12.75", 200, 200), word("patient.jpg", 300, 200)];
    const result: PrescriptionScanResult = { ...blank, od: { sphere: -12.75, cylinder: -3.5, axis: 137, add: 2.75 },
      warnings: ["PRIVATE PATIENT NAME"], pupillaryDistance: { mode: "binocular", binocular: "64.5", right: "", left: "" },
    };
    const summary = prescriptionScanDiagnostics({ ...input(words, result), privateFilename: "patient.jpg" } as PrescriptionScanDiagnosticInput);
    expect(Object.keys(summary).sort()).toEqual(["pass", "sourcePixels", "ocrPixels", "fullCrop", "wordCount", "standaloneHeadings", "mergedHeadings", "eyeLabels", "table"].sort());
    const serialized = JSON.stringify(summary);
    for (const privateText of ["PRIVATE", "patient.jpg", "01/01/1988", "-12.75", "-3.5", "137", "2.75", "64.5"]) expect(serialized).not.toContain(privateText);
    expect(summary.wordCount).toBe(4);
  });

  it("counts observed optical terms and explicit eye labels separately from table acceptance", () => {
    const words = [word("Sphere", 100, 0), word("Cylinder", 200, 0), word("Axis", 300, 0), word("Add", 400, 0),
      word("OD:", 0, 50), word("-2.00", 100, 50), word("-0.50", 200, 50), word("180", 300, 50),
      word("O.S.", 0, 100), word("+1.75", 100, 100), word("D.S.", 200, 100),
    ];
    const result = parsePrescriptionScan("Sphere Cylinder Axis Add", words);
    const summary = prescriptionScanDiagnostics(input(words, result));
    expect(summary.standaloneHeadings).toEqual({ sphere: 1, cylinder: 1, axis: 1, add: 1 });
    expect(summary.eyeLabels).toEqual({ od: 1, os: 1 });
    expect(summary.table).toEqual({ aligned: true, regionsAvailable: true, anchors: { od: true, os: true }, blocker: "none" });
  });

  it("reports merged character evidence without claiming the parser accepted it", () => {
    const summary = prescriptionScanDiagnostics(input([merged(), word("Axis", 300, 0)]));
    expect(summary.mergedHeadings).toEqual({ candidates: 1, withSymbols: 1, minimumLetterConfidence: 98,
      missingLetterConfidence: 0, symbolTextMatches: 1, validSymbolBoxes: 1, orderedSymbolBoxes: 1,
    });
    expect(summary.table.aligned).toBe(false);
    expect(summary.table.anchors).toEqual({ od: false, os: false });
    expect(summary.mergedHeadings).not.toHaveProperty("accepted");
  });

  it("distinguishes missing symbols and faint/missing confidence from valid geometry", () => {
    const heading = merged();
    delete heading.symbols;
    expect(prescriptionScanDiagnostics(input([heading])).mergedHeadings.withSymbols).toBe(0);
    const faint = merged();
    faint.symbols![0].confidence = 74.9;
    delete faint.symbols![1].confidence;
    const summary = prescriptionScanDiagnostics(input([faint]));
    expect(summary.mergedHeadings.minimumLetterConfidence).toBe(74);
    expect(summary.mergedHeadings.missingLetterConfidence).toBe(1);
    expect(summary.mergedHeadings.validSymbolBoxes).toBe(1);
  });

  it("distinguishes mismatched, out-of-word, and unordered symbol evidence", () => {
    const mismatch = merged();
    mismatch.symbols![0].text = "X";
    expect(prescriptionScanDiagnostics(input([mismatch])).mergedHeadings.symbolTextMatches).toBe(0);
    const outside = merged();
    outside.symbols![0].bbox.y0 = -1;
    expect(prescriptionScanDiagnostics(input([outside])).mergedHeadings.validSymbolBoxes).toBe(0);
    const unordered = merged();
    unordered.symbols![1].bbox.x0 = 100;
    unordered.symbols![1].bbox.x1 = 105;
    const summary = prescriptionScanDiagnostics(input([unordered]));
    expect(summary.mergedHeadings.validSymbolBoxes).toBe(1);
    expect(summary.mergedHeadings.orderedSymbolBoxes).toBe(0);
  });

  it.each([
    [{ requiresAlignment: true }, "alignment"],
    [{ requiresRescan: true }, "ambiguous_prescription"],
    [{ requiresRescan: true, requiresRowReview: true }, "overlapping_rows"],
  ] as const)("reports existing parser blockers only", (flags, blocker) => {
    expect(prescriptionScanDiagnostics(input([], { ...blank, ...flags })).table.blocker).toBe(blocker);
  });

  it("does not leak arbitrary pass strings or nonfinite dimensions", () => {
    const summary = prescriptionScanDiagnostics({ ...input(), pass: "PRIVATE NAME", sourceWidth: Number.NaN,
      sourceHeight: -1, ocrWidth: Number.POSITIVE_INFINITY, fullCrop: "PRIVATE NAME",
    } as unknown as PrescriptionScanDiagnosticInput);
    expect(summary.pass).toBe("unknown");
    expect(summary.sourcePixels).toEqual({ width: null, height: null });
    expect(summary.ocrPixels.width).toBeNull();
    expect(summary.fullCrop).toBe(false);
    expect(JSON.stringify(summary)).not.toContain("PRIVATE NAME");
  });

  it("does not mutate input words, symbol geometry, or parser result", () => {
    const data = input([merged(), word("OD", 0, 100)]);
    const before = JSON.stringify(data);
    prescriptionScanDiagnostics(data);
    expect(JSON.stringify(data)).toBe(before);
  });
});

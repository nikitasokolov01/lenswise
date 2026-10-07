import { describe, expect, it } from "vitest";
import { replacePrescriptionCellWords } from "@/lib/prescriptionScanRetry";
import type { PrescriptionScanWord } from "@/lib/prescriptionScan";

const word = (text: string, x: number, y: number, width = 20, height = 10): PrescriptionScanWord => ({ text, confidence: 90, bbox: { x0: x, x1: x + width, y0: y, y1: y + height } });
const placement = {
  area: { left: 80, top: 40, width: 120, height: 40 },
  header: { left: 0, top: 0, width: 300, height: 20 },
  left: 80, top: 40, padding: 12, scaleX: 2, scaleY: 2,
};

describe("focused prescription cell word placement", () => {
  it("maps padded OCR coordinates using independent actual resize ratios", () => {
    const [mapped] = replacePrescriptionCellWords([], [word("-1.25", 64, 32, 80, 40)], { ...placement, scaleY: 4 });
    expect(mapped.bbox).toEqual({ x0: 100, x1: 140, y0: 36, y1: 46 });
    expect(mapped.confidence).toBe(90);
  });
  it("maps a tight cell with padding before and after a proportional downsize", () => {
    const scaleX = 133 / 156;
    const scaleY = 61 / 72;
    const left = 100;
    const top = 50;
    const originalBox = { x0: 110, x1: 190, y0: 60, y1: 80 };
    const recognized: PrescriptionScanWord = {
      text: "-0.50", confidence: 53,
      bbox: {
        x0: 12 + (originalBox.x0 - left + 12) * scaleX,
        x1: 12 + (originalBox.x1 - left + 12) * scaleX,
        y0: 12 + (originalBox.y0 - top + 12) * scaleY,
        y1: 12 + (originalBox.y1 - top + 12) * scaleY,
      },
    };
    const [mapped] = replacePrescriptionCellWords([], [recognized], {
      ...placement, area: { left, top, width: 132, height: 48 },
      left: left - 12 - 12 / scaleX, top: top - 12 - 12 / scaleY,
      padding: 0, scaleX, scaleY,
    });
    for (const coordinate of ["x0", "x1", "y0", "y1"] as const) {
      expect(mapped.bbox[coordinate]).toBeCloseTo(originalBox[coordinate]);
    }
    expect(mapped.confidence).toBe(53);
  });
  it("preserves observed eye labels even when they overlap a cell rectangle", () => {
    const od = word("OD:", 80, 50, 50);
    const os = word("OS:", 80, 100, 50);
    const old = word("unclear", 140, 50);
    const result = replacePrescriptionCellWords([od, os, old], [word("+0.75", 144, 44)], placement);
    expect(result).toContain(od);
    expect(result).toContain(os);
    expect(result).not.toContain(old);
    expect(result.map((entry) => entry.text)).toEqual(["OD:", "OS:", "+0.75"]);
  });
  it("keeps original headings and neighboring cells unchanged", () => {
    const heading = word("Sphere", 100, 5);
    const cylinder = word("-0.50", 220, 50);
    const result = replacePrescriptionCellWords([heading, cylinder], [], { ...placement, area: { ...placement.area, top: 0, height: 80 } });
    expect(result).toEqual([heading, cylinder]);
  });
  it("keeps separate signs/decimal fragments without making character substitutions", () => {
    const result = replacePrescriptionCellWords([], [word("-", 44, 44), word("1.25", 84, 44), word("1.OO", 144, 44)], placement);
    expect(result.map((entry) => entry.text)).toEqual(["-", "1.25", "1.OO"]);
  });
  it("does not import recognized words centered outside the original cell", () => {
    expect(replacePrescriptionCellWords([], [word("999", 0, 0), word("888", 800, 44)], placement)).toEqual([]);
  });
  it.each([0, -1, NaN, Infinity])("rejects an invalid scale %s", (scale) => {
    expect(() => replacePrescriptionCellWords([], [], { ...placement, scaleX: scale })).toThrow(RangeError);
  });
});

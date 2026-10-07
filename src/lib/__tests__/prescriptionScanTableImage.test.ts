import { describe, expect, it, vi } from "vitest";
import { mapPrescriptionTableCellWords, planPrescriptionTableCellImage, preparePrescriptionTableCell } from "@/lib/prescriptionScanTableImage";

describe("prescription table cell image geometry", () => {
  it("preserves the entire actual cell and uses independently rounded scales", () => {
    const area = { left: 113, top: 28, width: 113, height: 53 };
    const plan = planPrescriptionTableCellImage(area, 1280, 239);
    expect(plan.source).toEqual(area);
    expect(plan.width).toBe(178);
    expect(plan.height).toBe(96);
    expect(plan.scaleX).toBe(154 / 113);
    expect(plan.scaleY).toBe(72 / 53);
  });
  it("maps actual word and character boxes without changing recognized text or confidence", () => {
    const plan = planPrescriptionTableCellImage({ left: 80, top: 90, width: 110, height: 55 }, 1000, 500);
    const bbox = { x0: 25, y0: 24, x1: 70, y1: 48 };
    const [word] = mapPrescriptionTableCellWords([{ text: "-0.50", confidence: 88, bbox, symbols: [{ text: "-", confidence: 90, bbox }] }], plan);
    expect(word.text).toBe("-0.50");
    expect(word.confidence).toBe(88);
    expect(word.bbox.x0).toBeCloseTo(80 + 13 / plan.scaleX);
    expect(word.bbox.y1).toBeCloseTo(90 + 36 / plan.scaleY);
    expect(word.symbols?.[0].bbox).toEqual(word.bbox);
  });
  it("does not clamp outside OCR evidence into a valid source cell", () => {
    const plan = planPrescriptionTableCellImage({ left: 80, top: 90, width: 110, height: 55 }, 1000, 500);
    const [word] = mapPrescriptionTableCellWords([{ text: "?", bbox: { x0: 0, y0: 0, x1: 5, y1: 5 } }], plan);
    expect(word.bbox.x0).toBeLessThan(80);
    expect(word.bbox.y0).toBeLessThan(90);
  });
  it("caps enlargement and allocations for both small and wide cells", () => {
    const small = planPrescriptionTableCellImage({ left: 0, top: 0, width: 40, height: 10 }, 400, 400);
    expect(small.scaleX).toBe(3);
    const wide = planPrescriptionTableCellImage({ left: 0, top: 0, width: 4000, height: 200 }, 4000, 200);
    expect(wide.width).toBeLessThanOrEqual(1224);
    expect(wide.height).toBeLessThanOrEqual(264);
  });
  it("normalizes photographed pixels without including the artificial white border", () => {
    const context = {
      fillStyle: "", imageSmoothingEnabled: false, imageSmoothingQuality: "low",
      fillRect: vi.fn(), drawImage: vi.fn(), putImageData: vi.fn(),
      getImageData: vi.fn((_x: number, _y: number, width: number, height: number) => {
        const data = new Uint8ClampedArray(width * height * 4);
        for (let index = 0; index < width * height; index++) {
          const tone = index < width * height * 0.1 ? 20 : 169;
          data.set([tone, tone, tone, 255], index * 4);
        }
        return { data, width, height };
      }),
    };
    const canvas = { width: 0, height: 0, getContext: () => context };
    vi.stubGlobal("document", { createElement: () => canvas });
    try {
      const cell = preparePrescriptionTableCell({ width: 1280, height: 239 } as HTMLCanvasElement,
        { left: 113, top: 28, width: 113, height: 53 });
      expect(context.getImageData).toHaveBeenCalledWith(12, 12, 154, 72);
      const [pixels, x, y] = context.putImageData.mock.calls[0];
      expect([x, y]).toEqual([12, 12]);
      expect(pixels.data[0]).toBeLessThan(5);
      expect(pixels.data[pixels.data.length - 4]).toBeGreaterThan(245);
      cell.dispose();
      expect([canvas.width, canvas.height]).toEqual([0, 0]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it.each([
    { left: -1, top: 0, width: 50, height: 40 },
    { left: 0, top: 0, width: 0, height: 40 },
    { left: 490, top: 0, width: 50, height: 40 },
    { left: 0, top: NaN, width: 50, height: 40 },
  ])("rejects invalid source regions: %j", (area) => {
    expect(() => planPrescriptionTableCellImage(area, 500, 500)).toThrow(RangeError);
  });
});

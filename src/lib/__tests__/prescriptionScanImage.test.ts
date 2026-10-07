import { afterEach, describe, expect, it, vi } from "vitest";
import {
  enhancePrescriptionPixels,
  cleanPrescriptionCellPixels,
  findPrescriptionCellInkBounds,
  normalizePrescriptionCellPixels,
  grayscalePrescriptionPixels,
  planPrescriptionScanImage,
  preparePrescriptionScanImages,
} from "@/lib/prescriptionScanImage";

const fullCrop = { left: 0, top: 0, width: 1, height: 1 };
function image(width: number, height: number, gray: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = gray;
    pixels[offset + 3] = 255;
  }
  return pixels;
}

describe("bounded prescription photo sizing", () => {
  it("enlarges a thin table proportionally without stretching its height", () => {
    const plan = planPrescriptionScanImage(3000, 2000, { left: 0.1, top: 0.2, width: 0.3, height: 0.05 });
    expect(plan.source).toEqual({ x: 300, y: 400, width: 900, height: 100 });
    expect(plan.width).toBe(1800);
    expect(plan.height).toBe(200);
  });

  it("aims known small text at 34 pixels high", () => {
    const plan = planPrescriptionScanImage(1000, 150, fullCrop, { estimatedWordHeight: 10 });
    expect(plan.width).toBe(3400);
    expect(plan.height).toBe(510);
    expect(plan.scale * 10).toBeCloseTo(34);
  });

  it("caps excessive enlargement even when the estimated glyph is tiny", () => {
    const plan = planPrescriptionScanImage(600, 100, fullCrop, { estimatedWordHeight: 2 });
    expect(plan.scale).toBe(4);
    expect(plan.width).toBe(2400);
  });

  it.each([[4032, 3024], [10000, 1000], [4800, 4800], [4097, 2929]])(
    "bounds %s × %s to 6 MP and a 4000-pixel side", (width, height) => {
      const plan = planPrescriptionScanImage(width, height, fullCrop);
      expect(plan.width * plan.height).toBeLessThanOrEqual(6_000_000);
      expect(Math.max(plan.width, plan.height)).toBeLessThanOrEqual(4000);
      expect(plan.width / plan.height).toBeCloseTo(width / height, 2);
    },
  );

  it("does not upscale already detailed text unnecessarily", () => {
    const plan = planPrescriptionScanImage(1600, 300, fullCrop, { estimatedWordHeight: 40 });
    expect(plan.scale).toBe(1);
  });

  it("preserves an already sizable photo until a glyph-height estimate is available", () => {
    expect(planPrescriptionScanImage(1700, 655, fullCrop).scale).toBe(1);
  });

  it("allows bounded minimum enlargement for a focused numeric cell", () => {
    const plan = planPrescriptionScanImage(180, 70, fullCrop, { estimatedWordHeight: 48, minimumScale: 1.7 });
    expect(plan.scale).toBe(1.7);
    expect(plan.width).toBe(306);
    expect(() => planPrescriptionScanImage(180, 70, fullCrop, { minimumScale: 5 })).toThrow(RangeError);
  });

  it("rejects invalid or empty crops rather than drawing another part of the paper", () => {
    for (const crop of [
      { ...fullCrop, width: 0 }, { ...fullCrop, left: -0.1 }, { ...fullCrop, top: 0.5 }, { ...fullCrop, height: NaN },
    ]) expect(() => planPrescriptionScanImage(1000, 1000, crop)).toThrow(RangeError);
    expect(() => planPrescriptionScanImage(0, 1000, fullCrop)).toThrow(RangeError);
    expect(() => planPrescriptionScanImage(Number.MAX_VALUE, 1000, fullCrop)).toThrow(RangeError);
  });
});

describe("prescription canvas preparation lifecycle", () => {
  const created: HTMLCanvasElement[] = [];
  const source = { width: 40, height: 20 } as HTMLCanvasElement;

  function setup(failContextOn = -1, failReadOn = -1) {
    vi.stubGlobal("document", { createElement: vi.fn(() => {
      const index = created.length;
      const canvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => index === failContextOn ? null : {
          fillStyle: "",
          fillRect: vi.fn(),
          drawImage: vi.fn(),
          putImageData: vi.fn(),
          getImageData: vi.fn((_x, _y, width, height) => {
            if (index === failReadOn) throw new Error("Image read failed");
            return { data: image(width, height, 200) };
          }),
        }),
      } as unknown as HTMLCanvasElement;
      created.push(canvas);
      return canvas;
    }) });
  }

  afterEach(() => {
    created.length = 0;
    vi.unstubAllGlobals();
  });

  it("creates the alternate lazily and caches it", () => {
    setup();
    const prepared = preparePrescriptionScanImages(source, fullCrop);
    expect(created).toHaveLength(1);
    expect(prepared.grayscale.width).toBe(80);
    expect(prepared.grayscale.height).toBe(40);
    const alternate = prepared.getEnhanced();
    expect(prepared.getEnhanced()).toBe(alternate);
    expect(created).toHaveLength(2);
    expect(alternate.width).toBe(80);
    prepared.dispose();
  });

  it("clears both helper canvases without changing the caller's original", () => {
    setup();
    const prepared = preparePrescriptionScanImages(source, fullCrop);
    const alternate = prepared.getEnhanced();
    prepared.dispose();
    expect(prepared.grayscale.width).toBe(0);
    expect(prepared.grayscale.height).toBe(0);
    expect(alternate.width).toBe(0);
    expect(alternate.height).toBe(0);
    expect(source).toEqual({ width: 40, height: 20 });
    expect(() => prepared.getEnhanced()).toThrow("closed");
    prepared.dispose();
  });

  it("cleans a failed initial preparation", () => {
    setup(-1, 0);
    expect(() => preparePrescriptionScanImages(source, fullCrop)).toThrow("Image read failed");
    expect(created[0].width).toBe(0);
    expect(created[0].height).toBe(0);
  });

  it("cleans a failed alternate while keeping grayscale available", () => {
    setup(1);
    const prepared = preparePrescriptionScanImages(source, fullCrop);
    expect(() => prepared.getEnhanced()).toThrow("enhancement");
    expect(created[1].width).toBe(0);
    expect(created[1].height).toBe(0);
    expect(prepared.grayscale.width).toBe(80);
    expect(prepared.getEnhanced().width).toBe(80);
    prepared.dispose();
  });
});

describe("nonbinary prescription pixel preparation", () => {
  it("keeps the source untouched and converts color/alpha onto white paper", () => {
    const source = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0]);
    const before = source.slice();
    const grayscale = grayscalePrescriptionPixels(source, 2, 1);
    expect(grayscale).toEqual(new Uint8ClampedArray([54, 54, 54, 255, 255, 255, 255, 255]));
    expect(source).toEqual(before);
  });

  it("leaves a flat midtone flat instead of forcing it to black or white", () => {
    const source = image(30, 30, 127);
    expect(enhancePrescriptionPixels(source, 30, 30)).toEqual(source);
  });

  it("preserves a one-pixel decimal dot and thin minus stroke", () => {
    const source = image(40, 20, 235);
    const ink = [[12, 10], [20, 10], [21, 10], [22, 10], [23, 10], [24, 10]];
    for (const [x, y] of ink) {
      const offset = (y * 40 + x) * 4;
      source[offset] = source[offset + 1] = source[offset + 2] = 120;
    }
    const enhanced = enhancePrescriptionPixels(source, 40, 20);
    for (const [x, y] of ink) expect(enhanced[(y * 40 + x) * 4]).toBeLessThanOrEqual(120);
    expect(enhanced[(10 * 40 + 15) * 4]).toBeGreaterThan(220);
    expect(source[(10 * 40 + 12) * 4]).toBe(120);
  });

  it("retains grayscale levels and caps enhancement changes", () => {
    const source = image(64, 10, 0);
    for (let y = 0; y < 10; y++) for (let x = 0; x < 64; x++) {
      const offset = (y * 64 + x) * 4;
      source[offset] = source[offset + 1] = source[offset + 2] = x * 4;
    }
    const enhanced = enhancePrescriptionPixels(source, 64, 10);
    const levels = new Set<number>();
    for (let offset = 0; offset < enhanced.length; offset += 4) {
      levels.add(enhanced[offset]);
      expect(Math.abs(enhanced[offset] - source[offset])).toBeLessThanOrEqual(20);
      expect(enhanced[offset]).toBe(enhanced[offset + 1]);
      expect(enhanced[offset + 1]).toBe(enhanced[offset + 2]);
      expect(enhanced[offset + 3]).toBe(255);
    }
    expect(levels.size).toBeGreaterThan(40);
  });

  it("supports tiny edge cases without invalid reads", () => {
    expect(enhancePrescriptionPixels(image(1, 1, 150), 1, 1)).toEqual(image(1, 1, 150));
    expect(enhancePrescriptionPixels(image(1, 5, 150), 1, 5)).toEqual(image(1, 5, 150));
  });

  it("rejects malformed pixel buffers and unbounded dimensions", () => {
    expect(() => enhancePrescriptionPixels(new Uint8ClampedArray(3), 1, 1)).toThrow(RangeError);
    expect(() => enhancePrescriptionPixels(new Uint8ClampedArray(), 4001, 1)).toThrow(RangeError);
    expect(() => enhancePrescriptionPixels(new Uint8ClampedArray(), 3000, 3000)).toThrow(RangeError);
  });
});

describe("conservative focused-cell grid cleanup", () => {
  const width = 140;
  const height = 90;
  const setGray = (pixels: Uint8ClampedArray, x: number, y: number, gray: number) => {
    const offset = (y * width + x) * 4;
    pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = gray;
  };

  it("removes light-gray straight borders from off-white paper", () => {
    const pixels = image(width, height, 239);
    for (let x = 0; x < width; x++) { setGray(pixels, x, 2, 218); setGray(pixels, x, 87, 190); }
    for (let y = 0; y < height; y++) { setGray(pixels, 2, y, 190); setGray(pixels, 137, y, 218); }
    const cleaned = cleanPrescriptionCellPixels(pixels, width, height);
    expect(cleaned[(2 * width + 60) * 4]).toBe(255);
    expect(cleaned[(87 * width + 60) * 4]).toBe(255);
    expect(cleaned[(45 * width + 2) * 4]).toBe(255);
    expect(cleaned[(45 * width + 137) * 4]).toBe(255);
    expect(cleaned[(45 * width + 60) * 4]).toBe(239);
    expect(pixels[(2 * width + 60) * 4]).toBe(218);
  });

  it("keeps short minus/plus strokes, decimal points, and interior digit stems", () => {
    const pixels = image(width, height, 239);
    for (let x = 0; x < width; x++) setGray(pixels, x, 3, 200);
    for (let x = 40; x <= 55; x++) setGray(pixels, x, 38, 70); // minus
    for (let x = 72; x <= 86; x++) setGray(pixels, x, 38, 70); // plus horizontal
    for (let y = 32; y <= 44; y++) setGray(pixels, 79, y, 70); // plus vertical
    setGray(pixels, 100, 52, 70); // decimal
    for (let y = 20; y <= 65; y++) setGray(pixels, 62, y, 70); // digit1
    const cleaned = cleanPrescriptionCellPixels(pixels, width, height);
    for (const [x, y] of [[45, 38], [79, 38], [79, 32], [100, 52], [62, 20], [62, 65]]) {
      expect(cleaned[(y * width + x) * 4]).toBe(70);
    }
    expect(cleaned[(3 * width + 60) * 4]).toBe(255);
  });

  it("uses an explicit white padding border without counting it as the rule span", () => {
    const pixels = image(width, height, 255);
    for (let y = 12; y < height - 12; y++) for (let x = 12; x < width - 12; x++) setGray(pixels, x, y, 238);
    for (let x = 12; x < width - 12; x++) setGray(pixels, x, 13, 208);
    for (let y = 12; y < height - 12; y++) setGray(pixels, 13, y, 208);
    const cleaned = cleanPrescriptionCellPixels(pixels, width, height, { padding: 12 });
    expect(cleaned[(13 * width + 60) * 4]).toBe(255);
    expect(cleaned[(45 * width + 13) * 4]).toBe(255);
    expect(cleaned[(45 * width + 60) * 4]).toBe(238);
  });

  it("tolerates small grain gaps and faint/translucent gray rules", () => {
    const pixels = image(width, height, 240);
    for (let x = 0; x < width; x++) if (x % 30 !== 0) setGray(pixels, x, 4, 233);
    const cleaned = cleanPrescriptionCellPixels(pixels, width, height);
    expect(cleaned[(4 * width + 65) * 4]).toBe(255);
    expect(cleaned[(4 * width + 60) * 4]).toBe(240);
    expect(cleaned[(40 * width + 65) * 4]).toBe(240);
  });

  it("does not erase thick bands, interior horizontal lines, or short edge marks", () => {
    const pixels = image(width, height, 239);
    for (let y = 3; y <= 7; y++) for (let x = 0; x < width; x++) setGray(pixels, x, y, 180);
    for (let x = 0; x < width; x++) setGray(pixels, x, 45, 180);
    for (let x = 5; x < 35; x++) setGray(pixels, x, 15, 180);
    const cleaned = cleanPrescriptionCellPixels(pixels, width, height);
    expect(cleaned[(5 * width + 60) * 4]).toBe(180);
    expect(cleaned[(45 * width + 60) * 4]).toBe(180);
    expect(cleaned[(15 * width + 20) * 4]).toBe(180);
  });

  it("preserves materially darker ink where it crosses a gray border", () => {
    const pixels = image(width, height, 239);
    for (let x = 0; x < width; x++) setGray(pixels, x, 10, 200);
    setGray(pixels, 50, 10, 50);
    const cleaned = cleanPrescriptionCellPixels(pixels, width, height);
    expect(cleaned[(10 * width + 60) * 4]).toBe(255);
    expect(cleaned[(10 * width + 50) * 4]).toBe(50);
  });

  it("rejects invalid padding and preserves a tiny image unchanged", () => {
    expect(() => cleanPrescriptionCellPixels(image(width, height, 239), width, height, { padding: 45 })).toThrow(RangeError);
    expect(() => cleanPrescriptionCellPixels(image(width, height, 239), width, height, { padding: -1 })).toThrow(RangeError);
    expect(cleanPrescriptionCellPixels(image(10, 10, 239), 10, 10)).toEqual(image(10, 10, 239));
  });
});

describe("geometry-only focused-cell ink bounds", () => {
  const width = 160;
  const height = 100;
  const setGray = (pixels: Uint8ClampedArray, x: number, y: number, gray: number) => {
    const offset = (y * width + x) * 4;
    pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = gray;
  };
  function glyph(pixels: Uint8ClampedArray) {
    for (let y = 30; y < 65; y++) for (let x = 70; x < 80; x++) setGray(pixels, x, y, 60);
  }

  it("excludes light grid geometry while retaining faint signs and decimal points", () => {
    const pixels = image(width, height, 239);
    for (let x = 0; x < width; x++) { setGray(pixels, x, 2, 190); setGray(pixels, x, 97, 190); }
    for (let y = 0; y < height; y++) { setGray(pixels, 2, y, 190); setGray(pixels, 157, y, 190); }
    glyph(pixels);
    for (let x = 34; x <= 48; x++) setGray(pixels, x, 45, 175);
    for (let y = 38; y <= 52; y++) setGray(pixels, 41, y, 175);
    setGray(pixels, 112, 65, 175);
    const before = pixels.slice();
    expect(findPrescriptionCellInkBounds(pixels, width, height)).toEqual({ left: 28, top: 24, width: 91, height: 48 });
    expect(pixels).toEqual(before);
  });

  it("excludes a gently slanted thin near-edge rule without touching the original pixels", () => {
    const pixels = image(width, height, 239);
    for (let x = 0; x < width; x++) setGray(pixels, x, 2 + Math.floor(x / 40), 180);
    glyph(pixels);
    expect(findPrescriptionCellInkBounds(pixels, width, height)).toEqual({ left: 64, top: 24, width: 22, height: 47 });
    expect(pixels[(2 * width + 10) * 4]).toBe(180);
  });

  it("does not clip a full-height weak rule into a short text-band component", () => {
    const pixels = image(width, height, 239);
    glyph(pixels);
    for (let y = 0; y < height; y++) setGray(pixels, 154, y, 190);
    expect(findPrescriptionCellInkBounds(pixels, width, height)).toEqual({ left: 64, top: 24, width: 22, height: 47 });
  });

  it("does not mistake a shorter near-edge digit stem for a full-height grid", () => {
    const pixels = image(width, height, 239);
    for (let y = 25; y < 75; y++) setGray(pixels, 10, y, 70);
    expect(findPrescriptionCellInkBounds(pixels, width, height)).toEqual({ left: 4, top: 19, width: 13, height: 62 });
  });

  it("falls back when strong printed ink already touches the observed cell boundary", () => {
    const pixels = image(width, height, 239);
    for (let y = 30; y < 65; y++) for (let x = 0; x < 8; x++) setGray(pixels, x, y, 60);
    expect(findPrescriptionCellInkBounds(pixels, width, height)).toBeNull();
  });

  it.each([0, 12])("does not crop a faint near-edge minus with %s pixels of padding", (padding) => {
    const cellWidth = 200;
    const cellHeight = 80;
    const pixels = image(cellWidth, cellHeight, 255);
    for (let y = padding; y < cellHeight - padding; y++) for (let x = padding; x < cellWidth - padding; x++) {
      const offset = (y * cellWidth + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 245;
    }
    for (let y = 30; y < 60; y++) for (let x = 70; x < 110; x++) {
      const offset = (y * cellWidth + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 60;
    }
    for (let y = 40; y < 43; y++) for (let x = padding + 1; x < padding + 19; x++) {
      const offset = (y * cellWidth + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 160;
    }
    expect(findPrescriptionCellInkBounds(pixels, cellWidth, cellHeight, { padding })).toBeNull();
  });

  it("falls back if a rule is connected to interior glyph ink", () => {
    const pixels = image(width, height, 239);
    for (let x = 0; x < width; x++) { setGray(pixels, x, 2, 80); setGray(pixels, x, 97, 80); }
    for (let y = 0; y < height; y++) { setGray(pixels, 2, y, 80); setGray(pixels, 157, y, 80); }
    glyph(pixels);
    for (let x = 2; x <= 70; x++) setGray(pixels, x, 35, 80);
    expect(findPrescriptionCellInkBounds(pixels, width, height)).toBeNull();
  });

  it("ignores explicit white padding and clamps margins inside the observed cell", () => {
    const pixels = image(width, height, 255);
    for (let y = 12; y < height - 12; y++) for (let x = 12; x < width - 12; x++) setGray(pixels, x, y, 230);
    glyph(pixels);
    expect(findPrescriptionCellInkBounds(pixels, width, height, { padding: 12, margin: 6 }))
      .toEqual({ left: 64, top: 24, width: 22, height: 47 });
  });

  it("returns null for no dark anchor, a dark page, or uncertain full-cell foreground", () => {
    expect(findPrescriptionCellInkBounds(image(width, height, 239), width, height)).toBeNull();
    expect(findPrescriptionCellInkBounds(image(width, height, 100), width, height)).toBeNull();
    const faint = image(width, height, 239);
    for (let y = 30; y < 65; y++) for (let x = 70; x < 80; x++) setGray(faint, x, y, 160);
    expect(findPrescriptionCellInkBounds(faint, width, height)).toBeNull();
    const full = image(width, height, 80);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x += 2) setGray(full, x, y, 239);
    expect(findPrescriptionCellInkBounds(full, width, height)).toBeNull();
  });

  it("does not turn ordinary off-white grain into a character or erase a short minus", () => {
    const pixels = image(width, height, 239);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) setGray(pixels, x, y, 236 + (x + y) % 7);
    glyph(pixels);
    for (let x = 32; x < 50; x++) setGray(pixels, x, 48, 185);
    const bounds = findPrescriptionCellInkBounds(pixels, width, height)!;
    expect(bounds.left).toBe(26);
    expect(bounds.left + bounds.width).toBe(86);
  });

  it("rejects invalid geometry options", () => {
    expect(() => findPrescriptionCellInkBounds(image(width, height, 239), width, height, { padding: 50 })).toThrow(RangeError);
    expect(() => findPrescriptionCellInkBounds(image(width, height, 239), width, height, { margin: -1 })).toThrow(RangeError);
  });
});

describe("nonbinary focused-cell normalization", () => {
  it("keeps blank and near-flat paper stable", () => {
    expect(normalizePrescriptionCellPixels(image(30, 20, 227), 30, 20)).toEqual(image(30, 20, 227));
    const grain = image(30, 20, 227);
    for (let offset = 0; offset < grain.length; offset += 4) {
      grain[offset] = grain[offset + 1] = grain[offset + 2] = 225 + (offset / 4) % 5;
    }
    expect(normalizePrescriptionCellPixels(grain, 30, 20)).toEqual(grain);
  });

  it("stretches grayscale contrast without reducing a gradient to black/white", () => {
    const pixels = image(128, 8, 0);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 128; x++) {
      const offset = (y * 128 + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 100 + x;
    }
    const before = pixels.slice();
    const normalized = normalizePrescriptionCellPixels(pixels, 128, 8);
    const levels = new Set<number>();
    for (let offset = 0; offset < normalized.length; offset += 4) {
      levels.add(normalized[offset]);
      expect(normalized[offset]).toBe(normalized[offset + 1]);
      expect(normalized[offset + 1]).toBe(normalized[offset + 2]);
      expect(normalized[offset + 3]).toBe(255);
    }
    expect(levels.size).toBeGreaterThan(100);
    expect(normalized[0]).toBeLessThanOrEqual(5);
    expect(normalized[(127 * 4)]).toBeGreaterThanOrEqual(250);
    expect(pixels).toEqual(before);
  });

  it("allows contrast-only benchmarking without changing the source", () => {
    const pixels = image(100, 10, 230);
    for (let y = 0; y < 10; y++) for (let x = 40; x < 60; x++) {
      const offset = (y * 100 + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 100 + x - 40;
    }
    const before = pixels.slice();
    const normalized = normalizePrescriptionCellPixels(pixels, 100, 10, { sharpen: false });
    expect(normalized[(50 * 4)]).toBe(26); // Perceptual L* stretch, not a byte-gray stretch.
    expect(normalized[(10 * 4)]).toBe(255);
    expect(pixels).toEqual(before);
  });

  it("keeps the perceptual contrast-only curve monotonic and clamped", () => {
    const pixels = image(256, 5, 0);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 256; x++) {
      const offset = (y * 256 + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = x;
    }
    const normalized = normalizePrescriptionCellPixels(pixels, 256, 5, { sharpen: false });
    for (let x = 1; x < 256; x++) expect(normalized[x * 4]).toBeGreaterThanOrEqual(normalized[(x - 1) * 4]);
    expect(normalized[0]).toBe(0);
    expect(normalized[255 * 4]).toBe(255);
  });

  it("preserves isolated decimal dots and short minus/plus strokes", () => {
    const pixels = image(80, 50, 235);
    const ink: [number, number][] = [];
    for (let y = 10; y < 38; y++) for (let x = 32; x < 37; x++) ink.push([x, y]);
    for (let x = 10; x <= 24; x++) ink.push([x, 24]);
    for (let x = 50; x <= 64; x++) ink.push([x, 24]);
    for (let y = 18; y <= 30; y++) ink.push([57, y]);
    ink.push([71, 36]);
    for (const [x, y] of ink) {
      const offset = (y * 80 + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 120;
    }
    const normalized = normalizePrescriptionCellPixels(pixels, 80, 50);
    for (const [x, y] of ink) expect(normalized[(y * 80 + x) * 4]).toBeLessThan(120);
    expect(normalized[(24 * 80 + 27) * 4]).toBeGreaterThan(220);
    expect(normalized[(36 * 80 + 69) * 4]).toBeGreaterThan(220);
  });

  it("does not amplify one isolated dark speck in otherwise blank paper", () => {
    const pixels = image(100, 60, 230);
    pixels[(30 * 100 + 50) * 4] = pixels[(30 * 100 + 50) * 4 + 1] = pixels[(30 * 100 + 50) * 4 + 2] = 100;
    expect(normalizePrescriptionCellPixels(pixels, 100, 60)).toEqual(pixels);
  });

  it("composites transparent color onto white and supports a tiny cell", () => {
    expect(normalizePrescriptionCellPixels(new Uint8ClampedArray([0, 0, 0, 0]), 1, 1))
      .toEqual(new Uint8ClampedArray([255, 255, 255, 255]));
    expect(normalizePrescriptionCellPixels(image(1, 5, 150), 1, 5)).toEqual(image(1, 5, 150));
  });

  it("rejects malformed or unbounded input", () => {
    expect(() => normalizePrescriptionCellPixels(new Uint8ClampedArray(3), 1, 1)).toThrow(RangeError);
    expect(() => normalizePrescriptionCellPixels(new Uint8ClampedArray(), 4001, 1)).toThrow(RangeError);
  });
});

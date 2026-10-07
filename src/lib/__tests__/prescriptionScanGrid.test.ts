import { describe, expect, it } from "vitest";
import { findPrescriptionGrids } from "@/lib/prescriptionScanGrid";

function page(width: number, height: number, tone = 250) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = tone;
    pixels[offset + 3] = 255;
  }
  return pixels;
}

function point(pixels: Uint8ClampedArray, width: number, x: number, y: number, tone = 180) {
  const offset = (y * width + x) * 4;
  pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = tone;
}

function grid(pixels: Uint8ClampedArray, width: number, columns: number[], rows: number[], tone = 180, thickness = 1) {
  for (const y of rows) for (let x = columns[0]; x <= columns[columns.length - 1]; x++) {
    for (let delta = 0; delta < thickness; delta++) point(pixels, width, x, y + delta, tone);
  }
  for (const x of columns) for (let y = rows[0]; y <= rows[rows.length - 1]; y++) {
    for (let delta = 0; delta < thickness; delta++) point(pixels, width, x + delta, y, tone);
  }
}

describe("bounded observed prescription grid geometry", () => {
  it("returns exact observed lines without assigning eye or column meanings", () => {
    const pixels = page(640, 300);
    const columns = [30, 110, 230, 350, 470, 590];
    const rows = [40, 100, 160, 220];
    grid(pixels, 640, columns, rows);
    const found = findPrescriptionGrids(pixels, 640, 300);
    expect(found).toHaveLength(1);
    expect(found[0]).toEqual({ bbox: { left: 30, top: 40, width: 561, height: 181 }, columns, rows,
      columnWidths: [1, 1, 1, 1, 1, 1], rowWidths: [1, 1, 1, 1] });
    expect(Object.keys(found[0]).sort()).toEqual(["bbox", "columnWidths", "columns", "rowWidths", "rows"]);
  });

  it("retains a small table inside a much larger photo and maps source coordinates", () => {
    const pixels = page(2400, 3200);
    const columns = [420, 480, 600, 720, 840];
    const rows = [1200, 1240, 1280, 1320];
    grid(pixels, 2400, columns, rows, 190);
    const found = findPrescriptionGrids(pixels, 2400, 3200);
    expect(found).toHaveLength(1);
    found[0].columns.forEach((value, index) => expect(Math.abs(value - columns[index])).toBeLessThanOrEqual(1));
    found[0].rows.forEach((value, index) => expect(Math.abs(value - rows[index])).toBeLessThanOrEqual(1));
    expect(found[0].bbox.width).toBeGreaterThanOrEqual(420);
    expect(found[0].bbox.height).toBeGreaterThanOrEqual(120);
    expect(found[0].columnWidths).toEqual([4, 4, 4, 4, 4]);
    expect(found[0].rowWidths).toEqual([4, 4, 4, 4]);
  });

  it("merges thin multi-pixel rules into one observed boundary", () => {
    const pixels = page(700, 320);
    grid(pixels, 700, [25, 125, 225, 425, 625], [35, 105, 175, 245], 155, 3);
    const found = findPrescriptionGrids(pixels, 700, 320);
    expect(found).toHaveLength(1);
    expect(found[0].columns).toEqual([26, 126, 226, 426, 626]);
    expect(found[0].rows).toEqual([36, 106, 176, 246]);
    expect(found[0].columnWidths).toEqual([3, 3, 3, 3, 3]);
    expect(found[0].rowWidths).toEqual([3, 3, 3, 3]);
  });

  it("supports grayscale input and transparent paper without treating alpha as ink", () => {
    const pixels = page(400, 220);
    grid(pixels, 400, [25, 95, 185, 285, 365], [30, 75, 120, 165], 190);
    const gray = new Uint8Array(400 * 220);
    for (let index = 0; index < gray.length; index++) gray[index] = pixels[index * 4];
    expect(findPrescriptionGrids(gray, 400, 220)).toEqual(findPrescriptionGrids(pixels, 400, 220));
    const transparent = new Uint8ClampedArray(pixels.length);
    expect(findPrescriptionGrids(transparent, 400, 220)).toEqual([]);
  });

  it("can find separate tables with the same width and a large intervening gap", () => {
    const pixels = page(650, 620);
    const columns = [25, 135, 245, 455, 605];
    grid(pixels, 650, columns, [20, 65, 110, 155]);
    grid(pixels, 650, columns, [425, 470, 515, 560]);
    const found = findPrescriptionGrids(pixels, 650, 620);
    expect(found).toHaveLength(2);
    expect(found.map((candidate) => candidate.rows[0]).sort((a, b) => a - b)).toEqual([20, 425]);
  });

  it("preserves source pixels", () => {
    const pixels = page(400, 220);
    grid(pixels, 400, [25, 95, 185, 285, 365], [30, 75, 120, 165]);
    const before = pixels.slice();
    findPrescriptionGrids(pixels, 400, 220);
    expect(pixels).toEqual(before);
  });

  it("tolerates isolated small gaps in printed rules", () => {
    const pixels = page(640, 300);
    const columns = [30, 110, 230, 350, 470, 590];
    const rows = [40, 100, 160, 220];
    grid(pixels, 640, columns, rows);
    for (const y of rows) for (let x = 55; x < 590; x += 41) point(pixels, 640, x, y, 250);
    for (const x of columns) for (let y = 58; y < 220; y += 37) point(pixels, 640, x, y, 250);
    expect(findPrescriptionGrids(pixels, 640, 300)).toHaveLength(1);
  });

  it("caps returned candidates without guessing which observed table is the Rx", () => {
    const pixels = page(650, 1400);
    for (let index = 0; index < 7; index++) {
      const top = 20 + index * 190;
      grid(pixels, 650, [25, 135, 245, 455, 605], [top, top + 24, top + 48, top + 72]);
    }
    expect(findPrescriptionGrids(pixels, 650, 1400)).toHaveLength(6);
  });

  it("rejects blank paper, random speckles, a page border, and parallel underlines", () => {
    const pixels = page(640, 360);
    expect(findPrescriptionGrids(pixels, 640, 360)).toEqual([]);
    let seed = 19;
    for (let index = 0; index < 4000; index++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const x = seed % 640;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      point(pixels, 640, x, seed % 360, 80);
    }
    expect(findPrescriptionGrids(pixels, 640, 360)).toEqual([]);
    const bordered = page(640, 360);
    grid(bordered, 640, [5, 634], [5, 354]);
    expect(findPrescriptionGrids(bordered, 640, 360)).toEqual([]);
    const underlines = page(640, 360);
    for (const y of [30, 80, 130, 180]) for (let x = 20; x < 620; x++) point(underlines, 640, x, y, 80);
    expect(findPrescriptionGrids(underlines, 640, 360)).toEqual([]);
  });

  it("drops an incomplete outer cell rather than inventing a boundary", () => {
    const open = page(600, 300);
    grid(open, 600, [25, 125, 225, 325, 525], [30, 90, 150, 210]);
    for (let y = 31; y < 210; y++) point(open, 600, 525, y, 250);
    expect(findPrescriptionGrids(open, 600, 300)).toEqual([{ bbox: { left: 25, top: 30, width: 301, height: 181 },
      columns: [25, 125, 225, 325], rows: [30, 90, 150, 210], columnWidths: [1, 1, 1, 1], rowWidths: [1, 1, 1, 1] }]);
    for (let y = 31; y < 210; y++) point(open, 600, 325, y, 250);
    expect(findPrescriptionGrids(open, 600, 300)).toEqual([]);
  });

  it("rejects irregular row dividers and broad dark stripes", () => {
    const irregular = page(600, 300);
    grid(irregular, 600, [25, 125, 225, 325, 525], [30, 37, 170, 210]);
    expect(findPrescriptionGrids(irregular, 600, 300)).toEqual([]);
    const thick = page(600, 300);
    grid(thick, 600, [25, 125, 225, 325, 525], [30, 90, 150, 210], 20, 9);
    expect(findPrescriptionGrids(thick, 600, 300)).toEqual([]);
  });

  it("finds low-contrast rules on shaded paper without thresholding the page dark", () => {
    const width = 720;
    const height = 340;
    const pixels = page(width, height);
    const paper = (x: number, y: number) => Math.round(152 + 30 * x / width + 5 * y / height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) point(pixels, width, x, y, paper(x, y));
    const columns = [40, 140, 240, 360, 480, 660];
    const rows = [50, 115, 180, 245];
    for (const y of rows) for (let x = columns[0]; x <= 719; x++) point(pixels, width, x, y, paper(x, y) - 14);
    for (const x of columns) for (let y = rows[0]; y <= rows[rows.length - 1]; y++) point(pixels, width, x, y, paper(x, y) - 14);
    const found = findPrescriptionGrids(pixels, width, height);
    expect(found).toEqual([{ bbox: { left: 40, top: 50, width: 621, height: 196 }, columns, rows,
      columnWidths: [1, 1, 1, 1, 1, 1], rowWidths: [1, 1, 1, 1] }]);
  });

  it("merges adjacent overlapping aliases of one slightly slanted vertical rule", () => {
    const width = 720;
    const pixels = page(width, 340, 169);
    const columns = [40, 140, 240, 360, 480, 660];
    const rows = [50, 115, 180, 245];
    for (const y of rows) for (let x = 39; x <= 719; x++) point(pixels, width, x, y, 155);
    for (const x of columns) {
      for (let y = 50; y <= 190; y++) point(pixels, width, x + 1, y, 155);
      for (let y = 90; y <= 245; y++) point(pixels, width, x, y, 155);
    }
    const found = findPrescriptionGrids(pixels, width, 340);
    expect(found).toHaveLength(1);
    expect(found[0].columns).toEqual(columns.map((value) => value + 0.5));
    expect(found[0].rows).toEqual(rows);
    expect(found[0].columnWidths).toEqual([2, 2, 2, 2, 2, 2]);
  });

  it("merges overlapping horizontal fragments while retaining their full observed stroke envelope", () => {
    const width = 720;
    const pixels = page(width, 340, 169);
    const columns = [40, 140, 240, 360, 480, 660];
    const rows = [50, 115, 180, 245];
    for (const y of rows) {
      for (let x = 40; x <= 260; x++) point(pixels, width, x, y, 155);
      for (let x = 40; x <= 350; x++) point(pixels, width, x, y + 1, 155);
      for (let x = 590; x <= 660; x++) point(pixels, width, x, y + 1, 155);
      for (let x = 180; x <= 660; x++) point(pixels, width, x, y + 2, 155);
      for (let x = 300; x <= 530; x++) point(pixels, width, x, y + 3, 155);
    }
    for (const x of columns) for (let y = 50; y <= 248; y++) point(pixels, width, x, y, 155);
    const found = findPrescriptionGrids(pixels, width, 340);
    expect(found).toHaveLength(1);
    expect(found[0].columns).toEqual(columns);
    expect(found[0].rows).toEqual(rows.map((value) => value + 1.5));
    expect(found[0].rowWidths).toEqual([4, 4, 4, 4]);
  });

  it("does not bridge disjoint horizontal fragments on neighboring pixel rows", () => {
    const width = 720;
    const pixels = page(width, 340);
    const columns = [40, 140, 240, 360, 480, 660];
    grid(pixels, width, columns, [50, 115, 180, 245]);
    for (let x = 40; x <= 660; x++) point(pixels, width, x, 50, 250);
    for (let x = 40; x <= 260; x++) point(pixels, width, x, 50);
    for (let x = 400; x <= 660; x++) point(pixels, width, x, 51);
    expect(findPrescriptionGrids(pixels, width, 340)).toEqual([]);
  });

  it("does not merge crossing diagonal fragments into a precise horizontal divider", () => {
    const width = 720;
    const pixels = page(width, 340);
    const columns = [40, 140, 240, 360, 480, 660];
    grid(pixels, width, columns, [50, 115, 180, 245]);
    for (let x = 40; x <= 660; x++) {
      point(pixels, width, x, 50, 250);
      point(pixels, width, x, 50 + Math.round((x - 40) * 0.05));
      point(pixels, width, x, 81 - Math.round((x - 40) * 0.05));
    }
    expect(findPrescriptionGrids(pixels, width, 340)).toEqual([]);
  });

  it("does not turn a gray rectangular photo patch or smooth illumination into a grid", () => {
    const width = 720;
    const height = 340;
    const pixels = page(width, height, 255);
    for (let y = 45; y < 280; y++) for (let x = 30; x < 690; x++) point(pixels, width, x, y, 160 + Math.round(15 * x / width));
    expect(findPrescriptionGrids(pixels, width, height)).toEqual([]);
  });

  it("does not emit precise cell geometry for visibly tilted rules", () => {
    const pixels = page(640, 320);
    const slope = 0.055;
    for (const y of [40, 100, 160, 220]) for (let x = 30; x <= 590; x++) point(pixels, 640, x, Math.round(y + (x - 30) * slope));
    for (const x of [30, 110, 230, 350, 470, 590]) for (let y = 40; y <= 220; y++) point(pixels, 640, x, Math.round(y + (x - 30) * slope));
    expect(findPrescriptionGrids(pixels, 640, 320)).toEqual([]);
  });

  it("rejects malformed or excessive input before allocation", () => {
    for (const [width, height, length] of [[0, 10, 0], [10.5, 10, 420], [10, 10, 1], [4801, 1, 4801], [4000, 4000, 1]]) {
      expect(() => findPrescriptionGrids(new Uint8Array(length), width, height)).toThrow(RangeError);
    }
  });
});

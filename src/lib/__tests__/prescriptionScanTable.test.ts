import { describe, expect, it } from "vitest";
import { combinePrescriptionScanPasses, parseObservedPrescriptionRows, parsePrescriptionScan, reviewedScanPrescription, type PrescriptionScanWord } from "@/lib/prescriptionScan";
import type { PrescriptionScanGrid } from "@/lib/prescriptionScanGrid";
import { readPrescriptionTableGrids, type PrescriptionTableCellKind } from "@/lib/prescriptionScanTable";

const word = (text: string, left: number, top: number, confidence = 95): PrescriptionScanWord => ({
  text, confidence, bbox: { x0: left, y0: top, x1: left + Math.max(8, text.length * 6), y1: top + 14 },
});

function fixture(offset = 0, eyes = ["OD", "OS"]) {
  const grid: PrescriptionScanGrid = {
    bbox: { left: 100, top: 100 + offset, width: 900, height: 150 },
    columns: [100, 200, 320, 680, 790, 900, 1000], rows: [100, 150, 200, 250].map((value) => value + offset),
  };
  const headings = ["Balance", "Sphere", "Cylinder", "Axis", "Add", "Prism"];
  const words = headings.map((text, column) => word(text, grid.columns[column] + 8, 113 + offset));
  const values = [["-2.00", "-0.50", "180", "+2.00"], ["+1.75", "D.S.", "", "+2.25"]];
  for (let row = 0; row < 2; row++) {
    if (eyes[row]) words.push(word(eyes[row], 65, 163 + row * 50 + offset));
    for (let field = 0; field < 4; field++) {
      const text = values[row][field];
      if (!text) continue;
      const left = grid.columns[field + 1], right = grid.columns[field + 2];
      words.push(word(text, (left + right - text.length * 6) / 2, 163 + row * 50 + offset));
    }
  }
  return { grid, words };
}

function recognizer(words: PrescriptionScanWord[]) {
  const calls: { kind: PrescriptionTableCellKind; left: number; top: number; width: number; height: number }[] = [];
  const read = async (region: { left: number; top: number; width: number; height: number }, kind: PrescriptionTableCellKind) => {
    calls.push({ ...region, kind });
    return words.filter(({ bbox }) => bbox.x0 >= region.left && bbox.x1 <= region.left + region.width
      && bbox.y0 >= region.top && bbox.y1 <= region.top + region.height);
  };
  return { read, calls };
}

describe("observed prescription table-grid reading", () => {
  it("reads actual cells with unequal widths, leading Balance, a blank axis, explicit D.S., and Prism", async () => {
    const { grid, words } = fixture();
    const before = JSON.stringify(words);
    const { read, calls } = recognizer(words);
    const reading = await readPrescriptionTableGrids([grid], 1200, 800, read);
    expect(reading.result?.od).toEqual({ sphere: -2, cylinder: -0.5, axis: 180, add: 2 });
    expect(reading.result?.os).toEqual({ sphere: 1.75, cylinder: 0, axis: null, add: 2.25 });
    expect(reading.result?.pupillaryDistance).toBeNull();
    expect(reading.result?.hasAlignedTable).toBe(true);
    expect(reading.result?.warnings.join(" ")).toContain("Prism");
    expect(reading.metadata).toEqual({ gridsExamined: 1, matchedTables: 1, eyeRows: 2, cellReads: 16, cancelled: false, blocker: "none" });
    expect(calls[0]).toMatchObject({ left: 102, top: 102, width: 96, height: 46, kind: "heading" });
    expect(calls.find((call) => call.kind === "eye")).toMatchObject({ left: 0, width: 198 });
    expect(JSON.stringify(words)).toBe(before);
    expect(reviewedScanPrescription(reading.result!)).not.toBeNull();
  });

  it("uses actual grid cells rather than shifting a right-aligned value across a heading midpoint", async () => {
    const { grid, words } = fixture();
    const cylinder = words.find((entry) => entry.text === "-0.50")!;
    cylinder.bbox.x0 = 640; cylinder.bbox.x1 = 670;
    const heuristic = parsePrescriptionScan("", words);
    expect(heuristic.od.cylinder).not.toBe(-0.5);
    const reading = await readPrescriptionTableGrids([grid], 1200, 800, recognizer(words).read);
    expect(reading.result?.od).toEqual({ sphere: -2, cylinder: -0.5, axis: 180, add: 2 });
  });

  it("excludes only the observed thick stroke envelopes in header, value, and eye crops", async () => {
    const { grid, words } = fixture();
    grid.columnWidths = [6, 8, 10, 12, 14, 4, 6];
    grid.rowWidths = [8, 6, 10, 4];
    const { read, calls } = recognizer(words);
    const reading = await readPrescriptionTableGrids([grid], 1200, 800, read);
    expect(calls[0]).toMatchObject({ left: 104, top: 105, width: 91, height: 41, kind: "heading" });
    expect(calls.find((call) => call.kind === "eye")).toMatchObject({ left: 0, top: 154, width: 195, height: 40 });
    expect(calls.find((call) => call.kind === "value" && call.left === 326)).toMatchObject({ top: 154, width: 347, height: 40 });
    expect(reading.result?.od).toEqual({ sphere: -2, cylinder: -0.5, axis: 180, add: 2 });
    expect(reading.result?.os).toEqual({ sphere: 1.75, cylinder: 0, axis: null, add: 2.25 });
  });

  it("keeps thin-rule and legacy fallback crops bounded without broad trimming", async () => {
    const { grid, words } = fixture();
    grid.columnWidths = grid.columns.map(() => 1);
    grid.rowWidths = grid.rows.map(() => 1);
    const { read, calls } = recognizer(words);
    const reading = await readPrescriptionTableGrids([grid], 1200, 800, read);
    expect(calls[0]).toMatchObject({ left: 102, top: 102, width: 96, height: 46 });
    expect(reading.result?.od.sphere).toBe(-2);
    expect(reading.result?.os.sphere).toBe(1.75);
  });

  it.each(["column length", "row length", "nonfinite", "zero", "negative", "consume column", "consume row"])("rejects invalid observed rule widths: %s", async (failure) => {
    const { grid } = fixture();
    grid.columnWidths = grid.columns.map(() => 1);
    grid.rowWidths = grid.rows.map(() => 1);
    if (failure === "column length") grid.columnWidths.pop();
    if (failure === "row length") grid.rowWidths.pop();
    if (failure === "nonfinite") grid.columnWidths[1] = Number.NaN;
    if (failure === "zero") grid.rowWidths[1] = 0;
    if (failure === "negative") grid.columnWidths[1] = -1;
    if (failure === "consume column") grid.columnWidths[1] = 500;
    if (failure === "consume row") grid.rowWidths[1] = 100;
    const { read, calls } = recognizer([]);
    const reading = await readPrescriptionTableGrids([grid], 1200, 800, read);
    expect(reading.result).toBeNull();
    expect(reading.metadata.blocker).toBe("invalid_geometry");
    expect(calls).toHaveLength(0);
  });

  it("identifies reversed row order from explicit labels, not top/bottom position", async () => {
    const { grid, words } = fixture(0, ["OS", "OD"]);
    const reading = await readPrescriptionTableGrids([grid], 1200, 800, recognizer(words).read);
    expect(reading.result?.os.sphere).toBe(-2);
    expect(reading.result?.od.sphere).toBe(1.75);
  });

  it("can read observed labels inside a leading cell rather than the outside gutter", async () => {
    const { grid, words } = fixture();
    for (const label of words.filter((entry) => /^(OD|OS)$/.test(entry.text))) {
      label.bbox.x0 += 60; label.bbox.x1 += 60;
    }
    const reading = await readPrescriptionTableGrids([grid], 1200, 800, recognizer(words).read);
    expect(reading.result?.od.sphere).toBe(-2);
    expect(reading.result?.os.sphere).toBe(1.75);
  });

  it("leaves unlabelled rows blank instead of borrowing the other eye", async () => {
    const { grid, words } = fixture(0, ["", "OS"]);
    const reading = await readPrescriptionTableGrids([grid], 1200, 800, recognizer(words).read);
    expect(reading.result?.od).toEqual({ sphere: null, cylinder: null, axis: null, add: null });
    expect(reading.result?.os.sphere).toBe(1.75);
    expect(reading.metadata.eyeRows).toBe(1);
  });

  it("does not read values without any explicit eye evidence", async () => {
    const { grid, words } = fixture(0, ["", ""]);
    const { read, calls } = recognizer(words);
    expect((await readPrescriptionTableGrids([grid], 1200, 800, read)).result).toBeNull();
    expect(calls.some((call) => call.kind === "value")).toBe(false);
  });

  it.each(["heading", "eye"] as const)("rejects uncertain %s evidence before reading values", async (kind) => {
    const { grid, words } = fixture();
    words.find((entry) => entry.text === (kind === "heading" ? "Cylinder" : "OS"))!.confidence = 59;
    const { read, calls } = recognizer(words);
    const reading = await readPrescriptionTableGrids([grid], 1200, 800, read);
    expect(reading.result).toBeNull();
    expect(reading.metadata.blocker).toBe("uncertain_labels");
    expect(calls.some((call) => call.kind === "value")).toBe(false);
  });

  it("requires real Axis evidence and never guesses the third optical column", async () => {
    const { grid, words } = fixture();
    words.find((entry) => entry.text === "Axis")!.text = "Unknown";
    const { read, calls } = recognizer(words);
    expect((await readPrescriptionTableGrids([grid], 1200, 800, read)).result).toBeNull();
    expect(calls.some((call) => call.kind === "value")).toBe(false);
  });

  it.each(["eye label", "numeric value", "unknown word"])("does not turn a first row containing %s evidence into clean headings", async (failure) => {
    const { grid, words } = fixture();
    if (failure === "eye label") words.push(word("OD", 160, 113));
    if (failure === "numeric value") words.push(word("-2.00", 265, 113, 30));
    if (failure === "unknown word") words.push(word("unclear", 390, 113, 20));
    const { read, calls } = recognizer(words);
    const reading = await readPrescriptionTableGrids([grid], 1200, 800, read);
    expect(reading.result).toBeNull();
    expect(reading.metadata.blocker).toBe("uncertain_labels");
    expect(calls.some((call) => call.kind === "value")).toBe(false);
  });

  it("allows absent ADD without borrowing a Prism value or inferring an addition", async () => {
    const { grid, words } = fixture();
    words.find((entry) => entry.text === "Add")!.text = "Base";
    words.push(word("3.00", 930, 163));
    const reading = await readPrescriptionTableGrids([grid], 1200, 800, recognizer(words).read);
    expect(reading.result?.od.add).toBeNull();
    expect(reading.result?.os.add).toBeNull();
    expect(reading.result?.od.axis).toBe(180);
  });

  it.each(["low confidence", "extra character", "duplicate values", "missing sign"])("preserves %s value evidence for existing clinical guards", async (failure) => {
    const { grid, words } = fixture();
    const sphere = words.find((entry) => entry.text === "-2.00")!;
    if (failure === "low confidence") sphere.confidence = 44;
    if (failure === "extra character") sphere.text = "-2.00x";
    if (failure === "duplicate values") sphere.text = "-2.00 -3.00";
    if (failure === "missing sign") sphere.text = "2.00";
    const reading = await readPrescriptionTableGrids([grid], 1200, 800, recognizer(words).read);
    if (failure === "missing sign") {
      expect(reading.result?.od.sphere).toBe(2);
      expect(reading.result?.warnings.join(" ")).toContain("no clear plus/minus");
    } else expect(reading.result?.od.sphere).toBeNull();
    if (failure === "duplicate values") {
      const later = parsePrescriptionScan("SPH CYL AXIS\nOD -2.00 -0.50 180");
      expect(combinePrescriptionScanPasses(reading.result!, later).od.sphere).toBeNull();
    }
    expect(reading.words).toContain(sphere);
  });

  it.each([undefined, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, 101])("blanks exact-cell values with invalid confidence %s", async (confidence) => {
    const { grid, words } = fixture();
    const sphere = words.find((entry) => entry.text === "-2.00")!;
    sphere.confidence = confidence;
    const reading = await readPrescriptionTableGrids([grid], 1200, 800, recognizer(words).read);
    expect(reading.result?.od.sphere).toBeNull();
    expect(reading.result?.od.cylinder).toBe(-0.5);
    expect(reading.result?.warnings.join(" ")).toContain("sphere has no valid reading confidence");
    expect(reading.words).toContain(sphere);
  });

  it("keeps definite duplicate-cell warnings sticky even when confidence is unavailable", async () => {
    const { grid, words } = fixture();
    const sphere = words.find((entry) => entry.text === "-2.00")!;
    sphere.text = "-2.00 -3.00";
    delete sphere.confidence;
    const reading = await readPrescriptionTableGrids([grid], 1200, 800, recognizer(words).read);
    expect(reading.result?.warnings.join(" ")).toContain("sphere has duplicate or unclear");
    const later = parsePrescriptionScan("SPH CYL AXIS\nOD -2.00 -0.50 180");
    expect(combinePrescriptionScanPasses(reading.result!, later).od.sphere).toBeNull();
  });

  it.each(["duplicate rows", "conflicting row labels", "duplicate headers"])("refuses %s without reading values", async (failure) => {
    const { grid, words } = fixture(0, failure === "duplicate rows" ? ["OD", "OD"] : ["OD", "OS"]);
    if (failure === "conflicting row labels") words.push(word("OS", 120, 163));
    if (failure === "duplicate headers") words.find((entry) => entry.text === "Balance")!.text = "SPH";
    const { read, calls } = recognizer(words);
    const reading = await readPrescriptionTableGrids([grid], 1200, 800, read);
    expect(reading.result?.requiresRescan).toBe(true);
    expect(reading.result?.od.sphere).toBeNull();
    expect(reading.result?.os.sphere).toBeNull();
    expect(calls.some((call) => call.kind === "value")).toBe(false);
  });

  it("detects two optical tables before accepting either table's values", async () => {
    const first = fixture(), second = fixture(350);
    const { read, calls } = recognizer([...first.words, ...second.words]);
    const reading = await readPrescriptionTableGrids([first.grid, second.grid], 1200, 800, read);
    expect(reading.result?.requiresRescan).toBe(true);
    expect(reading.metadata.matchedTables).toBe(2);
    expect(calls.some((call) => call.kind === "eye" || call.kind === "value")).toBe(false);
  });

  it("still refuses two observed optical tables when one heading is uncertain", async () => {
    const first = fixture(), second = fixture(350);
    first.words.find((entry) => entry.text === "Sphere")!.confidence = 59;
    const reading = await readPrescriptionTableGrids([first.grid, second.grid], 1200, 800, recognizer([...first.words, ...second.words]).read);
    expect(reading.result?.requiresRescan).toBe(true);
    expect(reading.metadata.matchedTables).toBe(2);
  });

  it("retains clinical range and plus-cylinder transposition checks in the exact-cell path", async () => {
    const { grid, words } = fixture();
    words.find((entry) => entry.text === "-0.50")!.text = "+0.50";
    words.find((entry) => entry.text === "+1.75")!.text = "+50.00";
    const reading = await readPrescriptionTableGrids([grid], 1200, 800, recognizer(words).read);
    expect(reading.result?.od).toEqual({ sphere: -1.5, cylinder: -0.5, axis: 90, add: 2 });
    expect(reading.result?.os.sphere).toBeNull();
    expect(reading.result?.warnings.join(" ")).toContain("plus cylinder was converted");
  });

  it("the exact-cell helper itself refuses numeric/uncertain heading or eye evidence", () => {
    const headings = { sphere: word("Sphere", 200, 100), cylinder: word("Cylinder", 320, 100), axis: word("Axis", 680, 100) };
    const label = word("OD", 65, 163);
    const rows = [{ eye: "od" as const, label, cells: { sphere: [word("-2.00", 250, 163)] } }];
    headings.sphere.text = "Sphere2";
    expect(parseObservedPrescriptionRows(headings, rows).requiresRescan).toBe(true);
    headings.sphere.text = "Sphere";
    headings.sphere.confidence = 59;
    expect(parseObservedPrescriptionRows(headings, rows).od.sphere).toBeNull();
    headings.sphere.confidence = 95;
    label.text = "0D";
    expect(parseObservedPrescriptionRows(headings, rows).requiresRescan).toBe(true);
  });

  it("ignores a separate auxiliary Prism/Base grid, not an optical prescription", async () => {
    const first = fixture(), second = fixture(350);
    second.words = second.words.filter((entry) => !["Sphere", "Cylinder", "Axis", "Add"].includes(entry.text));
    const reading = await readPrescriptionTableGrids([first.grid, second.grid], 1200, 800, recognizer([...first.words, ...second.words]).read);
    expect(reading.result?.od.sphere).toBe(-2);
    expect(reading.metadata.matchedTables).toBe(1);
  });

  it.each(["too many grids", "too many rows", "too many columns", "nonmonotonic", "out of bounds"])("refuses %s without OCR", async (failure) => {
    const { grid } = fixture();
    if (failure === "too many rows") grid.rows = [100, 120, 140, 160, 180, 200, 220, 250];
    if (failure === "too many columns") grid.columns = Array.from({ length: 14 }, (_, index) => 100 + index * 60);
    if (failure === "nonmonotonic") grid.columns[2] = grid.columns[1];
    if (failure === "out of bounds") grid.bbox.width = 2000;
    const { read, calls } = recognizer([]);
    const reading = await readPrescriptionTableGrids(failure === "too many grids" ? [grid, grid, grid] : [grid], 1200, 800, read);
    expect(reading.result).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("rejects unmapped local coordinates rather than placing a value in another source cell", async () => {
    const { grid } = fixture();
    const reading = await readPrescriptionTableGrids([grid], 1200, 800, async () => [word("Sphere", 0, 0)]);
    expect(reading.result).toBeNull();
    expect(reading.metadata.blocker).toBe("invalid_geometry");
  });

  it.each(["heading", "eye"] as const)("retains harmless outside rule tokens in %s crops without using them as labels", async (kind) => {
    const { grid, words } = fixture();
    const base = recognizer(words).read;
    const reading = await readPrescriptionTableGrids([grid], 1200, 800, async (region, currentKind) => {
      const recognized = await base(region, currentKind);
      return currentKind === kind ? [...recognized, word("|", region.left - 2, region.top - 3, 10)] : recognized;
    });
    expect(reading.metadata.blocker).toBe("none");
    expect(reading.words.some((entry) => entry.text === "|")).toBe(true);
    expect(reading.result?.od.sphere).toBe(-2);
    expect(reading.result?.os.cylinder).toBe(0);
  });

  it.each([
    ["value", "|", false], ["heading", "1", false], ["eye", "OD|", false],
    ["eye", "7)", false], ["heading", "-", false], ["heading", "|", true],
  ] as const)("does not exempt %s %s tokens or malformed rule geometry", async (kind, text, malformed) => {
    const { grid, words } = fixture();
    const base = recognizer(words).read;
    const reading = await readPrescriptionTableGrids([grid], 1200, 800, async (region, currentKind) => {
      const recognized = await base(region, currentKind);
      const extra = word(text, region.left - 2, region.top - 3, 10);
      if (malformed) extra.bbox.x0 = NaN;
      return currentKind === kind ? [...recognized, extra] : recognized;
    });
    expect(reading.metadata.blocker).toBe("invalid_geometry");
    expect(reading.result).toBeNull();
  });

  it("cancels after a pending OCR call without accepting or retaining its words", async () => {
    const { grid, words } = fixture();
    let cancelled = false;
    const reading = await readPrescriptionTableGrids([grid], 1200, 800, async () => {
      cancelled = true;
      return words;
    }, () => cancelled);
    expect(reading.metadata.cancelled).toBe(true);
    expect(reading.result).toBeNull();
    expect(reading.words).toEqual([]);
    expect(reading.metadata.cellReads).toBe(1);
  });
});

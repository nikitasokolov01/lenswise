import { describe, expect, it } from "vitest";
import { combinePrescriptionScanPasses, findPrescriptionScanRegions, parsePrescriptionScan, reviewedScanPrescription, type PrescriptionScanWord } from "@/lib/prescriptionScan";

const word = (text: string, x: number, y: number, confidence = 95, width = 70): PrescriptionScanWord => ({
  text, confidence, bbox: { x0: x, y0: y, x1: x + width, y1: y + 18 },
});
const tableHeadings = (offset = 0): PrescriptionScanWord[] => [
  word("Sphere", 100, offset), word("Cylinder", 200, offset), word("Axis", 300, offset),
  word("Add", 400, offset), word("Prism", 500, offset), word("Base", 600, offset),
];
const mergedHeading = (terms: [string, number][], top = 0, separator = "|"): PrescriptionScanWord => {
  const symbols: NonNullable<PrescriptionScanWord["symbols"]> = [];
  for (let index = 0; index < terms.length; index++) {
    const [text, left] = terms[index];
    for (let letter = 0; letter < text.length; letter++) symbols.push({
      text: text[letter], confidence: 98,
      bbox: { x0: left + letter * 8, y0: top, x1: left + letter * 8 + 7, y1: top + 18 },
    });
    if (separator) symbols.push({ text: separator, confidence: 95,
      bbox: { x0: left + text.length * 8, y0: top, x1: left + text.length * 8 + 2, y1: top + 18 },
    });
  }
  return {
    text: terms.map(([text]) => text).join(separator) + separator, confidence: 14, symbols,
    bbox: { x0: symbols[0].bbox.x0, y0: top, x1: symbols[symbols.length - 1].bbox.x1, y1: top + 18 },
  };
};

describe("printed prescription scan parsing", () => {
  it("reads a signed OD/OS table and combined PD without retaining identity", () => {
    const result = parsePrescriptionScan("Patient: SAMPLE ONLY\nDOB: 1/1/1900\nSPH CYL AXIS ADD\nOD -2.00 -1.25 180 +2.00\nOS +1.50 -0.75 090 +2.25\nPD: 63.5");
    expect(result.od).toEqual({ sphere: -2, cylinder: -1.25, axis: 180, add: 2 });
    expect(result.os).toEqual({ sphere: 1.5, cylinder: -0.75, axis: 90, add: 2.25 });
    expect(result.pupillaryDistance?.binocular).toBe("63.5");
    expect(JSON.stringify(result)).not.toContain("SAMPLE");
    expect(JSON.stringify(result)).not.toContain("1900");
    expect(reviewedScanPrescription(result)?.od.sphere).toBe(-2);
  });

  it("reads individually labelled rows and clear plano/DS values", () => {
    const result = parsePrescriptionScan("Right Eye: Sphere PLANO Cyl DS Axis 0 Add 0.00\nLeft Eye: Sphere -1.00 Cyl -0.50 Axis 45 Add +1.50");
    expect(result.od).toEqual({ sphere: 0, cylinder: 0, axis: null, add: null });
    expect(result.os).toEqual({ sphere: -1, cylinder: -0.5, axis: 45, add: 1.5 });
  });

  it("handles Unicode signs, decimal commas, dotted labels, and shared ADD", () => {
    const result = parsePrescriptionScan("O.D. −2,25 −1,00 175\nO.S. ＋1,00 −0,25 5\nADD +2,00");
    expect(result.od.sphere).toBe(-2.25);
    expect(result.os.sphere).toBe(1);
    expect(result.od.add).toBe(2);
    expect(result.os.add).toBe(2);
  });

  it("does not mistake SPH used as a cylinder value for a field heading", () => {
    const result = parsePrescriptionScan("SPH CYL AXIS ADD\nOD -2.00 SPH 0 +2.00\nOS PLANO SPH 0 +2.00");
    expect(result.od).toEqual({ sphere: -2, cylinder: 0, axis: null, add: 2 });
    expect(result.os).toEqual({ sphere: 0, cylinder: 0, axis: null, add: 2 });
  });

  it("transposes plus cylinder only when the whole eye prescription is clear", () => {
    const result = parsePrescriptionScan("OD -2.00 +1.00 180 +2.00\nOS +1.00 +0.50 90 +2.00");
    expect(result.od).toEqual({ sphere: -1, cylinder: -1, axis: 90, add: 2 });
    expect(result.os).toEqual({ sphere: 1.5, cylinder: -0.5, axis: 180, add: 2 });
    expect(result.warnings.join(" ")).toContain("converted");
  });

  it("leaves unknown fields empty rather than supplying a zero Rx", () => {
    const result = parsePrescriptionScan("No legible numbers\nDate: 10/06/2026");
    expect(result.od.sphere).toBeNull();
    expect(result.os.cylinder).toBeNull();
    expect(reviewedScanPrescription(result)).toBeNull();
  });

  it("rejects unsupported powers, invalid axes, and partially missing table cells", () => {
    const result = parsePrescriptionScan("SPH CYL AXIS ADD\nOD -2.13 -9.00 181 5.00\nOS -2.00 180 2.00");
    expect(result.od).toEqual({ sphere: null, cylinder: null, axis: null, add: null });
    expect(result.os).toEqual({ sphere: null, cylinder: null, axis: null, add: null });
    expect(reviewedScanPrescription(result)).toBeNull();
  });

  it("does not choose among multiple prescriptions for one eye", () => {
    const result = parsePrescriptionScan("OD -2.00 -0.50 180\nOD -3.00 -0.75 170\nOS -1.00 -0.25 90");
    expect(result.od.sphere).toBeNull();
    expect(result.os.sphere).toBeNull();
    expect(result.warnings.join(" ")).toContain("multiple prescriptions");
  });

  it("reads explicitly labelled monocular PD in either eye order", () => {
    expect(parsePrescriptionScan("PD: OD 31.5 / OS 32").pupillaryDistance).toEqual({ mode: "monocular", binocular: "", right: "31.5", left: "32" });
    expect(parsePrescriptionScan("PD: Left 32 / Right 31.5").pupillaryDistance).toEqual({ mode: "monocular", binocular: "", right: "31.5", left: "32" });
  });

  it("rejects unlabeled dual PD, near PD, out-of-range PD, or ambiguous PD lines", () => {
    expect(parsePrescriptionScan("PD: 31/32").pupillaryDistance).toBeNull();
    expect(parsePrescriptionScan("Near PD: 59").pupillaryDistance).toBeNull();
    expect(parsePrescriptionScan("PD: 630").pupillaryDistance).toBeNull();
    expect(parsePrescriptionScan("PD: 63\nPD: 64").pupillaryDistance).toBeNull();
  });

  it.each(["PD: -63", "PD: −63", "PD: - 63", "PD: OD -31.5 / OS 32", "PD: OD 31.5 / OS -32"])("rejects negative PD instead of dropping its sign: %s", (text) => {
    expect(parsePrescriptionScan(text).pupillaryDistance).toBeNull();
  });

  it("rejects positional tables with unsupported columns that can shift ADD", () => {
    const result = parsePrescriptionScan("SPH CYL AXIS ADD PRISM BASE\nOD -2.00 SPH +2.00 1.00 BI\nOS -1.00 SPH +2.00 1.00 BI");
    expect(result.od).toEqual({ sphere: null, cylinder: null, axis: null, add: null });
    expect(result.os).toEqual({ sphere: null, cylinder: null, axis: null, add: null });
    expect(reviewedScanPrescription(result)).toBeNull();
    expect(result.warnings.join(" ")).toContain("extra columns");
  });

  it("still reads explicitly labelled optical values and warns about prism", () => {
    const result = parsePrescriptionScan("SPH CYL AXIS ADD PRISM BASE\nOD SPH -2.00 CYL -0.50 AXIS 180 ADD 2.00 PRISM 1.00 BASE BI\nOS SPH -1.00 CYL -0.25 AXIS 90 ADD 2.00 PRISM 1.00 BASE BO");
    expect(result.od.axis).toBe(180);
    expect(result.od.add).toBe(2);
    expect(result.warnings.join(" ")).toContain("Prism");
  });

  it("reads full-word headings and spaced signs without dropping minus signs", () => {
    const result = parsePrescriptionScan("Sphere Cylinder Axis Add\n0D - 2.00 - .50 180 + 2.00\n0S + 1. 50 - 0.75 90 + 2.25");
    expect(result.od).toEqual({ sphere: -2, cylinder: -0.5, axis: 180, add: 2 });
    expect(result.os).toEqual({ sphere: 1.5, cylinder: -0.75, axis: 90, add: 2.25 });
  });

  it("joins wrapped labelled fields without borrowing another eye's values", () => {
    const result = parsePrescriptionScan("Right Eye: Sphere -2.00\nCylinder -0.50\nAxis 180\nAdd +2.00\nLeft Eye: Sphere +1.00\nCylinder -0.25\nAxis 90\nAdd +2.25");
    expect(result.od).toEqual({ sphere: -2, cylinder: -0.5, axis: 180, add: 2 });
    expect(result.os).toEqual({ sphere: 1, cylinder: -0.25, axis: 90, add: 2.25 });
  });

  it("does not copy a wrapped single-eye ADD into the other eye", () => {
    const result = parsePrescriptionScan("Right Eye: Sphere -2.00\nCylinder -0.50\nAxis 180\nAdd +2.00\nLeft Eye: Sphere +1.00\nCylinder -0.25\nAxis 90");
    expect(result.od.add).toBe(2);
    expect(result.os.add).toBeNull();
  });

  it("retains explicitly OU-shared ADD after a labelled prescription", () => {
    const result = parsePrescriptionScan("OD Sphere -2.00 Cylinder -0.50 Axis 180\nOS Sphere +1.00 Cylinder -0.25 Axis 90\nOU ADD +2.00");
    expect(result.od.add).toBe(2);
    expect(result.os.add).toBe(2);
  });

  it("never borrows another eye's labelled row for an empty OD row", () => {
    const result = parsePrescriptionScan("OD\nOS -1.00 -0.25 90");
    expect(result.od).toEqual({ sphere: null, cylinder: null, axis: null, add: null });
    expect(result.os).toEqual({ sphere: -1, cylinder: -0.25, axis: 90, add: null });
    expect(reviewedScanPrescription(result)).toBeNull();
  });

  it("does read an eye's own numeric continuation without confusing it with a header", () => {
    const result = parsePrescriptionScan("SPH CYL AXIS\nOD\n-2.00 -0.50 180\nOS\n-1.00 -0.25 90");
    expect(result.od.sphere).toBe(-2);
    expect(result.os.sphere).toBe(-1);
    const headingOnly = parsePrescriptionScan("OD\nSphere Cylinder Axis\nOS -1.00 -0.25 90");
    expect(headingOnly.od.sphere).toBeNull();
  });

  it("rejects repeated labelled fields instead of choosing the last value", () => {
    const result = parsePrescriptionScan("OD Sphere -2.00 Sphere -3.00 Cylinder -0.50 Axis 180 Add +2.00\nOS Sphere -1.00 Cylinder -0.25 Axis 90 Add +2.00");
    expect(result.od.sphere).toBeNull();
    expect(result.od.cylinder).toBe(-0.5);
    expect(result.warnings.join(" ")).toContain("sphere has duplicate");
    expect(reviewedScanPrescription(result)).toBeNull();
  });

  it.each(["-2.00/-3.00", "-2.00 12", "-2.OO", "-2.00 extra"])("rejects an unclear labelled cell without extracting its first number: %s", (cell) => {
    const result = parsePrescriptionScan(`OD Sphere ${cell} Cylinder -0.50 Axis 180 Add +2.00\nOS Sphere -1.00 Cylinder -0.25 Axis 90 Add +2.00`);
    expect(result.od.sphere).toBeNull();
    expect(result.warnings.join(" ")).toContain("sphere has duplicate or unclear");
  });

  it("preserves explicit spherical cylinder and clear optical units in labelled cells", () => {
    const result = parsePrescriptionScan("OD Sphere (-2.00) D Cylinder SPH Axis 0 Add +2.00 D\nOS Sphere -1.00 D Cylinder -0.25 D Axis x90° Add +2.25 D");
    expect(result.od).toEqual({ sphere: -2, cylinder: 0, axis: null, add: 2 });
    expect(result.os).toEqual({ sphere: -1, cylinder: -0.25, axis: 90, add: 2.25 });
  });

  it("aligns blank axis and prism cells spatially instead of shifting ADD", () => {
    const words = [...tableHeadings(),
      word("O.D.", 0, 50), word("-2.00", 100, 50), word("SPH", 200, 50), word("+2.00", 400, 50), word("1.00", 500, 50), word("BI", 600, 50),
      word("O.S.", 0, 100), word("-1.00", 100, 100), word("DS", 200, 100), word("+2.25", 400, 100), word("1.00", 500, 100), word("BO", 600, 100),
    ];
    const result = parsePrescriptionScan("Sphere Cylinder Axis Add Prism Base\nOD -2.00 SPH +2.00 1.00 BI\nOS -1.00 DS +2.25 1.00 BO", words);
    expect(result.od).toEqual({ sphere: -2, cylinder: 0, axis: null, add: 2 });
    expect(result.os).toEqual({ sphere: -1, cylinder: 0, axis: null, add: 2.25 });
  });

  it("leaves a truly blank cylinder empty even if the next column has an axis", () => {
    const words = [...tableHeadings(),
      word("OD", 0, 50), word("-2.00", 100, 50), word("180", 300, 50), word("+2.00", 400, 50),
      word("OS", 0, 100), word("-1.00", 100, 100), word("-0.50", 200, 100), word("90", 300, 100), word("+2.25", 400, 100),
    ];
    const result = parsePrescriptionScan("Sphere Cylinder Axis Add Prism Base\nOD -2.00 180 +2.00\nOS -1.00 -0.50 90 +2.25", words);
    expect(result.od.sphere).toBe(-2);
    expect(result.od.cylinder).toBeNull();
    expect(result.od.axis).toBe(180);
    expect(result.od.add).toBe(2);
    expect(reviewedScanPrescription(result)).toBeNull();
  });

  it("joins separated signs in one cell, handles degree symbols, and flags low-confidence cells", () => {
    const words = [...tableHeadings(),
      word("Right", 0, 50), word("-", 100, 50, 95, 8), word("2.00", 113, 50, 95, 50), word("-0.50", 200, 50), word("180°", 300, 50), word("+2.00", 400, 50),
      word("Left", 0, 100), word("-1.00", 100, 100, 25), word("-0.25", 200, 100), word("90", 300, 100), word("+2.25", 400, 100),
    ];
    const result = parsePrescriptionScan("Sphere Cylinder Axis Add Prism Base", words);
    expect(result.od.sphere).toBe(-2);
    expect(result.od.axis).toBe(180);
    expect(result.os.sphere).toBeNull();
    expect(result.warnings.join(" ")).toContain("sphere was difficult");
  });

  it("rejects multiple spatial tables even when flattened OCR omits a row", () => {
    const table = (offset: number) => [...tableHeadings(offset),
      word("OD", 0, offset + 50), word("-2.00", 100, offset + 50), word("-0.50", 200, offset + 50), word("180", 300, offset + 50),
      word("OS", 0, offset + 100), word("-1.00", 100, offset + 100), word("-0.25", 200, offset + 100), word("90", 300, offset + 100),
    ];
    const result = parsePrescriptionScan("OD -2.00 -0.50 180\nOS -1.00 -0.25 90", [...table(0), ...table(300)]);
    expect(result.requiresRescan).toBe(true);
    expect(result.od.sphere).toBeNull();
    expect(result.os.sphere).toBeNull();
  });

  it("rejects duplicate raw rows even if coordinates identify only one table", () => {
    const words = [...tableHeadings(),
      word("OD", 0, 50), word("-2.00", 100, 50), word("-0.50", 200, 50), word("180", 300, 50),
      word("OS", 0, 100), word("-1.00", 100, 100), word("-0.25", 200, 100), word("90", 300, 100),
    ];
    const result = parsePrescriptionScan("OD -2.00 -0.50 180\nOS -1.00 -0.25 90\nOD -3.00 -1.00 175\nOS -1.50 -0.75 85", words);
    expect(result.requiresRescan).toBe(true);
    expect(result.od.sphere).toBeNull();
    expect(result.os.sphere).toBeNull();
  });

  it("rejects two mixed-column raw tables when OCR coordinates recover only one", () => {
    const words = [...tableHeadings(),
      word("OD", 0, 50), word("-2.00", 100, 50), word("-0.50", 200, 50), word("180", 300, 50), word("+2.00", 400, 50),
      word("OS", 0, 100), word("-1.00", 100, 100), word("SPH", 200, 100), word("+2.25", 400, 100),
    ];
    const raw = "Sphere Cylinder Axis Add Prism Base\nOD -2.00 -0.50 180 +2.00\nOS -1.00 SPH +2.25\nSphere Cylinder Axis Add Prism Base\nOD -3.00 -1.00 175 +2.00\nOS -1.50 -0.75 85 +2.00";
    const result = parsePrescriptionScan(raw, words);
    expect(result.requiresRescan).toBe(true);
    expect(result.od).toEqual({ sphere: null, cylinder: null, axis: null, add: null });
    expect(result.os).toEqual({ sphere: null, cylinder: null, axis: null, add: null });
  });

  it("does not count stacked OD / Right eye labels without numbers as duplicate rows", () => {
    const result = parsePrescriptionScan("Sphere Cylinder Axis Add\nOD\nRight Eye\n-2.00 -0.50 180 +2.00\nOS\nLeft Eye\n-1.00 -0.25 90 +2.25");
    expect(result.requiresRescan).toBeUndefined();
    expect(result.od.sphere).toBe(-2);
    expect(result.os.sphere).toBe(-1);
  });

  it("cannot fill a duplicate labelled cell from a cleaner automatic retry", () => {
    const first = parsePrescriptionScan("OD Sphere -2.00/-3.00 Cylinder -0.50 Axis 180\nOS -1.00 -0.25 90");
    const second = parsePrescriptionScan("OD -2.00 -0.50 180\nOS -1.00 -0.25 90");
    expect(combinePrescriptionScanPasses(first, second).od.sphere).toBeNull();
  });

  it("requires manual review when two readings disagree rather than selecting a best value", () => {
    const first = parsePrescriptionScan("OD -2.00 -0.50 180 +2.00\nOS -1.00 -0.25 90 +2.00\nPD: 63");
    const second = parsePrescriptionScan("OD +2.00 -0.50 180 +2.00\nOS -1.00 -0.25 90 +2.00\nPD: 64");
    const result = combinePrescriptionScanPasses(first, second);
    expect(result.od.sphere).toBeNull();
    expect(result.od.cylinder).toBe(-0.5);
    expect(result.pupillaryDistance).toBeNull();
    expect(result.warnings.join(" ")).toContain("disagree");
  });

  it("never fills an ambiguous multiple-prescription scan from a cleaner retry", () => {
    const first = parsePrescriptionScan("OD -2.00 -0.50 180\nOD -3.00 -0.75 170\nOS -1.00 -0.25 90");
    const second = parsePrescriptionScan("OD -2.00 -0.50 180\nOS -1.00 -0.25 90");
    const result = combinePrescriptionScanPasses(first, second);
    expect(result.requiresRescan).toBe(true);
    expect(reviewedScanPrescription(result)).toBeNull();
  });

  it("reads widely spaced eye rows beyond the former fixed header-distance cutoff", () => {
    const words = [...tableHeadings(),
      word("OD", 0, 60), word("-2.00", 100, 60), word("-0.50", 200, 60), word("180", 300, 60),
      word("OS", 0, 450), word("+1.75", 100, 450), word("-0.25", 200, 450), word("35", 300, 450),
    ];
    const result = parsePrescriptionScan("Sphere Cylinder Axis Add Prism Base", words);
    expect(result.od).toEqual({ sphere: -2, cylinder: -0.5, axis: 180, add: null });
    expect(result.os).toEqual({ sphere: 1.75, cylinder: -0.25, axis: 35, add: null });
    const regions = findPrescriptionScanRegions(words)!;
    expect(regions.rows.os!.top).toBeGreaterThan(400);
    expect(regions.table.top + regions.table.height).toBeGreaterThan(450);
    expect(regions.cells.os!.sphere!.top).toBe(regions.rows.os!.top);
    expect(regions.cells.os!.axis!.top).toBeGreaterThan(400);
  });

  it("uses a faint explicit OS label but still rejects a faint numeric cell", () => {
    const words = [...tableHeadings(),
      word("OD", 0, 50), word("-2.00", 100, 50), word("-0.50", 200, 50), word("180", 300, 50),
      word("OS", 0, 100, 12), word("+1.75", 100, 100), word("-0.25", 200, 100, 20), word("35", 300, 100),
    ];
    const result = parsePrescriptionScan("Sphere Cylinder Axis", words);
    expect(result.os.sphere).toBe(1.75);
    expect(result.os.cylinder).toBeNull();
    expect(result.os.axis).toBe(35);
    expect(result.warnings.join(" ")).toContain("eye label was faint");
    expect(result.warnings.join(" ")).toContain("cylinder was difficult");
  });

  it.each(["O5", "QS"])("recognizes the gutter-only OS alias %s without changing numeric characters", (label) => {
    const words = [...tableHeadings(),
      word("OD", 0, 50), word("-2.00", 100, 50), word("-0.50", 200, 50), word("180", 300, 50),
      word(label, 0, 100, 25), word("+1.75", 100, 100), word("-0.25", 200, 100), word("35", 300, 100),
    ];
    const result = parsePrescriptionScan("Sphere Cylinder Axis", words);
    expect(result.os.sphere).toBe(1.75);
    expect(result.warnings.join(" ")).toContain("eye label was faint");
    expect(parsePrescriptionScan(`${label} +1.75 -0.25 35`).os.sphere).toBeNull();
    const malformedNumber = words.map((entry) => entry.text === "+1.75" ? { ...entry, text: "+1.OO" } : entry);
    expect(parsePrescriptionScan("Sphere Cylinder Axis", malformedNumber).os.sphere).toBeNull();
  });

  it("keeps a readable OD without inferring OS from the unlabelled second row", () => {
    const words = [...tableHeadings(),
      word("OD", 0, 50), word("-2.00", 100, 50), word("-0.50", 200, 50), word("180", 300, 50),
      word("+1.75", 100, 100), word("-0.25", 200, 100), word("35", 300, 100),
    ];
    const result = parsePrescriptionScan("Sphere Cylinder Axis", words);
    expect(result.od.sphere).toBe(-2);
    expect(result.os).toEqual({ sphere: null, cylinder: null, axis: null, add: null });
    const regions = findPrescriptionScanRegions(words)!;
    expect(regions.rows.od).toBeDefined();
    expect(regions.rows.os).toBeUndefined();
    expect(regions.cells.od!.sphere).toBeDefined();
    expect(regions.cells.os).toBeUndefined();
    // A full-table local retry still has the chance to read the missing label.
    expect(regions.table.top + regions.table.height).toBeGreaterThanOrEqual(118);
  });

  it("keeps an independently readable OS without demanding a first OD row", () => {
    const words = [...tableHeadings(),
      word("OS", 0, 100), word("+1.75", 100, 100), word("D.S.", 200, 100),
    ];
    const result = parsePrescriptionScan("Sphere Cylinder Axis", words);
    expect(result.od.sphere).toBeNull();
    expect(result.os).toEqual({ sphere: 1.75, cylinder: 0, axis: null, add: null });
    const regions = findPrescriptionScanRegions(words)!;
    expect(regions.rows.od).toBeUndefined();
    expect(regions.cells.od).toBeUndefined();
    expect(regions.cells.os!.sphere).toBeDefined();
  });

  it("rejects duplicate explicit rows even when the other eye label is missing", () => {
    const words = [...tableHeadings(),
      word("OD", 0, 50), word("-2.00", 100, 50), word("-0.50", 200, 50), word("180", 300, 50),
      word("OD", 0, 100), word("-3.00", 100, 100), word("-0.75", 200, 100), word("175", 300, 100),
    ];
    const result = parsePrescriptionScan("Sphere Cylinder Axis", words);
    expect(result.requiresRescan).toBe(true);
    expect(result.od.sphere).toBeNull();
    expect(findPrescriptionScanRegions(words)).toBeNull();
  });

  it("reads an MVE optical table but excludes its separate prism/decentration table", () => {
    // Synthetic values only: the fixture represents printed MVE geometry,
    // not a patient's prescription or identifying information.
    const words = [
      word("Balance", 60, 100, 95, 60), word("Sphere", 150, 100), word("Cylinder", 250, 100), word("Axis", 350, 100),
      word("Add", 450, 100), word("Seg", 550, 100, 95, 25), word("Ht", 580, 100, 95, 20),
      word("OC", 650, 100, 95, 25), word("Ht", 680, 100, 95, 20), word("Far", 750, 100), word("Near", 850, 100),
      word("OD", 0, 150), word("+2.00", 150, 150), word("-0.50", 250, 150), word("035", 350, 150), word("34.0", 750, 150), word("31.5", 850, 150),
      word("OS", 0, 200), word("+1.75", 150, 200), word("D.S.", 250, 200), word("32.5", 750, 200), word("30.0", 850, 200),
      word("Prism", 150, 300), word("Base", 250, 300), word("Dec", 450, 300), word("Inset", 550, 300), word("Vertex", 850, 300),
      word("OD", 0, 350), word("+2.50", 450, 350), word("1.00", 550, 350), word("+3.50", 650, 350),
      word("OS", 0, 400), word("+3.00", 450, 400), word("1.00", 550, 400), word("+4.00", 650, 400),
    ];
    const raw = "OD: Single Vision - CR39 - Clear\nOS: Single Vision - CR39 - Clear\nBalance Sphere Cylinder Axis Add Seg Ht OC Ht Far Near\nOD +2.00 -0.50 035 34.0 31.5\nOS +1.75 D.S. 32.5 30.0\nPrism Base Prism Base Dec Inset Total Dec BC Vertex\nOD +2.50 1.00 +3.50\nOS +3.00 1.00 +4.00";
    const result = parsePrescriptionScan(raw, words);
    expect(result.requiresRescan).toBeUndefined();
    expect(result.od).toEqual({ sphere: 2, cylinder: -0.5, axis: 35, add: null });
    expect(result.os).toEqual({ sphere: 1.75, cylinder: 0, axis: null, add: null });
    expect(result.pupillaryDistance).toBeNull();
    expect(result.warnings.join(" ")).toContain("Prism");
    const regions = findPrescriptionScanRegions(words)!;
    expect(regions.header.left).toBe(0);
    expect(regions.table.top + regions.table.height).toBeLessThan(300);
    expect(regions.rows.os!.top + regions.rows.os!.height).toBeLessThan(300);
    for (const eye of ["od", "os"] as const) {
      for (const cell of Object.values(regions.cells[eye]!)) {
        expect(cell!.left).toBeGreaterThanOrEqual(regions.table.left);
        expect(cell!.left + cell!.width).toBeLessThanOrEqual(regions.table.left + regions.table.width);
        expect(cell!.top + cell!.height).toBeLessThan(300);
      }
      expect(Object.keys(regions.cells[eye]!)).toEqual(["sphere", "cylinder", "axis", "add"]);
    }
    // Without coordinates the mixed table remains unsafe to flatten.
    expect(parsePrescriptionScan(raw).od.sphere).toBeNull();
  });

  it("does not ignore a real second optical table after an auxiliary section", () => {
    const raw = "Balance Sphere Cylinder Axis Add Far Near\nOD +2.00 -0.50 035 34.0 31.5\nOS +1.75 D.S. 32.5 30.0\nPrism Base Dec Inset\nOD +2.50 1.00 +3.50\nOS +3.00 1.00 +4.00\nBalance Sphere Cylinder Axis Add Far Near\nOD +3.00 -0.50 035 34.0 31.5\nOS +2.75 D.S. 32.5 30.0";
    const words = [...tableHeadings(),
      word("OD", 0, 50), word("+2.00", 100, 50), word("-0.50", 200, 50), word("35", 300, 50),
      word("OS", 0, 100), word("+1.75", 100, 100), word("D.S.", 200, 100),
    ];
    const result = parsePrescriptionScan(raw, words);
    expect(result.requiresRescan).toBe(true);
    expect(result.od.sphere).toBeNull();
    expect(result.os.sphere).toBeNull();
  });

  it("stops the optical table before a notes section with other labelled numbers", () => {
    const words = [...tableHeadings(),
      word("OD", 0, 50), word("-2.00", 100, 50), word("-0.50", 200, 50), word("180", 300, 50),
      word("OS", 0, 100), word("-1.00", 100, 100), word("D.S.", 200, 100),
      word("Notes:", 0, 200), word("OD", 0, 250), word("+4.00", 100, 250), word("-1.00", 200, 250), word("170", 300, 250),
    ];
    const result = parsePrescriptionScan("Sphere Cylinder Axis", words);
    expect(result.od.sphere).toBe(-2);
    expect(result.requiresRescan).toBeUndefined();
    expect(findPrescriptionScanRegions(words)!.table.height).toBeLessThan(200);
  });

  it("keeps value and PD disagreements empty through a third automatic reading", () => {
    const first = parsePrescriptionScan("OD -2.00 -0.50 180\nOS -1.00 -0.25 90\nPD: 63");
    const second = parsePrescriptionScan("OD +2.00 -0.50 180\nOS -1.00 -0.25 90\nPD: 64");
    const third = parsePrescriptionScan("OD -2.00 -0.50 180\nOS -1.00 -0.25 90\nPD: 63");
    const result = combinePrescriptionScanPasses(combinePrescriptionScanPasses(first, second), third);
    expect(result.od.sphere).toBeNull();
    expect(result.od.cylinder).toBe(-0.5);
    expect(result.pupillaryDistance).toBeNull();
  });

  it("exports optical cell crops using the same column boundaries without prism cells", () => {
    const words = [...tableHeadings(),
      word("OD", 0, 50), word("-2.00", 100, 50), word("-0.50", 200, 50), word("180", 300, 50), word("+2.00", 400, 50),
      word("OS", 0, 100), word("-1.00", 100, 100), word("D.S.", 200, 100), word("+2.25", 400, 100),
    ];
    const regions = findPrescriptionScanRegions(words)!;
    expect(regions.cells.od!.sphere).toEqual({ left: 64, top: 34, width: 121, height: 50 });
    expect(regions.cells.od!.cylinder).toEqual({ left: 185, top: 34, width: 100, height: 50 });
    expect(regions.cells.od!.axis).toEqual({ left: 285, top: 34, width: 100, height: 50 });
    expect(regions.cells.od!.add).toEqual({ left: 385, top: 34, width: 100, height: 50 });
    expect(regions.cells.os!.cylinder!.top).toBe(84);
    expect(regions.cells.od).not.toHaveProperty("prism");
    expect(regions.cells.od).not.toHaveProperty("base");
    expect(regions.cells.od!.axis!.top + regions.cells.od!.axis!.height).toBeLessThanOrEqual(regions.cells.os!.axis!.top);
  });

  it("does not let an inflated Sphere heading box absorb the first numeric row", () => {
    const box = (text: string, x: number, top: number, bottom: number, width = 90): PrescriptionScanWord => ({
      text, confidence: 90, bbox: { x0: x, y0: top, x1: x + width, y1: bottom },
    });
    const words = [
      box("Sphere", 100, 141, 225), box("Cylinder", 220, 145, 195), box("Axis", 340, 145, 195), box("Add", 460, 145, 195),
      box("OD", 0, 211, 259, 50), box("+2.00", 100, 211, 259), box("-0.50", 220, 211, 259), box("35", 340, 211, 259),
      box("OS", 0, 301, 349, 50), box("+1.75", 100, 301, 349), box("D.S.", 220, 301, 349),
    ];
    const result = parsePrescriptionScan("Sphere Cylinder Axis Add", words);
    expect(result.od).toEqual({ sphere: 2, cylinder: -0.5, axis: 35, add: null });
    expect(result.os).toEqual({ sphere: 1.75, cylinder: 0, axis: null, add: null });
    const regions = findPrescriptionScanRegions(words)!;
    expect(regions).not.toBeNull();
    expect(regions.cells.od!.sphere!.top).toBeLessThan(211);
    expect(regions.cells.os!.sphere!.height).toBeLessThan(160);
  });

  it("ignores a tiny low-confidence numeric speck inside the header band", () => {
    const words = [...tableHeadings(180).map((entry) => ({ ...entry, bbox: { ...entry.bbox, y1: 230 } })),
      { text: "65", confidence: 11, bbox: { x0: 1512, y0: 226, x1: 1573, y1: 227 } },
      word("OD", 0, 280), word("+2.00", 100, 280), word("-0.50", 200, 280), word("35", 300, 280),
      word("OS", 0, 380), word("+1.75", 100, 380), word("D.S.", 200, 380),
    ];
    const result = parsePrescriptionScan("Sphere Cylinder Axis Add Prism Base", words);
    expect(result.od.sphere).toBe(2);
    expect(result.os.sphere).toBe(1.75);
    expect(findPrescriptionScanRegions(words)!.header.width).toBeLessThan(1000);
  });

  it("still rejects a labelled values row as a spatial table heading", () => {
    const words = [word("OD", 0, 100), word("Sphere", 100, 100), word("+2.00", 200, 100),
      word("Cylinder", 300, 100), word("-0.50", 400, 100), word("Axis", 500, 100), word("35", 600, 100),
    ];
    expect(findPrescriptionScanRegions(words)).toBeNull();
    expect(parsePrescriptionScan("Sphere Cylinder Axis", words).od.sphere).toBeNull();
    // Explicit labelled text remains readable, but is not fabricated into
    // a table or a crop region merely to reuse the spatial retry path.
    expect(parsePrescriptionScan("OD Sphere +2.00 Cylinder -0.50 Axis 35", words).od.sphere).toBe(2);
  });

  it("does not compare an unconverted partial plus-cylinder axis with a canonical retry", () => {
    const first = parsePrescriptionScan("OD Cylinder +0.50 Axis 90\nOS Sphere -1.00 Cylinder -0.25 Axis 35");
    expect(first.od).toEqual({ sphere: null, cylinder: null, axis: null, add: null });
    const second = parsePrescriptionScan("OD Sphere +1.00 Cylinder +0.50 Axis 90\nOS Sphere -1.00 Cylinder -0.25 Axis 35");
    expect(second.od).toEqual({ sphere: 1.5, cylinder: -0.5, axis: 180, add: null });
    const result = combinePrescriptionScanPasses(first, second);
    expect(result.od).toEqual(second.od);
    expect(result.warnings.join(" ")).not.toContain("two readings disagree");
    expect(parsePrescriptionScan("OD Sphere +1.00 Cylinder +0.50").od.sphere).toBeNull();
  });

  it("caps an inflated final eye label by the neighboring explicit row spacing", () => {
    const box = (text: string, x: number, top: number, bottom: number): PrescriptionScanWord => ({
      text, confidence: 90, bbox: { x0: x, y0: top, x1: x + 70, y1: bottom },
    });
    const words = [box("Sphere", 100, 140, 184), box("Cylinder", 200, 140, 184), box("Axis", 300, 140, 184),
      box("OD", 0, 184, 224), box("+2.00", 100, 195, 225), box("-0.50", 200, 195, 225), box("35", 300, 195, 225),
      box("OS", 0, 237, 303), box("+1.75", 100, 275, 299), box("D.S.", 200, 275, 299),
      box("65.0", 100, 325, 343),
    ];
    const result = parsePrescriptionScan("Sphere Cylinder Axis", words);
    expect(result.od.sphere).toBe(2);
    expect(result.os).toEqual({ sphere: 1.75, cylinder: 0, axis: null, add: null });
    const cell = findPrescriptionScanRegions(words)!.cells.os!.sphere!;
    expect(cell.top + cell.height).toBe(304);
    expect(cell.height).toBeLessThan(100);
  });

  it("keeps stacked OD/Right and OS/Left aliases associated with their own values", () => {
    const words = [...tableHeadings(),
      word("OD", 0, 50), word("Right", 0, 65), word("-2.00", 100, 50), word("-0.50", 200, 50), word("180", 300, 50),
      word("OS", 0, 130), word("Left", 0, 145), word("+1.75", 100, 130), word("D.S.", 200, 130),
    ];
    const result = parsePrescriptionScan("Sphere Cylinder Axis", words);
    expect(result.requiresRescan).toBeUndefined();
    expect(result.od.sphere).toBe(-2);
    expect(result.os.sphere).toBe(1.75);
    expect(findPrescriptionScanRegions(words)!.cells.os).toBeDefined();
  });

  it("does not clip normal optical glyphs below an upward-shifted final eye label", () => {
    const box = (text: string, left: number, top: number, right: number, bottom: number, confidence = 90): PrescriptionScanWord => ({
      text, confidence, bbox: { x0: left, y0: top, x1: right, y1: bottom },
    });
    // Synthetic optical values, with regression coordinates representing
    // an OCR label box that is taller/upward-shifted relative to its row.
    const words = [
      box("Balance", 180, 140, 250, 184), box("Sphere", 339, 141, 456, 225),
      box("Cylinder", 533, 140, 636, 184), box("Axis", 720, 140, 793, 184), box("Add", 900, 140, 970, 184),
      box("OD", 33, 198, 115, 242), box("+2.00", 339, 206, 456, 251), box("-0.50", 533, 207, 636, 241), box("35", 720, 208, 793, 242),
      box("OS", 33, 237, 115, 303), box("+1.75", 307, 255, 454, 301, 38), box("D.S.", 534, 266, 607, 302, 91),
    ];
    const result = parsePrescriptionScan("Balance Sphere Cylinder Axis Add", words);
    expect(result.od.sphere).toBe(2);
    // Low confidence is allowed for geometry, never for numeric acceptance.
    expect(result.os.sphere).toBeNull();
    expect(result.os.cylinder).toBe(0);
    const regions = findPrescriptionScanRegions(words)!;
    expect(regions.cells.os!.sphere!.top).toBeLessThanOrEqual(255);
    expect(regions.cells.os!.sphere!.top + regions.cells.os!.sphere!.height).toBeGreaterThanOrEqual(303);
    expect(regions.cells.os!.cylinder!.top + regions.cells.os!.cylinder!.height).toBeLessThan(312);
  });

  it.each(["D.S", "D.S.", "D. S", "D. S."])("recognizes explicit spherical cylinder abbreviation %s without requiring a final period", (abbreviation) => {
    const words = [...tableHeadings(),
      word("OS", 0, 100), word("+1.75", 100, 100), word(abbreviation, 200, 100, 91),
    ];
    expect(parsePrescriptionScan("Sphere Cylinder Axis", words).os).toEqual({ sphere: 1.75, cylinder: 0, axis: null, add: null });
    expect(parsePrescriptionScan(`OS Sphere +1.75 Cylinder ${abbreviation}`).os.cylinder).toBe(0);
  });

  it.each(["D.S5", "D.S extra", "D.S/2.00", "D.S.x"])("still rejects an unclear spherical abbreviation cell: %s", (cell) => {
    const words = [...tableHeadings(), word("OS", 0, 100), word("+1.75", 100, 100), word(cell, 200, 100, 91)];
    expect(parsePrescriptionScan("Sphere Cylinder Axis", words).os.cylinder).toBeNull();
    expect(parsePrescriptionScan(`OS Sphere +1.75 Cylinder ${cell}`).os.cylinder).toBeNull();
  });

  it("cannot select one of multiple complete spatial cell values from a cleaner retry", () => {
    const base = [...tableHeadings(),
      word("OD", 0, 50), word("-0.50", 200, 50), word("180", 300, 50),
      word("OS", 0, 100), word("-1.00", 100, 100), word("D.S", 200, 100),
    ];
    const first = parsePrescriptionScan("Sphere Cylinder Axis", [...base, word("-2.00", 100, 50, 95, 35), word("-3.00", 145, 50, 95, 35)]);
    const second = parsePrescriptionScan("Sphere Cylinder Axis", [...base, word("-2.00", 100, 50)]);
    expect(first.od.sphere).toBeNull();
    expect(first.warnings.join(" ")).toContain("sphere has duplicate or unclear");
    expect(second.od.sphere).toBe(-2);
    expect(combinePrescriptionScanPasses(first, second).od.sphere).toBeNull();
    expect(combinePrescriptionScanPasses(combinePrescriptionScanPasses(first, second), second).od.sphere).toBeNull();
  });

  it.each(["-2.OO", "-2.00?"])("still allows a retry of one spatial value with ordinary unclear characters: %s", (text) => {
    const base = [...tableHeadings(),
      word("OD", 0, 50), word("-0.50", 200, 50), word("180", 300, 50),
      word("OS", 0, 100), word("-1.00", 100, 100), word("D.S", 200, 100),
    ];
    const first = parsePrescriptionScan("Sphere Cylinder Axis", [...base, word(text, 100, 50)]);
    const second = parsePrescriptionScan("Sphere Cylinder Axis", [...base, word("-2.00", 100, 50)]);
    expect(first.od.sphere).toBeNull();
    expect(first.warnings.join(" ")).not.toContain("sphere has duplicate or unclear");
    expect(combinePrescriptionScanPasses(first, second).od.sphere).toBe(-2);
  });

  const tiltedTable = (slope: number): PrescriptionScanWord[] => {
    const tilted = (text: string, x: number, y: number, height = 18): PrescriptionScanWord => ({
      text, confidence: 95, bbox: { x0: x, y0: 100 + y + slope * x, x1: x + 50, y1: 100 + y + slope * x + height },
    });
    return [tilted("Sphere", 100, 0, 40), tilted("Cylinder", 150, 0, 40), tilted("Axis", 400, 0, 40),
      tilted("OD", 0, 70), tilted("-2.00", 100, 70), tilted("-0.50", 150, 70), tilted("180", 400, 70),
      tilted("OS", 0, 100), tilted("-1.00", 100, 100), tilted("-0.25", 150, 100), tilted("90", 400, 100),
    ];
  };

  it.each([0.08, -0.08])("refuses tilted geometry before an axis can cross into the other eye (slope %s)", (slope) => {
    const words = tiltedTable(slope);
    const result = parsePrescriptionScan("Sphere Cylinder Axis\nOD -2.00 -0.50 180\nOS -1.00 -0.25 90\nPD: 63", words);
    expect(result.requiresAlignment).toBe(true);
    expect(result.requiresRescan).toBeUndefined();
    expect(result.od).toEqual({ sphere: null, cylinder: null, axis: null, add: null });
    expect(result.os).toEqual({ sphere: null, cylinder: null, axis: null, add: null });
    expect(result.pupillaryDistance).toBeNull();
    expect(findPrescriptionScanRegions(words)).toBeNull();
  });

  it("allows a genuinely aligned reading to replace a blank alignment failure", () => {
    const first = parsePrescriptionScan("Sphere Cylinder Axis", tiltedTable(0.08));
    const second = parsePrescriptionScan("Sphere Cylinder Axis\nPD: 63", tiltedTable(0));
    expect(second.hasAlignedTable).toBe(true);
    const result = combinePrescriptionScanPasses(first, second);
    expect(result.requiresAlignment).toBeUndefined();
    expect(result.od.axis).toBe(180);
    expect(result.os.axis).toBe(90);
    expect(result.pupillaryDistance?.binocular).toBe("63");
    expect(result.warnings.join(" ")).not.toContain("Photo appears tilted");
    expect(combinePrescriptionScanPasses(second, first).od).toEqual(second.od);
    expect(combinePrescriptionScanPasses(first, first).requiresAlignment).toBe(true);
    const multiple = parsePrescriptionScan("OD -2.00 -0.50 180\nOD -3.00 -0.75 175\nOS -1.00 -0.25 90", tiltedTable(0.08));
    const blocked = combinePrescriptionScanPasses(multiple, second);
    expect(blocked.requiresRescan).toBe(true);
    expect(blocked.os.axis).toBeNull();
  });

  it.each(["", "OD -2.00 -0.50 180\nOS -1.00 -0.25 90\nPD: 63"])("keeps alignment failure blank when another pass lacks aligned table evidence: %s", (rawText) => {
    const tilted = parsePrescriptionScan("Sphere Cylinder Axis", tiltedTable(0.08));
    const unproven = parsePrescriptionScan(rawText);
    expect(unproven.hasAlignedTable).toBeUndefined();
    for (const result of [combinePrescriptionScanPasses(tilted, unproven), combinePrescriptionScanPasses(unproven, tilted)]) {
      expect(result.requiresAlignment).toBe(true);
      expect(result.hasAlignedTable).toBeUndefined();
      expect(result.od.sphere).toBeNull();
      expect(result.os.axis).toBeNull();
      expect(result.pupillaryDistance).toBeNull();
      expect(result.warnings.join(" ")).toContain("Photo appears tilted");
    }
  });

  it("requires a visible eye row as well as aligned headings for recovery evidence", () => {
    const tilted = parsePrescriptionScan("Sphere Cylinder Axis", tiltedTable(0.08));
    const headingsOnly = parsePrescriptionScan("OD -2.00 -0.50 180\nOS -1.00 -0.25 90", tiltedTable(0).slice(0, 3));
    expect(headingsOnly.hasAlignedTable).toBeUndefined();
    expect(combinePrescriptionScanPasses(tilted, headingsOnly).requiresAlignment).toBe(true);
  });

  it("retains multiple-table refusal when one spatial table is tilted but raw text omits it", () => {
    const secondTable = tiltedTable(0.08).map((entry) => ({ ...entry, bbox: { ...entry.bbox, y0: entry.bbox.y0 + 400, y1: entry.bbox.y1 + 400 } }));
    const words = [...tiltedTable(0), ...secondTable];
    const result = parsePrescriptionScan("Sphere Cylinder Axis\nOD -2.00 -0.50 180\nOS -1.00 -0.25 90", words);
    expect(result.requiresAlignment).toBe(true);
    expect(result.requiresRescan).toBe(true);
    expect(result.hasAlignedTable).toBeUndefined();
    expect(findPrescriptionScanRegions(words)).toBeNull();
    const aligned = parsePrescriptionScan("Sphere Cylinder Axis", tiltedTable(0));
    expect(combinePrescriptionScanPasses(result, aligned).requiresRescan).toBe(true);
    expect(combinePrescriptionScanPasses(result, aligned).os.axis).toBeNull();
  });

  it("permits negligible heading slope while retaining both explicit eye rows", () => {
    const result = parsePrescriptionScan("Sphere Cylinder Axis", tiltedTable(0.01));
    expect(result.requiresAlignment).toBeUndefined();
    expect(result.od.axis).toBe(180);
    expect(result.os.axis).toBe(90);
  });

  it("does not use pure grid punctuation as a column midpoint neighbor", () => {
    const words = [...tableHeadings(), word("|", 160, 0, 95, 2), word("_", 280, 0, 95, 2),
      word("OD", 0, 50), word("-2.00", 150, 50, 95, 30), word("-0.50", 200, 50), word("180", 300, 50),
      word("OS", 0, 100), word("-1.00", 150, 100, 95, 30), word("D.S", 200, 100),
    ];
    const result = parsePrescriptionScan("Sphere Cylinder Axis", words);
    expect(result.od.sphere).toBe(-2);
    expect(result.os.sphere).toBe(-1);
    expect(findPrescriptionScanRegions(words)!.cells.od!.sphere!.width).toBe(121);
  });

  it("withholds an entire eye when one inflated label spans multiple numeric row baselines", () => {
    const words = tableHeadings(10).map((entry) => ({ ...entry, bbox: { ...entry.bbox, y1: 50 } }));
    words.push({ text: "OS", confidence: 90, bbox: { x0: 0, y0: 103, x1: 55, y1: 160 } },
      word("-2.00", 100, 70), word("-0.50", 200, 70), word("180", 300, 70),
      word("-1.00", 100, 140), word("D.S", 200, 140));
    const result = parsePrescriptionScan("Sphere Cylinder Axis\nOS Sphere -1.00 Cylinder D.S\nPD: 63", words);
    expect(result.requiresRowReview).toBe(true);
    expect(result.requiresRescan).toBe(true);
    expect(result.os).toEqual({ sphere: null, cylinder: null, axis: null, add: null });
    expect(result.pupillaryDistance).toBeNull();
    expect(findPrescriptionScanRegions(words)).toBeNull();
    const cleaner = parsePrescriptionScan("OS Sphere -1.00 Cylinder D.S");
    expect(combinePrescriptionScanPasses(result, cleaner).os.cylinder).toBeNull();
  });

  it("does not mistake same-baseline sign/decimal fragments for two unlabelled rows", () => {
    const words = [...tableHeadings(), word("OS", 0, 100),
      word("+", 100, 100, 95, 8), word("1", 112, 100, 95, 8), word(".", 123, 100, 95, 4), word("75", 130, 100, 95, 25),
      word("D.S", 200, 100),
    ];
    const result = parsePrescriptionScan("Sphere Cylinder Axis", words);
    expect(result.requiresRowReview).toBeUndefined();
    expect(result.os).toEqual({ sphere: 1.75, cylinder: 0, axis: null, add: null });
    expect(findPrescriptionScanRegions(words)!.rows.os).toBeDefined();
  });

  const mergedTable = (heading: PrescriptionScanWord): PrescriptionScanWord[] => [heading,
    word("Axis", 360, 0), word("Add", 460, 0), word("Prism", 560, 0),
    word("OD", 0, 50), word("+2.00", 160, 50, 95, 50), word("D.S.", 260, 50, 95, 50), word("+2.50", 460, 50),
    word("OS", 0, 100), word("+1.75", 160, 100, 95, 50), word("-0.25", 260, 100, 95, 50), word("35", 360, 100), word("+2.50", 460, 100),
  ];

  it("recovers merged Balance/Sphere/Cylinder headings only from actual high-confidence character boxes", () => {
    const heading = mergedHeading([["Balance", 40], ["Sphere", 160], ["Cylinder", 260]]);
    heading.text = `‘${heading.text}`;
    heading.bbox.x0 -= 4;
    heading.symbols!.unshift({ text: "‘", confidence: 70, bbox: { x0: 36, y0: 0, x1: 38, y1: 18 } });
    const words = mergedTable(heading);
    const result = parsePrescriptionScan("Balance|Sphere|Cylinder| Axis Add Prism", words);
    expect(result.od).toEqual({ sphere: 2, cylinder: 0, axis: null, add: 2.5 });
    expect(result.os).toEqual({ sphere: 1.75, cylinder: -0.25, axis: 35, add: 2.5 });
    expect(result.hasAlignedTable).toBe(true);
    const regions = findPrescriptionScanRegions(words)!;
    // Letter envelopes produce these real centers; proportional splitting
    // of the whole word would put the Balance/Sphere midpoint elsewhere.
    expect(regions.cells.od!.sphere!.left).toBe(125);
    expect(regions.cells.od!.sphere!.width).toBe(113);
  });

  it("accepts adjacent exact heading terms when observed symbols supply separate positions", () => {
    const heading = mergedHeading([["Sphere", 160], ["Cylinder", 260]], 0, "");
    const result = parsePrescriptionScan("SphereCylinder Axis Add Prism", mergedTable(heading));
    expect(result.od.sphere).toBe(2);
    expect(result.os.axis).toBe(35);
  });

  it.each(["inflated letter", "overlapping grid punctuation"])("uses unchanged heading envelopes despite %s boxes", (failure) => {
    const heading = mergedHeading([["Balance", 40], ["Sphere", 160], ["Cylinder", 260]]);
    const expectedRegions = findPrescriptionScanRegions(mergedTable(heading));
    if (failure === "inflated letter") {
      // The last Sphere 'e' starts before 'h', but stays inside the same
      // observed heading envelope. Do not invent replacement letter boxes.
      const letter = heading.symbols![13];
      expect(letter.text).toBe("e");
      letter.bbox.x0 = 160;
    } else {
      // A detected vertical table rule may span the next heading's letters.
      const separator = heading.symbols![7];
      expect(separator.text).toBe("|");
      separator.bbox.x1 = 300;
    }
    const words = mergedTable(heading);
    const before = JSON.stringify(words);
    const result = parsePrescriptionScan("Balance|Sphere|Cylinder| Axis Add Prism", words);
    expect(result.od).toEqual({ sphere: 2, cylinder: 0, axis: null, add: 2.5 });
    expect(result.os).toEqual({ sphere: 1.75, cylinder: -0.25, axis: 35, add: 2.5 });
    expect(result.hasAlignedTable).toBe(true);
    expect(findPrescriptionScanRegions(words)).toEqual(expectedRegions);
    expect(JSON.stringify(words)).toBe(before);
  });

  it.each(["crossing letter", "reversed headings"])("refuses merged headings with %s envelopes", (failure) => {
    const heading = mergedHeading([["Balance", 40], ["Sphere", 160], ["Cylinder", 260]]);
    if (failure === "crossing letter") {
      heading.symbols![13].bbox.x1 = 300;
    } else {
      // Move the entire Cylinder envelope before Sphere, within the parent.
      for (const symbol of heading.symbols!.slice(15)) {
        symbol.bbox.x0 -= 140;
        symbol.bbox.x1 -= 140;
      }
    }
    const words = mergedTable(heading);
    expect(findPrescriptionScanRegions(words)).toBeNull();
    const result = parsePrescriptionScan("Balance|Sphere|Cylinder| Axis Add Prism", words);
    expect(result.hasAlignedTable).toBeUndefined();
    expect(result.od).toEqual({ sphere: null, cylinder: null, axis: null, add: null });
    expect(result.os).toEqual({ sphere: null, cylinder: null, axis: null, add: null });
  });

  it.each(["missing", "low confidence", "missing confidence", "outside word", "nonfinite", "zero height", "reordered", "text mismatch"])("refuses a merged heading with %s symbol evidence", (failure) => {
    const heading = mergedHeading([["Balance", 40], ["Sphere", 160], ["Cylinder", 260]]);
    const symbol = heading.symbols!.find((item) => item.text === "S")!;
    if (failure === "missing") delete heading.symbols;
    if (failure === "low confidence") symbol.confidence = 89;
    if (failure === "missing confidence") delete symbol.confidence;
    if (failure === "outside word") symbol.bbox.y0 = -1;
    if (failure === "nonfinite") symbol.bbox.x0 = Number.NaN;
    if (failure === "zero height") symbol.bbox.y1 = symbol.bbox.y0;
    if (failure === "reordered") symbol.bbox.x0 = 50;
    if (failure === "text mismatch") symbol.text = "5";
    const words = mergedTable(heading);
    expect(findPrescriptionScanRegions(words)).toBeNull();
    expect(parsePrescriptionScan("Balance Sphere Cylinder Axis Add Prism", words).od.sphere).toBeNull();
  });

  it.each([
    { terms: [["Mystery", 40], ["Sphere", 160], ["Cylinder", 260]] },
    { terms: [["Sphere1", 160], ["Cylinder", 260]] },
  ])("does not split unknown or numeric heading text", ({ terms }) => {
    const words = mergedTable(mergedHeading(terms as [string, number][]));
    expect(findPrescriptionScanRegions(words)).toBeNull();
    expect(parsePrescriptionScan("Balance Sphere Cylinder Axis Add Prism", words).od.sphere).toBeNull();
  });

  it("does not transform numerical cells even when they carry character geometry", () => {
    const words = mergedTable(mergedHeading([["Balance", 40], ["Sphere", 160], ["Cylinder", 260]]));
    const sphere = words.find((entry) => entry.text === "+1.75")!;
    sphere.text = "+1.75/-2.00";
    sphere.symbols = [...sphere.text].map((text, index) => ({ text, confidence: 98,
      bbox: { x0: 160 + index * 4, y0: 100, x1: 163 + index * 4, y1: 118 },
    }));
    const result = parsePrescriptionScan("Balance Sphere Cylinder Axis Add Prism", words);
    expect(result.os.sphere).toBeNull();
    expect(result.warnings.join(" ")).toContain("sphere has duplicate or unclear");
    expect(sphere.text).toBe("+1.75/-2.00");
  });

  it("keeps duplicate and tilted table guards after splitting observed heading symbols", () => {
    const duplicate = mergedTable(mergedHeading([["Sphere", 100], ["Sphere", 200], ["Cylinder", 280]]));
    expect(findPrescriptionScanRegions(duplicate)).toBeNull();
    expect(parsePrescriptionScan("", duplicate).od.sphere).toBeNull();
    const tilted = mergedHeading([["Sphere", 100], ["Cylinder", 250], ["Axis", 400]]);
    for (const symbol of tilted.symbols!) {
      symbol.bbox.y0 += symbol.bbox.x0 * 0.08;
      symbol.bbox.y1 += symbol.bbox.x0 * 0.08;
    }
    tilted.bbox.y0 = Math.min(...tilted.symbols!.map((symbol) => symbol.bbox.y0));
    tilted.bbox.y1 = Math.max(...tilted.symbols!.map((symbol) => symbol.bbox.y1));
    const words = [tilted, word("OD", 0, 90), word("-2.00", 100, 90), word("-0.50", 250, 90), word("180", 400, 90)];
    const result = parsePrescriptionScan("OD -2.00 -0.50 180", words);
    expect(result.requiresAlignment).toBe(true);
    expect(result.od.sphere).toBeNull();
    expect(findPrescriptionScanRegions(words)).toBeNull();
  });
});

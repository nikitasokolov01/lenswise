import { describe, expect, it } from "vitest";
import { combinePrescriptionScanPasses, parsePrescriptionScan, reviewedScanPrescription, type PrescriptionScanWord } from "@/lib/prescriptionScan";

const word = (text: string, x: number, y: number, confidence = 95, width = 70): PrescriptionScanWord => ({
  text, confidence, bbox: { x0: x, y0: y, x1: x + width, y1: y + 18 },
});
const tableHeadings = (offset = 0): PrescriptionScanWord[] => [
  word("Sphere", 100, offset), word("Cylinder", 200, offset), word("Axis", 300, offset),
  word("Add", 400, offset), word("Prism", 500, offset), word("Base", 600, offset),
];

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
});

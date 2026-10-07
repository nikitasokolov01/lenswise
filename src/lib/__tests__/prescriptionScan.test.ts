import { describe, expect, it } from "vitest";
import { parsePrescriptionScan, reviewedScanPrescription } from "@/lib/prescriptionScan";

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
    expect(result.os.sphere).toBe(-1);
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
});

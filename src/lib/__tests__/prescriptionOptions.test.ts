import { describe, expect, it } from "vitest";
import {
  SPHERE_VALUES,
  CYLINDER_VALUES,
  AXIS_VALUES,
  ADD_VALUES,
  formatSphere,
  formatCylinder,
  formatAxis,
  formatAdd,
  isValidEyePrescription,
  isValidPrescription,
  createBlankEyeValues,
  createBlankPrescription,
  formatPrescriptionSummaryLines,
} from "@/lib/prescriptionOptions";
import type { PrescriptionEyeValues, PrescriptionInput } from "@/lib/types";

describe("prescriptionOptions", () => {
  describe("option ranges", () => {
    it("sphere runs -20.00 through +20.00 in 0.25 steps", () => {
      expect(SPHERE_VALUES[0]).toBe(-20);
      expect(SPHERE_VALUES[SPHERE_VALUES.length - 1]).toBe(20);
      expect(SPHERE_VALUES).toContain(0);
      expect(SPHERE_VALUES.length).toBe(161); // (20 - -20) / 0.25 + 1
    });

    it("cylinder runs -8.00 through 0.00 (minus-cylinder notation only) in 0.25 steps", () => {
      expect(CYLINDER_VALUES[0]).toBe(-8);
      expect(CYLINDER_VALUES[CYLINDER_VALUES.length - 1]).toBe(0);
      expect(CYLINDER_VALUES.every((value) => value <= 0)).toBe(true);
      expect(CYLINDER_VALUES.length).toBe(33);
    });

    it("axis runs 1 through 180 as whole numbers", () => {
      expect(AXIS_VALUES[0]).toBe(1);
      expect(AXIS_VALUES[AXIS_VALUES.length - 1]).toBe(180);
      expect(AXIS_VALUES.length).toBe(180);
    });

    it("add runs 0.75 through 4.00 in 0.25 steps", () => {
      expect(ADD_VALUES[0]).toBe(0.75);
      expect(ADD_VALUES[ADD_VALUES.length - 1]).toBe(4.0);
      expect(ADD_VALUES.length).toBe(14);
    });
  });

  describe("formatSphere", () => {
    it("displays zero as SPH", () => {
      expect(formatSphere(0)).toBe("SPH");
    });

    it("always shows two decimals with an explicit sign", () => {
      expect(formatSphere(-2.5)).toBe("-2.50");
      expect(formatSphere(-2.25)).toBe("-2.25");
      expect(formatSphere(-0.25)).toBe("-0.25");
      expect(formatSphere(0.25)).toBe("+0.25");
      expect(formatSphere(1)).toBe("+1.00");
      expect(formatSphere(2.5)).toBe("+2.50");
    });

    it("never renders a bare number without a sign or missing decimals", () => {
      expect(formatSphere(-2.5)).not.toBe("-2.5");
      expect(formatSphere(2.5)).not.toBe("2.5");
      expect(formatSphere(0)).not.toBe("0");
      expect(formatSphere(0)).not.toBe("0.0");
    });
  });

  describe("formatCylinder", () => {
    it("displays zero as CYL", () => {
      expect(formatCylinder(0)).toBe("CYL");
    });

    it("always shows two decimals in minus-cylinder notation", () => {
      expect(formatCylinder(-3)).toBe("-3.00");
      expect(formatCylinder(-2.5)).toBe("-2.50");
      expect(formatCylinder(-2)).toBe("-2.00");
      expect(formatCylinder(-1.75)).toBe("-1.75");
      expect(formatCylinder(-0.25)).toBe("-0.25");
    });

    it("never renders a truncated decimal", () => {
      expect(formatCylinder(-2.5)).not.toBe("-2.5");
    });
  });

  describe("formatAxis", () => {
    it("shows a whole number with no decimals", () => {
      expect(formatAxis(90)).toBe("90");
      expect(formatAxis(180)).toBe("180");
      expect(formatAxis(1)).toBe("1");
    });

    it("shows a placeholder when null", () => {
      expect(formatAxis(null)).toBe("—");
    });
  });

  describe("formatAdd", () => {
    it("shows None when not set", () => {
      expect(formatAdd(null)).toBe("None");
    });

    it("always shows two decimals with an explicit plus sign", () => {
      expect(formatAdd(2)).toBe("+2.00");
      expect(formatAdd(0.75)).toBe("+0.75");
      expect(formatAdd(1.25)).toBe("+1.25");
    });
  });

  describe("isValidEyePrescription", () => {
    it("is valid when cylinder is CYL / 0.00 and axis is cleared", () => {
      const eye: PrescriptionEyeValues = { sphere: -1, cylinder: 0, axis: null, add: null };
      expect(isValidEyePrescription(eye)).toBe(true);
    });

    it("is invalid when cylinder is CYL / 0.00 but an axis is somehow still set", () => {
      const eye: PrescriptionEyeValues = { sphere: -1, cylinder: 0, axis: 90, add: null };
      expect(isValidEyePrescription(eye)).toBe(false);
    });

    it("is invalid when cylinder is non-zero and axis is missing", () => {
      const eye: PrescriptionEyeValues = { sphere: -1, cylinder: -2.25, axis: null, add: null };
      expect(isValidEyePrescription(eye)).toBe(false);
    });

    it("is valid when cylinder is non-zero and axis is within 1-180", () => {
      const eye: PrescriptionEyeValues = { sphere: -1, cylinder: -2.25, axis: 180, add: null };
      expect(isValidEyePrescription(eye)).toBe(true);
    });

    it("is invalid when axis is out of the 1-180 range", () => {
      const tooLow: PrescriptionEyeValues = { sphere: 0, cylinder: -1, axis: 0, add: null };
      const tooHigh: PrescriptionEyeValues = { sphere: 0, cylinder: -1, axis: 181, add: null };
      expect(isValidEyePrescription(tooLow)).toBe(false);
      expect(isValidEyePrescription(tooHigh)).toBe(false);
    });
  });

  describe("isValidPrescription", () => {
    it("requires both eyes to be individually valid", () => {
      const valid: PrescriptionInput = {
        od: { sphere: -2, cylinder: -1, axis: 90, add: null },
        os: { sphere: -2, cylinder: 0, axis: null, add: null },
      };
      expect(isValidPrescription(valid)).toBe(true);

      const invalid: PrescriptionInput = {
        od: { sphere: -2, cylinder: -1, axis: null, add: null }, // missing required axis
        os: { sphere: -2, cylinder: 0, axis: null, add: null },
      };
      expect(isValidPrescription(invalid)).toBe(false);
    });
  });

  describe("createBlankEyeValues / createBlankPrescription", () => {
    it("default to SPH/CYL (0) with no axis and no add", () => {
      expect(createBlankEyeValues()).toEqual({ sphere: 0, cylinder: 0, axis: null, add: null });
      expect(createBlankPrescription()).toEqual({
        od: { sphere: 0, cylinder: 0, axis: null, add: null },
        os: { sphere: 0, cylinder: 0, axis: null, add: null },
      });
    });

    it("a freshly created blank prescription is itself valid (no cylinder means no axis is required)", () => {
      expect(isValidPrescription(createBlankPrescription())).toBe(true);
    });
  });

  describe("formatPrescriptionSummaryLines", () => {
    it("matches the compact OD/OS/ADD format, combining a shared ADD line when both eyes match", () => {
      const prescription: PrescriptionInput = {
        od: { sphere: -2, cylinder: -2.5, axis: 180, add: 2 },
        os: { sphere: -1.5, cylinder: -1.25, axis: 175, add: 2 },
      };

      expect(formatPrescriptionSummaryLines(prescription)).toEqual([
        "OD  -2.00 -2.50 × 180",
        "OS  -1.50 -1.25 × 175",
        "ADD +2.00",
      ]);
    });

    it("shows separate per-eye ADD lines when OD and OS add power differ", () => {
      const prescription: PrescriptionInput = {
        od: { sphere: -2, cylinder: 0, axis: null, add: 2 },
        os: { sphere: -1.5, cylinder: 0, axis: null, add: 1.75 },
      };

      const lines = formatPrescriptionSummaryLines(prescription);
      expect(lines).toContain("OD ADD +2.00");
      expect(lines).toContain("OS ADD +1.75");
    });

    it("omits the ADD line entirely when neither eye has an add power", () => {
      const prescription: PrescriptionInput = {
        od: { sphere: -2, cylinder: 0, axis: null, add: null },
        os: { sphere: -1.5, cylinder: 0, axis: null, add: null },
      };

      const lines = formatPrescriptionSummaryLines(prescription);
      expect(lines.some((line) => line.includes("ADD"))).toBe(false);
    });

    it("omits the axis marker (×) when cylinder is CYL / 0.00", () => {
      const prescription: PrescriptionInput = {
        od: { sphere: -2, cylinder: 0, axis: null, add: null },
        os: { sphere: -1.5, cylinder: 0, axis: null, add: null },
      };

      const lines = formatPrescriptionSummaryLines(prescription);
      expect(lines[0]).toBe("OD  -2.00 CYL");
      expect(lines[1]).toBe("OS  -1.50 CYL");
    });
  });
});

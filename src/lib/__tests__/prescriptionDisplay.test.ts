import { describe, expect, it } from "vitest";
import {
  derivePrescriptionForDisplay,
  prescriptionHasAdd,
  toggledDisplayMode,
} from "@/lib/prescriptionDisplay";
import type { PrescriptionInput } from "@/lib/types";

function rx(): PrescriptionInput {
  return {
    od: { sphere: -2.0, cylinder: -1.0, axis: 90, add: 2.0 },
    os: { sphere: -1.5, cylinder: 0, axis: null, add: 2.0 },
  };
}

describe("prescriptionDisplay", () => {
  it("original mode returns the prescription unchanged and never mutates the input", () => {
    const input = rx();
    const snapshot = JSON.parse(JSON.stringify(input));
    const result = derivePrescriptionForDisplay(input, "original");

    expect(result.label).toBe("Original Prescription");
    expect(result.prescription).toEqual(input);
    // The applied prescription object must be untouched.
    expect(input).toEqual(snapshot);
  });

  it("reading adds the full ADD to sphere, hides ADD, and keeps cylinder/axis", () => {
    const input = rx();
    const snapshot = JSON.parse(JSON.stringify(input));
    const result = derivePrescriptionForDisplay(input, "reading");

    expect(result.label).toBe("Reading Prescription");
    expect(result.prescription.od.sphere).toBe(0); // -2.00 + 2.00
    expect(result.prescription.os.sphere).toBe(0.5); // -1.50 + 2.00
    expect(result.prescription.od.add).toBeNull();
    expect(result.prescription.os.add).toBeNull();
    expect(result.prescription.od.cylinder).toBe(-1.0);
    expect(result.prescription.od.axis).toBe(90);
    // Original untouched.
    expect(input).toEqual(snapshot);
  });

  it("computer adds half the ADD to sphere and hides ADD", () => {
    const result = derivePrescriptionForDisplay(rx(), "computer");
    expect(result.label).toBe("Computer Prescription");
    expect(result.prescription.od.sphere).toBe(-1.0); // -2.00 + 2.00/2
    expect(result.prescription.os.sphere).toBe(-0.5); // -1.50 + 2.00/2
    expect(result.prescription.od.add).toBeNull();
  });

  it("prescriptionHasAdd reflects whether either eye has an ADD", () => {
    expect(prescriptionHasAdd(rx())).toBe(true);
    expect(
      prescriptionHasAdd({
        od: { sphere: -1, cylinder: 0, axis: null, add: null },
        os: { sphere: -1, cylinder: 0, axis: null, add: null },
      })
    ).toBe(false);
    expect(prescriptionHasAdd(null)).toBe(false);
  });

  it("toggling is reversible and switches between calculated modes", () => {
    expect(toggledDisplayMode("original", "reading")).toBe("reading");
    expect(toggledDisplayMode("reading", "reading")).toBe("original");
    expect(toggledDisplayMode("original", "computer")).toBe("computer");
    expect(toggledDisplayMode("computer", "computer")).toBe("original");
    // From one calculated mode to the other.
    expect(toggledDisplayMode("computer", "reading")).toBe("reading");
    expect(toggledDisplayMode("reading", "computer")).toBe("computer");
  });
});

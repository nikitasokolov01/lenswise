import { describe, expect, it } from "vitest";
import { formatPupillaryDistance, sanitizePupillaryDistanceValue } from "@/lib/pupillaryDistance";

describe("sanitizePupillaryDistanceValue", () => {
  it("allows two whole-number digits and one decimal digit", () => {
    expect(sanitizePupillaryDistanceValue("31.5")).toBe("31.5");
    expect(sanitizePupillaryDistanceValue("123.45")).toBe("12.4");
  });

  it("removes letters and additional decimal points", () => {
    expect(sanitizePupillaryDistanceValue("6a3")).toBe("63");
    expect(sanitizePupillaryDistanceValue("31..55")).toBe("31.5");
  });
});

describe("formatPupillaryDistance", () => {
  it("formats the active one-number value", () => {
    expect(
      formatPupillaryDistance({ mode: "binocular", binocular: "63", right: "31.5", left: "31.5" })
    ).toBe("63");
  });

  it("labels right and left values for a two-number PD", () => {
    expect(
      formatPupillaryDistance({ mode: "monocular", binocular: "", right: "31.5", left: "31.5" })
    ).toBe("OD 31.5 / OS 31.5");
  });
});

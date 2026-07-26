import { describe, expect, it } from "vitest";
import { safeLocationReturnPath } from "@/lib/locations/navigation";

describe("safeLocationReturnPath", () => {
  it("keeps normal internal application paths", () => {
    expect(safeLocationReturnPath("/inventory")).toBe("/inventory");
    expect(safeLocationReturnPath("/settings?section=organization")).toBe(
      "/settings?section=organization"
    );
  });

  it("rejects external, protocol-relative, and header-injection paths", () => {
    expect(safeLocationReturnPath("https://example.com")).toBe("/app");
    expect(safeLocationReturnPath("//example.com")).toBe("/app");
    expect(safeLocationReturnPath("/app\r\nLocation: https://example.com")).toBe(
      "/app"
    );
    expect(safeLocationReturnPath(null)).toBe("/app");
  });
});

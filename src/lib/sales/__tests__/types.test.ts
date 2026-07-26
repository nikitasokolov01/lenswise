import { describe, expect, it } from "vitest";
import { formatCardBrand, formatSalePayment } from "@/lib/sales/types";

describe("sale payment labels", () => {
  it("formats all supported card brands", () => {
    expect(formatCardBrand("visa")).toBe("Visa");
    expect(formatCardBrand("mastercard")).toBe("Mastercard");
    expect(formatCardBrand("amex")).toBe("American Express");
    expect(formatCardBrand("discover")).toBe("Discover");
  });

  it("keeps cash distinct from card payments", () => {
    expect(formatSalePayment("cash", null)).toBe("Cash");
    expect(formatSalePayment("card", "visa")).toBe("Visa card");
  });
});


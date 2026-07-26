import { describe, expect, it } from "vitest";
import { frameInventoryValuesFromFormData } from "@/lib/inventory/validation";

function validFormData() {
  const form = new FormData();
  form.set("brand", "Ray-Ban");
  form.set("model", "RX5228");
  form.set("color", "Black");
  form.set("eyeSizeMm", "53");
  form.set("bridgeSizeMm", "17");
  form.set("templeLengthMm", "140");
  form.set("sku", "RB-5228-2000");
  form.set("upc", "");
  form.set("wholesaleCost", "92.50");
  form.set("retailPrice", "210");
  form.set("quantityOnHand", "3");
  form.set("reorderLevel", "1");
  form.set("notes", "");
  return form;
}

describe("frameInventoryValuesFromFormData", () => {
  it("normalizes frame form values and converts money to integer cents", () => {
    const result = frameInventoryValuesFromFormData(validFormData());
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.retail_price_cents).toBe(21000);
    expect(result.data.wholesale_cost_cents).toBe(9250);
    expect(result.data.eye_size_mm).toBe(53);
  });

  it("rejects impossible frame dimensions and negative stock", () => {
    const form = validFormData();
    form.set("eyeSizeMm", "120");
    form.set("quantityOnHand", "-1");

    expect(frameInventoryValuesFromFormData(form).success).toBe(false);
  });
});

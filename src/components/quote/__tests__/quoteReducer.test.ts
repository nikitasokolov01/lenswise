import { describe, expect, it } from "vitest";
import { quoteReducer } from "@/components/quote/quoteReducer";
import { createDefaultQuoteInput } from "@/lib/calculation/defaultQuoteInput";
import { createDefaultConfiguration } from "@/lib/pricing/seedConfiguration";
import type { PrescriptionInput, QuoteInput } from "@/lib/types";

function baseInput(): QuoteInput {
  return createDefaultQuoteInput(createDefaultConfiguration());
}

const samplePrescription: PrescriptionInput = {
  od: { sphere: -2, cylinder: -2.5, axis: 180, add: 2 },
  os: { sphere: -1.5, cylinder: -1.25, axis: 175, add: 2 },
};

describe("quoteReducer", () => {
  it("a fresh quote defaults to Complete Pair with lens selections and prescription unset", () => {
    const input = baseInput();
    expect(input.orderType).toBe("complete_pair");
    expect(input.lensTypeId).toBeNull();
    expect(input.prescription).toBeNull();
  });

  it("APPLY_PRESCRIPTION commits the given prescription as the applied one", () => {
    const input = baseInput();
    const next = quoteReducer(input, { type: "APPLY_PRESCRIPTION", prescription: samplePrescription });
    expect(next.prescription).toEqual(samplePrescription);
  });

  it("CLEAR_PRESCRIPTION removes the applied prescription and every lens-related selection", () => {
    let input = baseInput();
    input = quoteReducer(input, { type: "APPLY_PRESCRIPTION", prescription: samplePrescription });
    input = { ...input, lensTypeId: "some-lens-type", materialId: "some-material", coatingId: "some-coating" };

    const next = quoteReducer(input, { type: "CLEAR_PRESCRIPTION" });

    expect(next.prescription).toBeNull();
    expect(next.lensTypeId).toBeNull();
    expect(next.progressiveDesignId).toBeNull();
    expect(next.materialId).toBeNull();
    expect(next.coatingId).toBeNull();
    expect(next.photochromic).toEqual({ productId: null, colorId: null });
  });

  it("SET_ORDER_TYPE to frame_only clears the applied prescription and all lens-related selections", () => {
    let input = baseInput();
    input = quoteReducer(input, { type: "APPLY_PRESCRIPTION", prescription: samplePrescription });
    input = { ...input, lensTypeId: "some-lens-type", materialId: "some-material" };

    const next = quoteReducer(input, { type: "SET_ORDER_TYPE", orderType: "frame_only" });

    expect(next.orderType).toBe("frame_only");
    expect(next.prescription).toBeNull();
    expect(next.lensTypeId).toBeNull();
    expect(next.materialId).toBeNull();
  });

  it("switching away from Frame Only requires a new prescription (prescription stays null even though it was null before too)", () => {
    let input = baseInput();
    input = quoteReducer(input, { type: "SET_ORDER_TYPE", orderType: "frame_only" });

    const next = quoteReducer(input, { type: "SET_ORDER_TYPE", orderType: "complete_pair" });

    expect(next.orderType).toBe("complete_pair");
    expect(next.prescription).toBeNull();
  });

  it("switching away from Frame Only clears a leftover applied prescription, forcing re-apply", () => {
    // This should not normally be reachable through the UI (Frame Only always
    // nulls the prescription), but the reducer defends against it anyway so
    // state can never claim an applied prescription while lens configuration
    // was never actually re-entered.
    let input = baseInput();
    input = quoteReducer(input, { type: "APPLY_PRESCRIPTION", prescription: samplePrescription });
    input = { ...input, orderType: "frame_only" }; // bypass the reducer to simulate a stale/unexpected state

    const next = quoteReducer(input, { type: "SET_ORDER_TYPE", orderType: "complete_pair" });

    expect(next.prescription).toBeNull();
  });

  it("switching between Complete Pair and Lens Only preserves the applied prescription and lens selections", () => {
    let input = baseInput();
    input = quoteReducer(input, { type: "APPLY_PRESCRIPTION", prescription: samplePrescription });
    input = { ...input, lensTypeId: "some-lens-type", materialId: "some-material" };

    const next = quoteReducer(input, { type: "SET_ORDER_TYPE", orderType: "lens_only" });

    expect(next.orderType).toBe("lens_only");
    expect(next.prescription).toEqual(samplePrescription);
    expect(next.lensTypeId).toBe("some-lens-type");
    expect(next.materialId).toBe("some-material");
  });

  it("setting the same order type again is a no-op", () => {
    const input = baseInput();
    const next = quoteReducer(input, { type: "SET_ORDER_TYPE", orderType: "complete_pair" });
    expect(next).toBe(input);
  });

  it("SET_LENS_TYPE clears the progressive design when switching to a non-progressive lens type", () => {
    let input = baseInput();
    input = { ...input, progressiveDesignId: "some-design" };

    const next = quoteReducer(input, { type: "SET_LENS_TYPE", lensTypeId: "single-vision-id", isProgressive: false });

    expect(next.lensTypeId).toBe("single-vision-id");
    expect(next.progressiveDesignId).toBeNull();
  });

  it("SET_LENS_TYPE preserves the progressive design when switching to Progressive", () => {
    let input = baseInput();
    input = { ...input, progressiveDesignId: "some-design" };

    const next = quoteReducer(input, { type: "SET_LENS_TYPE", lensTypeId: "progressive-id", isProgressive: true });

    expect(next.progressiveDesignId).toBe("some-design");
  });

  it("RESET_QUOTE returns a brand new default quote", () => {
    const config = createDefaultConfiguration();
    let input = createDefaultQuoteInput(config);
    input = quoteReducer(input, { type: "APPLY_PRESCRIPTION", prescription: samplePrescription });
    input = quoteReducer(input, { type: "SET_ORDER_TYPE", orderType: "lens_only" });

    const next = quoteReducer(input, { type: "RESET_QUOTE", config });

    expect(next.orderType).toBe("complete_pair");
    expect(next.prescription).toBeNull();
  });
});

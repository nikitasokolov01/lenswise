import { describe, expect, it } from "vitest";
import { createQuoteSession, quoteSessionReducer } from "@/components/quote/quoteSessionReducer";
import { createDefaultConfiguration as createSeedConfiguration } from "@/lib/pricing/seedConfiguration";
import type { CompletedSale } from "@/lib/sales/types";

const rx = { od: { sphere: -2, cylinder: -1, axis: 180, add: 2 }, os: { sphere: -1, cylinder: 0, axis: null, add: 2 } };

describe("multiple pairs in a visit", () => {
  it("copies Rx and PD to a new pair without copying frame, insurance, or discounts", () => {
    const config = createSeedConfiguration();
    let state = createQuoteSession(config);
    const edit = (action: Parameters<typeof quoteSessionReducer>[1] & { type: "EDIT_PAIR" }) => { state = quoteSessionReducer(state, action); };
    edit({ type: "EDIT_PAIR", action: { type: "APPLY_PRESCRIPTION", prescription: rx } });
    edit({ type: "EDIT_PAIR", action: { type: "SET_PUPILLARY_DISTANCE_VALUE", field: "binocular", value: "64" } });
    edit({ type: "EDIT_PAIR", action: { type: "SET_FRAME", field: "retailPriceCents", value: 30000 } });
    edit({ type: "EDIT_PAIR", action: { type: "SET_INSURANCE_MODE", mode: "insurance" } });
    edit({ type: "EDIT_PAIR", action: { type: "ADD_ADJUSTMENT", adjustmentType: "fixed_discount", values: { amountCents: 10000, percent: 0, label: "First purchase" } } });
    state = quoteSessionReducer(state, { type: "ADD_PAIR", config, id: "second", saleKey: "sale-second" });
    const second = state.pairs[1].input;
    expect(second.prescription).toEqual(rx);
    expect(second.prescription?.od).not.toBe(state.pairs[0].input.prescription?.od);
    expect(second.pupillaryDistance.binocular).toBe("64");
    expect(second.frame.retailPriceCents).toBe(0);
    expect(second.insurance.mode).toBe("retail");
    expect(second.adjustments).toEqual([]);
    expect(state.pairs[0].input.adjustments[0].amountCents).toBe(10000);
  });

  it("only edits the active pair and preserves earlier Rx and PD", () => {
    const config = createSeedConfiguration();
    let state = createQuoteSession(config);
    state = quoteSessionReducer(state, { type: "EDIT_PAIR", action: { type: "APPLY_PRESCRIPTION", prescription: rx } });
    state = quoteSessionReducer(state, { type: "ADD_PAIR", config, id: "second", saleKey: "sale-second" });
    state = quoteSessionReducer(state, { type: "EDIT_PAIR", action: { type: "SET_PUPILLARY_DISTANCE_VALUE", field: "binocular", value: "62" } });
    expect(state.pairs[0].input.pupillaryDistance.binocular).toBe("");
    expect(state.pairs[1].input.pupillaryDistance.binocular).toBe("62");
    state = quoteSessionReducer(state, { type: "EDIT_PAIR", action: { type: "SET_ORDER_TYPE", orderType: "frame_only" } });
    state = quoteSessionReducer(state, { type: "ADD_PAIR", config, id: "third", saleKey: "sale-third" });
    expect(state.pairs[2].input.prescription).toEqual(rx);
  });

  it("locks paid pairs and cannot delete them or the last pair", () => {
    const config = createSeedConfiguration();
    let state = createQuoteSession(config);
    expect(quoteSessionReducer(state, { type: "REMOVE_PAIR", id: "pair-1" })).toBe(state);
    const sale = { id: "sale", status: "completed" } as CompletedSale;
    state = quoteSessionReducer(state, { type: "SALE_COMPLETED", id: "pair-1", sale });
    const paid = state;
    expect(quoteSessionReducer(state, { type: "EDIT_PAIR", action: { type: "CLEAR_PRESCRIPTION" } })).toBe(paid);
    state = quoteSessionReducer(state, { type: "ADD_PAIR", config, id: "second", saleKey: "sale-second" });
    expect(quoteSessionReducer(state, { type: "REMOVE_PAIR", id: "pair-1" })).toBe(state);
    state = quoteSessionReducer(state, { type: "REMOVE_PAIR", id: "second" });
    expect(state.activePairId).toBe("pair-1");
  });

  it("reset clears all session Rx/PD and pairs without touching recorded sales", () => {
    const config = createSeedConfiguration();
    let state = createQuoteSession(config);
    state = quoteSessionReducer(state, { type: "EDIT_PAIR", action: { type: "APPLY_PRESCRIPTION", prescription: rx } });
    state = quoteSessionReducer(state, { type: "ADD_PAIR", config, id: "second", saleKey: "sale-second" });
    state = quoteSessionReducer(state, { type: "RESET_SESSION", config, saleKey: "fresh" });
    expect(state.pairs).toHaveLength(1);
    expect(state.sharedPrescription).toBeNull();
    expect(state.sharedPd.binocular).toBe("");
    expect(state.pairs[0].saleKey).toBe("fresh");
  });

  it("keeps payment completion tied to the correct pair and gives a new visit a new key", () => {
    const config = createSeedConfiguration();
    let state = createQuoteSession(config);
    state = quoteSessionReducer(state, { type: "INITIALIZE_SALE_KEY", id: "pair-1", saleKey: "first-sale" });
    state = quoteSessionReducer(state, { type: "ADD_PAIR", config, id: "second", saleKey: "second-sale" });
    state = quoteSessionReducer(state, { type: "SELECT_PAIR", id: "pair-1" });
    const sale = { id: "sale-second", status: "completed" } as CompletedSale;
    state = quoteSessionReducer(state, { type: "SALE_COMPLETED", id: "second", sale });
    expect(state.pairs[0].completedSale).toBeNull();
    expect(state.pairs[1].completedSale).toEqual(sale);
    expect(state.pairs.map((pair) => pair.saleKey)).toEqual(["first-sale", "second-sale"]);
    state = quoteSessionReducer(state, { type: "RESET_SESSION", config, saleKey: "new-visit-sale" });
    expect(state.pairs[0].completedSale).toBeNull();
    expect(state.pairs[0].saleKey).toBe("new-visit-sale");
  });
});

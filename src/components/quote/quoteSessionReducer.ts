import { createDefaultQuoteInput } from "@/lib/calculation/defaultQuoteInput";
import { quoteReducer, type QuoteAction } from "@/components/quote/quoteReducer";
import type { CompletedSale } from "@/lib/sales/types";
import type { PrescriptionInput, PricingConfiguration, PupillaryDistanceInput, QuoteInput } from "@/lib/types";

/** Ephemeral visit state. Never persist prescriptions, PD, or photo data. */
export interface QuotePair {
  id: string;
  input: QuoteInput;
  saleKey: string;
  completedSale: CompletedSale | null;
}

export interface QuoteSession {
  pairs: QuotePair[];
  activePairId: string;
  sharedPrescription: PrescriptionInput | null;
  sharedPd: PupillaryDistanceInput;
}

export type QuoteSessionAction =
  | { type: "EDIT_PAIR"; action: QuoteAction }
  | { type: "ADD_PAIR"; config: PricingConfiguration; id: string; saleKey: string }
  | { type: "SELECT_PAIR"; id: string }
  | { type: "REMOVE_PAIR"; id: string }
  | { type: "SALE_COMPLETED"; id: string; sale: CompletedSale }
  | { type: "INITIALIZE_SALE_KEY"; id: string; saleKey: string }
  | { type: "RESET_SESSION"; config: PricingConfiguration; saleKey: string };

function copyPrescription(rx: PrescriptionInput | null): PrescriptionInput | null {
  return rx ? { od: { ...rx.od }, os: { ...rx.os } } : null;
}

export function createQuoteSession(config: PricingConfiguration): QuoteSession {
  const input = createDefaultQuoteInput(config);
  return {
    pairs: [{ id: "pair-1", input, saleKey: "", completedSale: null }],
    activePairId: "pair-1",
    sharedPrescription: null,
    sharedPd: { ...input.pupillaryDistance },
  };
}

export function quoteSessionReducer(state: QuoteSession, action: QuoteSessionAction): QuoteSession {
  switch (action.type) {
    case "EDIT_PAIR": {
      const pair = state.pairs.find((item) => item.id === state.activePairId);
      if (!pair || pair.completedSale) return state;
      const input = quoteReducer(pair.input, action.action);
      return {
        ...state,
        pairs: state.pairs.map((item) => item.id === pair.id ? { ...item, input } : item),
        sharedPrescription: action.action.type === "APPLY_PRESCRIPTION"
          ? copyPrescription(input.prescription)
          : action.action.type === "CLEAR_PRESCRIPTION" ? null : state.sharedPrescription,
        sharedPd: action.action.type.startsWith("SET_PUPILLARY_DISTANCE")
          ? { ...input.pupillaryDistance } : state.sharedPd,
      };
    }
    case "ADD_PAIR": {
      if (state.pairs.some((pair) => pair.id === action.id)) return state;
      const input = createDefaultQuoteInput(action.config);
      input.prescription = copyPrescription(state.sharedPrescription);
      input.pupillaryDistance = { ...state.sharedPd };
      // Every additional pair starts at retail: insurance cannot be consumed twice by accident.
      return {
        ...state,
        pairs: [...state.pairs, { id: action.id, saleKey: action.saleKey, input, completedSale: null }],
        activePairId: action.id,
      };
    }
    case "SELECT_PAIR":
      return state.pairs.some((pair) => pair.id === action.id) ? { ...state, activePairId: action.id } : state;
    case "REMOVE_PAIR": {
      const pair = state.pairs.find((item) => item.id === action.id);
      if (!pair || pair.completedSale || state.pairs.length === 1) return state;
      const pairs = state.pairs.filter((item) => item.id !== action.id);
      return { ...state, pairs, activePairId: state.activePairId === action.id ? pairs[0].id : state.activePairId };
    }
    case "SALE_COMPLETED":
      return { ...state, pairs: state.pairs.map((pair) => pair.id === action.id ? { ...pair, completedSale: action.sale } : pair) };
    case "INITIALIZE_SALE_KEY":
      return { ...state, pairs: state.pairs.map((pair) => pair.id === action.id && !pair.saleKey ? { ...pair, saleKey: action.saleKey } : pair) };
    case "RESET_SESSION": {
      const fresh = createQuoteSession(action.config);
      fresh.pairs[0].saleKey = action.saleKey;
      return fresh;
    }
  }
}

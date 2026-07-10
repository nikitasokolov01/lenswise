import { generateId } from "@/lib/id";
import type {
  AdjustmentInput,
  AdjustmentType,
  CoverageStatus,
  FrameSelection,
  InsuranceMode,
  PricingConfiguration,
  QuoteInput,
} from "@/lib/types";
import { createDefaultQuoteInput } from "@/lib/calculation/defaultQuoteInput";

export type QuoteAction =
  | { type: "SET_FRAME"; field: keyof FrameSelection; value: FrameSelection[keyof FrameSelection] }
  | { type: "SET_LENS_TYPE"; lensTypeId: string | null; isProgressive: boolean }
  | { type: "SET_PROGRESSIVE_DESIGN"; progressiveDesignId: string | null }
  | { type: "SET_MATERIAL"; materialId: string | null }
  | { type: "SET_COATING"; coatingId: string | null }
  | { type: "SET_PHOTOCHROMIC_PRODUCT"; productId: string | null; requiresColor: boolean }
  | { type: "SET_PHOTOCHROMIC_COLOR"; colorId: string | null }
  | { type: "SET_INSURANCE_MODE"; mode: InsuranceMode }
  | { type: "SET_ALLOWANCE_FIELD"; field: "lensAllowanceCents" | "additionalCreditCents"; value: number }
  | {
      type: "SET_COPAY_AMOUNT_FIELD";
      field: "lensCopayCents" | "coatingCopayCents" | "photochromicCopayCents" | "otherCopayCents";
      value: number;
    }
  | {
      type: "SET_COPAY_COVERAGE";
      field: "frameCoverage" | "lensCoverage" | "coatingCoverage" | "photochromicCoverage";
      value: CoverageStatus;
    }
  | { type: "SET_MANUAL_OVERRIDE_AMOUNT"; value: number }
  | { type: "SET_MANUAL_OVERRIDE_NOTE"; value: string }
  | { type: "ADD_ADJUSTMENT"; adjustmentType: AdjustmentType }
  | { type: "UPDATE_ADJUSTMENT"; id: string; patch: Partial<AdjustmentInput> }
  | { type: "REMOVE_ADJUSTMENT"; id: string }
  | { type: "RESET_ADJUSTMENTS" }
  | { type: "RESET_QUOTE"; config: PricingConfiguration };

export function quoteReducer(state: QuoteInput, action: QuoteAction): QuoteInput {
  switch (action.type) {
    case "SET_FRAME": {
      const next: FrameSelection = { ...state.frame, [action.field]: action.value };
      // Keep the "Frame Only" quick-toggle and the Lens Type step in sync:
      // checking the box conceptually means "no lenses on this order".
      return { ...state, frame: next };
    }
    case "SET_LENS_TYPE": {
      return {
        ...state,
        lensTypeId: action.lensTypeId,
        // A progressive design only makes sense for the Progressive lens
        // type, so clear it whenever a different lens type is selected.
        progressiveDesignId: action.isProgressive ? state.progressiveDesignId : null,
      };
    }
    case "SET_PROGRESSIVE_DESIGN":
      return { ...state, progressiveDesignId: action.progressiveDesignId };
    case "SET_MATERIAL":
      return { ...state, materialId: action.materialId };
    case "SET_COATING":
      return { ...state, coatingId: action.coatingId };
    case "SET_PHOTOCHROMIC_PRODUCT":
      return {
        ...state,
        photochromic: {
          productId: action.productId,
          colorId: action.requiresColor ? state.photochromic.colorId : null,
        },
      };
    case "SET_PHOTOCHROMIC_COLOR":
      return { ...state, photochromic: { ...state.photochromic, colorId: action.colorId } };
    case "SET_INSURANCE_MODE":
      return { ...state, insurance: { ...state.insurance, mode: action.mode } };
    case "SET_ALLOWANCE_FIELD":
      return {
        ...state,
        insurance: {
          ...state.insurance,
          allowances: { ...state.insurance.allowances, [action.field]: action.value },
        },
      };
    case "SET_COPAY_AMOUNT_FIELD":
      return {
        ...state,
        insurance: {
          ...state.insurance,
          copays: { ...state.insurance.copays, [action.field]: action.value },
        },
      };
    case "SET_COPAY_COVERAGE":
      return {
        ...state,
        insurance: {
          ...state.insurance,
          copays: { ...state.insurance.copays, [action.field]: action.value },
        },
      };
    case "SET_MANUAL_OVERRIDE_AMOUNT":
      return {
        ...state,
        insurance: {
          ...state.insurance,
          manualOverride: { ...state.insurance.manualOverride, finalPatientResponsibilityCents: action.value },
        },
      };
    case "SET_MANUAL_OVERRIDE_NOTE":
      return {
        ...state,
        insurance: {
          ...state.insurance,
          manualOverride: { ...state.insurance.manualOverride, note: action.value },
        },
      };
    case "ADD_ADJUSTMENT": {
      const newAdjustment: AdjustmentInput = {
        id: generateId("adj"),
        type: action.adjustmentType,
        amountCents: 0,
        percent: 0,
        label: "",
      };
      return { ...state, adjustments: [...state.adjustments, newAdjustment] };
    }
    case "UPDATE_ADJUSTMENT":
      return {
        ...state,
        adjustments: state.adjustments.map((adj) =>
          adj.id === action.id ? { ...adj, ...action.patch } : adj
        ),
      };
    case "REMOVE_ADJUSTMENT":
      return { ...state, adjustments: state.adjustments.filter((adj) => adj.id !== action.id) };
    case "RESET_ADJUSTMENTS":
      return { ...state, adjustments: [] };
    case "RESET_QUOTE":
      return createDefaultQuoteInput(action.config);
    default:
      return state;
  }
}

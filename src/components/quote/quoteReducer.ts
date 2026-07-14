import { generateId } from "@/lib/id";
import type {
  AdjustmentInput,
  AdjustmentType,
  CoverageMethod,
  FrameSelection,
  InsuranceCoverageInput,
  InsuranceMode,
  OrderType,
  PrescriptionInput,
  PricingConfiguration,
  QuoteInput,
  UsageKey,
} from "@/lib/types";
import { createDefaultQuoteInput } from "@/lib/calculation/defaultQuoteInput";

/** The plain-dollar-amount fields on InsuranceCoverageInput (allowances, other copay/charge) — everything except the 5 CoverageMethod category fields and the note. */
type InsuranceCoverageMoneyField = Exclude<
  keyof InsuranceCoverageInput,
  "note" | "frameCoverage" | "lensCoverage" | "materialCoverage" | "coatingCoverage" | "photochromicCoverage"
>;

/** The 5 per-category CoverageMethod fields on InsuranceCoverageInput. */
type InsuranceCoverageMethodField =
  | "frameCoverage"
  | "lensCoverage"
  | "materialCoverage"
  | "coatingCoverage"
  | "photochromicCoverage";

/** Fields cleared whenever the applied prescription is removed (Clear Prescription, or switching to Frame Only). */
function clearedLensSelections(): Pick<
  QuoteInput,
  "lensTypeId" | "progressiveDesignId" | "materialId" | "coatingId" | "photochromic"
> {
  return {
    lensTypeId: null,
    progressiveDesignId: null,
    materialId: null,
    coatingId: null,
    photochromic: { productId: null, colorId: null },
  };
}

export type QuoteAction =
  | { type: "SET_ORDER_TYPE"; orderType: OrderType }
  | { type: "SET_USAGE"; usage: UsageKey | null }
  | { type: "SET_FRAME"; field: keyof FrameSelection; value: FrameSelection[keyof FrameSelection] }
  | { type: "SET_LENS_TYPE"; lensTypeId: string | null; isProgressive: boolean }
  | { type: "SET_PROGRESSIVE_DESIGN"; progressiveDesignId: string | null }
  | { type: "SET_MATERIAL"; materialId: string | null }
  | { type: "SET_COATING"; coatingId: string | null }
  | { type: "SET_PHOTOCHROMIC_PRODUCT"; productId: string | null; requiresColor: boolean }
  | { type: "SET_PHOTOCHROMIC_COLOR"; colorId: string | null }
  | { type: "APPLY_PRESCRIPTION"; prescription: PrescriptionInput }
  | { type: "CLEAR_PRESCRIPTION" }
  | { type: "SET_INSURANCE_MODE"; mode: InsuranceMode }
  | { type: "SET_INSURANCE_COVERAGE_FIELD"; field: InsuranceCoverageMoneyField; value: number }
  | { type: "SET_INSURANCE_COVERAGE_METHOD"; field: InsuranceCoverageMethodField; method: CoverageMethod }
  | { type: "SET_INSURANCE_NOTE"; value: string }
  | { type: "SET_MANUAL_OVERRIDE_AMOUNT"; value: number }
  | { type: "SET_MANUAL_OVERRIDE_NOTE"; value: string }
  | { type: "ADD_ADJUSTMENT"; adjustmentType: AdjustmentType }
  | { type: "UPDATE_ADJUSTMENT"; id: string; patch: Partial<AdjustmentInput> }
  | { type: "REMOVE_ADJUSTMENT"; id: string }
  | { type: "RESET_ADJUSTMENTS" }
  | { type: "RESET_QUOTE"; config: PricingConfiguration };

export function quoteReducer(state: QuoteInput, action: QuoteAction): QuoteInput {
  switch (action.type) {
    case "SET_ORDER_TYPE": {
      if (action.orderType === state.orderType) return state;

      // Switching TO Frame Only: prescription is not applicable, so clear
      // the applied prescription and every lens-related selection — this is
      // what removes prescription warnings, surfacing decisions, and lens
      // charges from the quote.
      if (action.orderType === "frame_only") {
        return {
          ...state,
          orderType: action.orderType,
          prescription: null,
          ...clearedLensSelections(),
        };
      }

      // Switching AWAY from Frame Only (to Complete Pair or Lens Only): a
      // new valid prescription is required before lens choices unlock
      // again. Lens selections are already empty in this case (Frame Only
      // never has any), so nothing else needs clearing.
      if (state.orderType === "frame_only") {
        return { ...state, orderType: action.orderType, prescription: null };
      }

      // Complete Pair <-> Lens Only: both require a prescription, so the
      // already-applied prescription and lens selections carry over.
      return { ...state, orderType: action.orderType };
    }
    case "SET_USAGE":
      return { ...state, usage: action.usage };
    case "SET_FRAME": {
      const next: FrameSelection = { ...state.frame, [action.field]: action.value };
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
    case "APPLY_PRESCRIPTION":
      // Committing a validated prescription is the ONLY way it ever enters
      // quote state — see PrescriptionStep.tsx, which keeps in-progress
      // selections in local component state until "Apply Prescription" is
      // pressed, so a mid-edit value can never leak into gating/calculation.
      return { ...state, prescription: action.prescription };
    case "CLEAR_PRESCRIPTION":
      return { ...state, prescription: null, ...clearedLensSelections() };
    case "SET_INSURANCE_MODE":
      return { ...state, insurance: { ...state.insurance, mode: action.mode } };
    case "SET_INSURANCE_COVERAGE_FIELD":
      return {
        ...state,
        insurance: {
          ...state.insurance,
          coverage: { ...state.insurance.coverage, [action.field]: action.value },
        },
      };
    case "SET_INSURANCE_COVERAGE_METHOD":
      return {
        ...state,
        insurance: {
          ...state.insurance,
          coverage: { ...state.insurance.coverage, [action.field]: action.method },
        },
      };
    case "SET_INSURANCE_NOTE":
      return {
        ...state,
        insurance: { ...state.insurance, coverage: { ...state.insurance.coverage, note: action.value } },
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

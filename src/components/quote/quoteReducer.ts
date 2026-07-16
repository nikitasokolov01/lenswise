import { generateId } from "@/lib/id";
import type {
  AdjustmentInput,
  AdjustmentType,
  CoverageMethod,
  FrameSelection,
  InsuranceCoverageInput,
  InsuranceMode,
  OrderType,
  PrescriptionDisplayMode,
  PrescriptionInput,
  PricingConfiguration,
  QuoteInput,
  TintType,
  UsageKey,
} from "@/lib/types";
import { createDefaultQuoteInput } from "@/lib/calculation/defaultQuoteInput";

/** The plain-dollar-amount fields on InsuranceCoverageInput (allowances, other copay/charge) — everything except the CoverageMethod category fields and the note. */
type InsuranceCoverageMoneyField = Exclude<
  keyof InsuranceCoverageInput,
  | "note"
  | "frameCoverage"
  | "lensCoverage"
  | "materialCoverage"
  | "coatingCoverage"
  | "photochromicCoverage"
  | "tintCoverage"
  | "blueLightCoverage"
  | "surfacingCoverage"
>;

/** The per-category CoverageMethod fields on InsuranceCoverageInput. */
type InsuranceCoverageMethodField =
  | "frameCoverage"
  | "lensCoverage"
  | "materialCoverage"
  | "coatingCoverage"
  | "photochromicCoverage"
  | "tintCoverage"
  | "blueLightCoverage"
  | "surfacingCoverage";

/** Fields cleared whenever the applied prescription is removed (Clear Prescription, or switching to Frame Only). */
function clearedLensSelections(): Pick<
  QuoteInput,
  | "lensTypeId"
  | "progressiveDesignId"
  | "materialId"
  | "coatingId"
  | "photochromic"
  | "tint"
  | "blueLightId"
  | "surfacingOverride"
  | "prescriptionDisplayMode"
> {
  return {
    lensTypeId: null,
    progressiveDesignId: null,
    materialId: null,
    coatingId: null,
    photochromic: { productId: null, colorId: null },
    tint: { type: "none", colorId: null, percent: null },
    blueLightId: null,
    surfacingOverride: null,
    prescriptionDisplayMode: "original",
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
  | { type: "SET_TINT_TYPE"; tintType: TintType }
  | { type: "SET_TINT_COLOR"; colorId: string | null }
  | { type: "SET_TINT_PERCENT"; percent: number | null }
  | { type: "CLEAR_TINT" }
  | { type: "SET_BLUE_LIGHT"; blueLightId: string | null }
  | { type: "SET_SURFACING_OVERRIDE"; enabled: boolean | null }
  | { type: "SET_PRESCRIPTION_DISPLAY_MODE"; mode: PrescriptionDisplayMode }
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
        // Lens type affects the surfacing recommendation → return to auto.
        surfacingOverride: null,
      };
    }
    case "SET_PROGRESSIVE_DESIGN":
      return { ...state, progressiveDesignId: action.progressiveDesignId };
    case "SET_MATERIAL":
      // Material affects the surfacing recommendation → return to auto.
      return { ...state, materialId: action.materialId, surfacingOverride: null };
    case "SET_COATING":
      return { ...state, coatingId: action.coatingId };
    case "SET_PHOTOCHROMIC_PRODUCT":
      return {
        ...state,
        photochromic: {
          productId: action.productId,
          colorId: action.requiresColor ? state.photochromic.colorId : null,
        },
        // Photochromic product affects the surfacing recommendation → return to auto.
        surfacingOverride: null,
      };
    case "SET_PHOTOCHROMIC_COLOR":
      // Photochromic color affects the surfacing recommendation → return to auto.
      return {
        ...state,
        photochromic: { ...state.photochromic, colorId: action.colorId },
        surfacingOverride: null,
      };
    case "SET_TINT_TYPE":
      // Selecting "None" clears the color and percentage (and, via the
      // calculation engine, removes any tint pricing). Switching between
      // Solid/Gradient keeps the chosen color and percentage.
      return action.tintType === "none"
        ? { ...state, tint: { type: "none", colorId: null, percent: null } }
        : { ...state, tint: { ...state.tint, type: action.tintType } };
    case "SET_TINT_COLOR":
      return { ...state, tint: { ...state.tint, colorId: action.colorId } };
    case "SET_TINT_PERCENT":
      return { ...state, tint: { ...state.tint, percent: action.percent } };
    case "CLEAR_TINT":
      return { ...state, tint: { type: "none", colorId: null, percent: null } };
    case "SET_BLUE_LIGHT":
      return { ...state, blueLightId: action.blueLightId };
    case "SET_SURFACING_OVERRIDE":
      // `null` = follow the automatic recommendation; true/false = a sticky
      // manual choice that only resets when a relevant input changes.
      return { ...state, surfacingOverride: action.enabled };
    case "SET_PRESCRIPTION_DISPLAY_MODE":
      // Display-only: never touches the applied `prescription`.
      return { ...state, prescriptionDisplayMode: action.mode };
    case "APPLY_PRESCRIPTION":
      // Committing a validated prescription is the ONLY way it ever enters
      // quote state — see PrescriptionStep.tsx, which keeps in-progress
      // selections in local component state until "Apply Prescription" is
      // pressed, so a mid-edit value can never leak into gating/calculation.
      // The prescription affects the surfacing recommendation → return to auto.
      return { ...state, prescription: action.prescription, surfacingOverride: null };
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

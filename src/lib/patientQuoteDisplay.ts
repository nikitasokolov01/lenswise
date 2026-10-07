import type {
  InsuranceBreakdown,
  QuoteCalculationResult,
  QuoteLineItem,
  QuoteLineItemCategory,
  UsageKey,
} from "@/lib/types";

/** Minimal pair data for the patient display: no prescription, PD, or internal input. */
export interface PatientQuotePair {
  id: string;
  label: string;
  result: QuoteCalculationResult;
  usage: UsageKey | null;
}

export interface PatientDisplayItem {
  id: string;
  label: string;
  description?: string;
  amountCents: number;
}

export interface PatientDisplaySection {
  title: string;
  isDiscount: boolean;
  items: PatientDisplayItem[];
}

const SECTION_BY_CATEGORY: Record<QuoteLineItemCategory, string> = {
  frame: "Frame",
  lens: "Lenses",
  material: "Lenses",
  coating: "Coating",
  photochromic: "Upgrades",
  tint: "Upgrades",
  blue_light: "Upgrades",
  fee: "Upgrades",
  custom: "Upgrades",
  discount: "Discounts Applied",
  insurance: "Insurance",
};

const SECTION_ORDER = ["Frame", "Lenses", "Coating", "Upgrades", "Discounts Applied", "Insurance"];

/** Presentation only: retain every line's amount and follow the office's label privacy setting. */
export function patientDisplaySections(items: QuoteLineItem[], showExact: boolean): PatientDisplaySection[] {
  const sections = new Map<string, PatientDisplayItem[]>();
  for (const item of items) {
    const title = SECTION_BY_CATEGORY[item.category];
    const rows = sections.get(title) ?? [];
    rows.push({
      id: item.id,
      label: showExact ? item.label : item.customerLabel,
      ...(showExact && item.description ? { description: item.description } : {}),
      amountCents: item.category === "discount" ? -Math.abs(item.amountCents) : item.amountCents,
    });
    sections.set(title, rows);
  }
  return SECTION_ORDER.flatMap((title) => {
    const rows = sections.get(title);
    return rows ? [{ title, isDiscount: title === "Discounts Applied", items: rows }] : [];
  });
}

export function patientInsuranceLines(b: InsuranceBreakdown): {
  patient: Array<{ label: string; cents: number }>;
  insurance: Array<{ label: string; cents: number }>;
} {
  return {
    patient: [
      { label: "Frame copay", cents: b.frameCopayCents },
      { label: "Lens copay", cents: b.lensCopayCents },
      { label: "Coating copay", cents: b.coatingCopayCents },
      { label: "Photochromic copay", cents: b.photochromicCopayCents },
      { label: "Tint copay", cents: b.tintCopayCents },
      { label: "Blue light copay", cents: b.blueLightCopayCents },
      { label: "Surfacing copay", cents: b.surfacingCopayCents },
      { label: "Other copay", cents: b.otherCopayCents },
      { label: "Other charge", cents: b.otherChargeCents },
    ].filter((line) => line.cents > 0),
    insurance: [
      { label: "Frame allowance", cents: b.frameAllowanceAppliedCents },
      { label: "Lens allowance", cents: b.lensAllowanceAppliedCents },
      { label: "Additional insurance credit", cents: b.additionalAllowanceAppliedCents },
      { label: "Frame covered by insurance", cents: b.frameCoveredCents },
      { label: "Lens covered by insurance", cents: b.lensCoveredCents },
      { label: "Coating covered by insurance", cents: b.coatingCoveredCents },
      { label: "Photochromic covered by insurance", cents: b.photochromicCoveredCents },
      { label: "Tint covered by insurance", cents: b.tintCoveredCents },
      { label: "Blue light covered by insurance", cents: b.blueLightCoveredCents },
      { label: "Surfacing covered by insurance", cents: b.surfacingCoveredCents },
    ].filter((line) => line.cents > 0),
  };
}

"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { MoneyField } from "@/components/ui/money-field";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { formatCents } from "@/lib/money";
import type { Dispatch, ReactNode } from "react";
import type { CoverageMethod, InsuranceCoverageInput, InsuranceMode, QuoteInput } from "@/lib/types";
import type { QuoteAction } from "@/components/quote/quoteReducer";

interface InsuranceStepProps {
  input: QuoteInput;
  dispatch: Dispatch<QuoteAction>;
  preOverrideEstimateCents: number;
  /** Whether a surfacing fee is on this quote (shows its coverage control). */
  surfacingApplies: boolean;
  /** Whether a Blue Light option is selected (shows its coverage control). */
  blueLightApplies: boolean;
}

const MODES: { value: InsuranceMode; label: string; description: string }[] = [
  { value: "retail", label: "Retail / Self-Pay", description: "Patient pays the full retail total." },
  {
    value: "insurance",
    label: "Use Insurance",
    description: "Set each category to a copay, fully covered, or retail (with an allowance).",
  },
  { value: "manual", label: "Manual Final Price Override", description: "Directly enter the final patient responsibility." },
];

type CoverageMoneyField = Exclude<
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
type CoverageMethodField =
  | "frameCoverage"
  | "lensCoverage"
  | "materialCoverage"
  | "coatingCoverage"
  | "photochromicCoverage"
  | "tintCoverage"
  | "blueLightCoverage"
  | "surfacingCoverage";

export function InsuranceStep({
  input,
  dispatch,
  preOverrideEstimateCents,
  surfacingApplies,
  blueLightApplies,
}: InsuranceStepProps) {
  const mode = input.insurance.mode;
  const coverage = input.insurance.coverage;

  function setCoverage(field: CoverageMoneyField, value: number) {
    dispatch({ type: "SET_INSURANCE_COVERAGE_FIELD", field, value });
  }

  function setCoverageMethod(field: CoverageMethodField, method: CoverageMethod) {
    dispatch({ type: "SET_INSURANCE_COVERAGE_METHOD", field, method });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>7. Insurance</CardTitle>
        <CardDescription>Choose how patient responsibility should be calculated.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div role="radiogroup" aria-label="Insurance calculation method" className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {MODES.map((option) => {
            const selected = mode === option.value;
            return (
              <label
                key={option.value}
                className={`flex min-h-[64px] cursor-pointer flex-col justify-center gap-0.5 rounded-lg border px-4 py-3 ${
                  selected
                    ? "border-teal-600 bg-teal-50 ring-1 ring-teal-600"
                    : "border-navy-200 bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="insurance-mode"
                  className="sr-only"
                  checked={selected}
                  onChange={() => dispatch({ type: "SET_INSURANCE_MODE", mode: option.value })}
                />
                <span className="text-[15px] font-medium text-navy-900">{option.label}</span>
                <span className="text-xs text-navy-500">{option.description}</span>
              </label>
            );
          })}
        </div>

        {mode === "retail" ? (
          <p className="text-sm text-navy-600">
            Patient responsibility equals the retail total after any manual discounts or adjustments below.
          </p>
        ) : null}

        {mode === "insurance" ? (
          <div className="space-y-5">
            <Separator />
            <p className="text-sm text-navy-600">
              For each category choose how it is billed: a <strong>copay</strong> replaces that item&rsquo;s cost
              (the patient owes the copay and insurance covers the rest), <strong>covered</strong> means insurance
              pays it in full, and <strong>retail</strong> lets a frame or lens allowance offset it. Allowances
              apply to categories billed at retail.
            </p>

            <CoverageGroup title="Frame">
              <CoverageMethodField
                id="frame-coverage"
                label="Frame coverage"
                method={coverage.frameCoverage}
                onChange={(method) => setCoverageMethod("frameCoverage", method)}
              />
              <CoverageField
                id="frame-allowance"
                label="Frame allowance"
                valueCents={coverage.frameAllowanceCents}
                onChangeCents={(cents) => setCoverage("frameAllowanceCents", cents)}
              />
            </CoverageGroup>

            <CoverageGroup title="Lenses">
              {/* One coverage decision governs the combined lens + material
                  price (the material's price for the selected lens type IS the
                  lens price), so lens and material are never billed twice. */}
              <CoverageMethodField
                id="lens-coverage"
                label="Lens coverage"
                method={coverage.lensCoverage}
                onChange={(method) => setCoverageMethod("lensCoverage", method)}
              />
              <CoverageField
                id="lens-allowance"
                label="Lens allowance"
                valueCents={coverage.lensAllowanceCents}
                onChangeCents={(cents) => setCoverage("lensAllowanceCents", cents)}
              />
            </CoverageGroup>

            <CoverageGroup title="Upgrades">
              <CoverageMethodField
                id="coating-coverage"
                label="Coating coverage"
                method={coverage.coatingCoverage}
                onChange={(method) => setCoverageMethod("coatingCoverage", method)}
              />
              <CoverageMethodField
                id="photochromic-coverage"
                label="Photochromic coverage"
                method={coverage.photochromicCoverage}
                onChange={(method) => setCoverageMethod("photochromicCoverage", method)}
              />
              {input.tint.type !== "none" ? (
                <CoverageMethodField
                  id="tint-coverage"
                  label="Tint coverage"
                  method={coverage.tintCoverage}
                  onChange={(method) => setCoverageMethod("tintCoverage", method)}
                />
              ) : null}
              {blueLightApplies ? (
                <CoverageMethodField
                  id="blue-light-coverage"
                  label="Blue light coverage"
                  method={coverage.blueLightCoverage}
                  onChange={(method) => setCoverageMethod("blueLightCoverage", method)}
                />
              ) : null}
              {surfacingApplies ? (
                <CoverageMethodField
                  id="surfacing-coverage"
                  label="Custom Lens Surfacing coverage"
                  method={coverage.surfacingCoverage}
                  onChange={(method) => setCoverageMethod("surfacingCoverage", method)}
                />
              ) : null}
              <CoverageField
                id="other-copay"
                label="Other copay"
                valueCents={coverage.otherCopayCents}
                onChangeCents={(cents) => setCoverage("otherCopayCents", cents)}
              />
            </CoverageGroup>

            <CoverageGroup title="Additional coverage">
              <CoverageField
                id="additional-allowance"
                label="Additional insurance allowance or credit"
                valueCents={coverage.additionalAllowanceCents}
                onChangeCents={(cents) => setCoverage("additionalAllowanceCents", cents)}
              />
              <CoverageField
                id="other-charge"
                label="Other non-covered charge"
                valueCents={coverage.otherChargeCents}
                onChangeCents={(cents) => setCoverage("otherChargeCents", cents)}
              />
              <div className="sm:col-span-2">
                <Label htmlFor="insurance-note">
                  Internal note <span className="font-normal text-navy-400">(optional, anonymous only)</span>
                </Label>
                <Textarea
                  id="insurance-note"
                  placeholder='e.g. "Plan requires prior authorization"'
                  maxLength={160}
                  value={coverage.note}
                  onChange={(e) => dispatch({ type: "SET_INSURANCE_NOTE", value: e.target.value })}
                  aria-describedby="insurance-note-hint"
                />
                <p id="insurance-note-hint" className="mt-1 text-xs text-navy-400">
                  Do not enter patient names or any identifying information here.
                </p>
              </div>
            </CoverageGroup>
          </div>
        ) : null}

        {mode === "manual" ? (
          <div className="space-y-4">
            <Separator />
            <p className="text-sm text-navy-600">
              The calculated retail total for this quote is currently{" "}
              <strong>{formatCents(preOverrideEstimateCents)}</strong>. Entering an override below replaces the
              patient responsibility with the amount you enter.
            </p>
            <div>
              <Label htmlFor="manual-override-amount">Final patient responsibility</Label>
              <MoneyField
                id="manual-override-amount"
                valueCents={input.insurance.manualOverride.finalPatientResponsibilityCents}
                onChangeCents={(cents) => dispatch({ type: "SET_MANUAL_OVERRIDE_AMOUNT", value: cents })}
                aria-label="Final patient responsibility"
              />
            </div>
            <div>
              <Label htmlFor="manual-override-note">
                Internal note <span className="font-normal text-navy-400">(optional, anonymous only)</span>
              </Label>
              <Textarea
                id="manual-override-note"
                placeholder='e.g. "Manager-approved package price"'
                maxLength={120}
                value={input.insurance.manualOverride.note}
                onChange={(e) => dispatch({ type: "SET_MANUAL_OVERRIDE_NOTE", value: e.target.value })}
                aria-describedby="manual-override-note-hint"
              />
              <p id="manual-override-note-hint" className="mt-1 text-xs text-navy-400">
                Do not enter patient names or any identifying information here.
              </p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CoverageGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-navy-100 p-3">
      <p className="mb-3 text-sm font-semibold text-navy-800">{title}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function CoverageField({
  id,
  label,
  valueCents,
  onChangeCents,
}: {
  id: string;
  label: string;
  valueCents: number;
  onChangeCents: (cents: number) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <MoneyField id={id} valueCents={valueCents} onChangeCents={onChangeCents} aria-label={label} />
    </div>
  );
}

const COVERAGE_METHOD_OPTIONS: SegmentedOption<CoverageMethod["type"]>[] = [
  { value: "retail", label: "Retail" },
  { value: "copay", label: "Copay" },
  { value: "covered", label: "Covered" },
];

/**
 * Picker for one category's CoverageMethod: Retail (patient pays this item's
 * retail, which a frame/lens allowance may offset), Copay (the copay replaces
 * the item's cost — patient owes the copay, insurance covers the remainder —
 * revealing an amount field), or Covered (fully paid by insurance, patient
 * owes nothing). Copay and Covered are kept as distinct, explicit states.
 */
function CoverageMethodField({
  id,
  label,
  method,
  onChange,
}: {
  id: string;
  label: string;
  method: CoverageMethod;
  onChange: (method: CoverageMethod) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div id={id} className="space-y-2">
        <SegmentedControl
          label={label}
          options={COVERAGE_METHOD_OPTIONS}
          value={method.type}
          onChange={(value) => {
            if (value === "copay") {
              onChange({ type: "copay", amountCents: method.type === "copay" ? method.amountCents : 0 });
            } else {
              onChange({ type: value });
            }
          }}
        />
        {method.type === "copay" ? (
          <MoneyField
            valueCents={method.amountCents}
            onChangeCents={(cents) => onChange({ type: "copay", amountCents: cents })}
            aria-label={`${label} amount`}
          />
        ) : null}
      </div>
    </div>
  );
}

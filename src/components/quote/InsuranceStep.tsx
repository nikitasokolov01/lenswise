"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { MoneyField } from "@/components/ui/money-field";
import { Textarea } from "@/components/ui/textarea";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Separator } from "@/components/ui/separator";
import { formatCents } from "@/lib/money";
import type { Dispatch } from "react";
import type { CoverageStatus, InsuranceMode, QuoteInput } from "@/lib/types";
import type { QuoteAction } from "@/components/quote/quoteReducer";

interface InsuranceStepProps {
  input: QuoteInput;
  dispatch: Dispatch<QuoteAction>;
  preOverrideEstimateCents: number;
}

const MODES: { value: InsuranceMode; label: string; description: string }[] = [
  { value: "retail", label: "Retail / Self-Pay", description: "Patient pays the full retail total." },
  { value: "allowances", label: "Insurance Allowances", description: "Enter frame/lens allowances to subtract from retail." },
  { value: "copays", label: "Insurance Copays", description: "Enter copays per item and mark coverage status." },
  { value: "manual", label: "Manual Override", description: "Directly enter the final patient responsibility." },
];

const coverageOptions: { value: CoverageStatus; label: string }[] = [
  { value: "copay", label: "Copay" },
  { value: "noncovered", label: "Non-covered" },
  { value: "included", label: "Included" },
];

export function InsuranceStep({ input, dispatch, preOverrideEstimateCents }: InsuranceStepProps) {
  const mode = input.insurance.mode;

  return (
    <Card>
      <CardHeader>
        <CardTitle>6. Insurance Calculation Method</CardTitle>
        <CardDescription>Choose how patient responsibility should be calculated.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div role="radiogroup" aria-label="Insurance calculation method" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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
            Patient responsibility equals the retail total after any manual discounts or adjustments from step 7.
          </p>
        ) : null}

        {mode === "allowances" ? (
          <div className="space-y-4">
            <Separator />
            <p className="text-sm text-navy-600">
              Frame allowance uses the value entered in step 1. Enter the lens allowance and any additional
              insurance credit below.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="lens-allowance">Lens allowance</Label>
                <MoneyField
                  id="lens-allowance"
                  valueCents={input.insurance.allowances.lensAllowanceCents}
                  onChangeCents={(cents) =>
                    dispatch({ type: "SET_ALLOWANCE_FIELD", field: "lensAllowanceCents", value: cents })
                  }
                  aria-label="Lens allowance"
                />
              </div>
              <div>
                <Label htmlFor="additional-credit">Additional insurance credit</Label>
                <MoneyField
                  id="additional-credit"
                  valueCents={input.insurance.allowances.additionalCreditCents}
                  onChangeCents={(cents) =>
                    dispatch({ type: "SET_ALLOWANCE_FIELD", field: "additionalCreditCents", value: cents })
                  }
                  aria-label="Additional insurance credit"
                />
              </div>
            </div>
          </div>
        ) : null}

        {mode === "copays" ? (
          <div className="space-y-4">
            <Separator />
            <p className="text-sm text-navy-600">
              Frame copay uses the value entered in step 1. Mark each item as covered by copay, a non-covered
              retail charge, or included at no charge.
            </p>

            <CopayRow
              title="Lens & material copay"
              amountCents={input.insurance.copays.lensCopayCents}
              onAmountChange={(cents) => dispatch({ type: "SET_COPAY_AMOUNT_FIELD", field: "lensCopayCents", value: cents })}
              coverage={input.insurance.copays.lensCoverage}
              onCoverageChange={(v) => dispatch({ type: "SET_COPAY_COVERAGE", field: "lensCoverage", value: v })}
            />
            <CopayRow
              title="Coating copay"
              amountCents={input.insurance.copays.coatingCopayCents}
              onAmountChange={(cents) => dispatch({ type: "SET_COPAY_AMOUNT_FIELD", field: "coatingCopayCents", value: cents })}
              coverage={input.insurance.copays.coatingCoverage}
              onCoverageChange={(v) => dispatch({ type: "SET_COPAY_COVERAGE", field: "coatingCoverage", value: v })}
            />
            <CopayRow
              title="Photochromic copay"
              amountCents={input.insurance.copays.photochromicCopayCents}
              onAmountChange={(cents) =>
                dispatch({ type: "SET_COPAY_AMOUNT_FIELD", field: "photochromicCopayCents", value: cents })
              }
              coverage={input.insurance.copays.photochromicCoverage}
              onCoverageChange={(v) => dispatch({ type: "SET_COPAY_COVERAGE", field: "photochromicCoverage", value: v })}
            />

            <div className="rounded-md border border-navy-100 p-3">
              <p className="mb-2 text-sm font-medium text-navy-700">Frame coverage</p>
              <SegmentedControl
                label="Frame coverage"
                options={coverageOptions}
                value={input.insurance.copays.frameCoverage}
                onChange={(v) => dispatch({ type: "SET_COPAY_COVERAGE", field: "frameCoverage", value: v })}
              />
            </div>

            <div>
              <Label htmlFor="other-copay">Other copay</Label>
              <MoneyField
                id="other-copay"
                valueCents={input.insurance.copays.otherCopayCents}
                onChangeCents={(cents) => dispatch({ type: "SET_COPAY_AMOUNT_FIELD", field: "otherCopayCents", value: cents })}
                aria-label="Other copay"
              />
              <p className="mt-1 text-xs text-navy-400">
                A flat miscellaneous copay (e.g. an exam copay) always added to patient responsibility.
              </p>
            </div>
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

function CopayRow({
  title,
  amountCents,
  onAmountChange,
  coverage,
  onCoverageChange,
}: {
  title: string;
  amountCents: number;
  onAmountChange: (cents: number) => void;
  coverage: CoverageStatus;
  onCoverageChange: (value: CoverageStatus) => void;
}) {
  return (
    <div className="rounded-md border border-navy-100 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-navy-700">{title}</p>
        <SegmentedControl label={`${title} coverage`} options={coverageOptions} value={coverage} onChange={onCoverageChange} />
      </div>
      {coverage === "copay" ? (
        <MoneyField valueCents={amountCents} onChangeCents={onAmountChange} aria-label={title} className="max-w-[180px]" />
      ) : (
        <p className="text-xs text-navy-400">
          {coverage === "included" ? "Covered in full by insurance." : "Patient pays the full retail amount."}
        </p>
      )}
    </div>
  );
}

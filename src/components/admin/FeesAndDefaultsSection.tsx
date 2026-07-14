"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { MoneyField } from "@/components/ui/money-field";
import { Select } from "@/components/ui/select";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import { Separator } from "@/components/ui/separator";
import { CYLINDER_THRESHOLD_OPTIONS, formatCylinderThreshold } from "@/lib/prescriptionOptions";
import type { CoverageMethod, DefaultInsuranceCoverage } from "@/lib/types";

export function FeesAndDefaultsSection({
  defaultInsuranceCoverage,
  highCylinderSurfacingFeeCents,
  highCylinderThresholdDiopters,
  onChangeDefaultInsuranceCoverage,
  onChangeHighCylinderSurfacingFeeCents,
  onChangeHighCylinderThresholdDiopters,
}: {
  defaultInsuranceCoverage: DefaultInsuranceCoverage;
  highCylinderSurfacingFeeCents: number;
  highCylinderThresholdDiopters: number;
  onChangeDefaultInsuranceCoverage: (value: DefaultInsuranceCoverage) => void;
  onChangeHighCylinderSurfacingFeeCents: (cents: number) => void;
  onChangeHighCylinderThresholdDiopters: (value: number) => void;
}) {
  function set(patch: Partial<DefaultInsuranceCoverage>) {
    onChangeDefaultInsuranceCoverage({ ...defaultInsuranceCoverage, ...patch });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Default Insurance Coverage &amp; Surfacing Fees</CardTitle>
        <CardDescription>
          Pre-fills each new quote&apos;s unified Insurance section. Every value stays fully editable per patient in the
          Quote Builder.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">Frame</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DefaultCoverageField
              label="Frame coverage"
              method={defaultInsuranceCoverage.frameCoverage}
              onChange={(frameCoverage) => set({ frameCoverage })}
            />
            <Field
              label="Frame allowance"
              valueCents={defaultInsuranceCoverage.frameAllowanceCents}
              onChangeCents={(cents) => set({ frameAllowanceCents: cents })}
            />
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">Lenses</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DefaultCoverageField
              label="Lens coverage"
              method={defaultInsuranceCoverage.lensCoverage}
              onChange={(lensCoverage) => set({ lensCoverage })}
            />
            <Field
              label="Lens allowance"
              valueCents={defaultInsuranceCoverage.lensAllowanceCents}
              onChangeCents={(cents) => set({ lensAllowanceCents: cents })}
            />
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">Upgrades</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DefaultCoverageField
              label="Coating coverage"
              method={defaultInsuranceCoverage.coatingCoverage}
              onChange={(coatingCoverage) => set({ coatingCoverage })}
            />
            <DefaultCoverageField
              label="Photochromic coverage"
              method={defaultInsuranceCoverage.photochromicCoverage}
              onChange={(photochromicCoverage) => set({ photochromicCoverage })}
            />
            <Field
              label="Other copay"
              valueCents={defaultInsuranceCoverage.otherCopayCents}
              onChangeCents={(cents) => set({ otherCopayCents: cents })}
            />
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">Additional coverage</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Additional insurance allowance or credit"
              valueCents={defaultInsuranceCoverage.additionalAllowanceCents}
              onChangeCents={(cents) => set({ additionalAllowanceCents: cents })}
            />
            <Field
              label="Other non-covered charge"
              valueCents={defaultInsuranceCoverage.otherChargeCents}
              onChangeCents={(cents) => set({ otherChargeCents: cents })}
            />
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">Surfacing fees</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-md">
            <div>
              <Label htmlFor="high-cylinder-fee">High-cylinder surfacing fee</Label>
              <MoneyField
                id="high-cylinder-fee"
                valueCents={highCylinderSurfacingFeeCents}
                onChangeCents={onChangeHighCylinderSurfacingFeeCents}
              />
            </div>
            <div>
              <Label htmlFor="high-cylinder-threshold">Qualifying cylinder threshold</Label>
              <Select
                id="high-cylinder-threshold"
                value={String(highCylinderThresholdDiopters)}
                onChange={(e) => onChangeHighCylinderThresholdDiopters(Number(e.target.value))}
                aria-label="Qualifying cylinder threshold"
              >
                {CYLINDER_THRESHOLD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <p className="mt-1 text-xs text-navy-400">
            Automatically added when either eye&apos;s cylinder is {formatCylinderThreshold(highCylinderThresholdDiopters)}{" "}
            or more negative, the selected material is flagged below as needing it and is not High Index, and the lens
            type is Single Vision or Bifocal. Mutually exclusive with the Transitions custom-color surfacing fee — only
            the higher of the two is ever charged.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  valueCents,
  onChangeCents,
}: {
  label: string;
  valueCents: number;
  onChangeCents: (cents: number) => void;
}) {
  const id = `field-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <MoneyField id={id} valueCents={valueCents} onChangeCents={onChangeCents} />
    </div>
  );
}

const COVERAGE_METHOD_OPTIONS: SegmentedOption<CoverageMethod["type"]>[] = [
  { value: "retail", label: "Retail" },
  { value: "copay", label: "Copay" },
  { value: "covered", label: "Covered" },
];

/**
 * Office-wide default CoverageMethod picker for one category. Unlike the
 * per-item Admin Pricing overrides (CoverageOverrideField), there is no
 * "use default" choice here — this field IS the default, so it must always
 * resolve to one of the three explicit states.
 */
function DefaultCoverageField({
  label,
  method,
  onChange,
}: {
  label: string;
  method: CoverageMethod;
  onChange: (method: CoverageMethod) => void;
}) {
  const id = `field-${label.replace(/\s+/g, "-").toLowerCase()}`;
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

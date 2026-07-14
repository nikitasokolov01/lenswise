"use client";

import { Label } from "@/components/ui/label";
import { MoneyField } from "@/components/ui/money-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { CoverageMethod } from "@/lib/types";

type OverrideChoice = "default" | "retail" | "copay" | "covered";

const OVERRIDE_OPTIONS: { value: OverrideChoice; label: string }[] = [
  { value: "default", label: "Office default" },
  { value: "retail", label: "Retail" },
  { value: "copay", label: "Copay" },
  { value: "covered", label: "Covered" },
];

/**
 * Per-item Admin Pricing override for one insurable category (a specific
 * material price row, coating, or photochromic product). `undefined` means
 * "use the office's default coverage method for this category" — selecting
 * Retail/Copay/Covered here replaces that default for this specific item
 * only. Kept separate from the quote-level CoverageMethod picker
 * (InsuranceStep.tsx) because "no override" is a real, distinct fourth
 * state here that has no equivalent at the quote level.
 */
export function CoverageOverrideField({
  id,
  label,
  override,
  onChange,
}: {
  id: string;
  label: string;
  override: CoverageMethod | undefined;
  onChange: (override: CoverageMethod | undefined) => void;
}) {
  const choice: OverrideChoice = override === undefined ? "default" : override.type;

  return (
    <div>
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <div id={id} className="space-y-2">
        <SegmentedControl
          label={label}
          options={OVERRIDE_OPTIONS}
          value={choice}
          onChange={(value) => {
            if (value === "default") {
              onChange(undefined);
            } else if (value === "copay") {
              onChange({ type: "copay", amountCents: override?.type === "copay" ? override.amountCents : 0 });
            } else {
              onChange({ type: value });
            }
          }}
        />
        {choice === "copay" ? (
          <MoneyField
            valueCents={override?.type === "copay" ? override.amountCents : 0}
            onChangeCents={(cents) => onChange({ type: "copay", amountCents: cents })}
            aria-label={`${label} amount`}
          />
        ) : null}
      </div>
    </div>
  );
}

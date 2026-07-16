"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/money";
import { formatUsageLabelForCustomer } from "@/lib/usageOptions";
import type { InsuranceBreakdown, PricingConfiguration, QuoteCalculationResult, UsageKey } from "@/lib/types";

/** Insurance lines to show a patient: their copays/charges, then insurance allowances/covered items. Only non-zero lines. */
function patientInsuranceLines(b: InsuranceBreakdown): {
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

interface PatientViewProps {
  result: QuoteCalculationResult;
  config: PricingConfiguration;
  usage: UsageKey | null;
  onClose: () => void;
}

/**
 * Full-screen, patient-facing view of the current quote.
 *
 * Shows ONLY understandable product descriptions, retail value, insurance
 * contribution, and patient responsibility. Never shows admin controls,
 * internal notes, technical configuration fields, or cost/markup data —
 * none of that data even flows into this component's props.
 */
export function PatientView({ result, config, usage, onClose }: PatientViewProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const priceableItems = result.lineItems.filter((li) => li.category !== "discount");
  const discountItems = result.lineItems.filter((li) => li.category === "discount");
  const insuranceLines = result.insuranceBreakdown ? patientInsuranceLines(result.insuranceBreakdown) : null;
  // Off by default: show generalized names and hide the material/technology
  // description. When the office opts in, show the exact names instead.
  const showExact = config.showExactTechnologyNamesOnCustomerQuotes;
  const usageLabel = formatUsageLabelForCustomer(usage, showExact);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Patient view"
      className="no-print fixed inset-0 z-50 flex flex-col bg-paper pt-safe-top pb-safe-bottom pl-safe-left pr-safe-right"
    >
      <header className="flex items-center justify-between border-b border-navy-100 bg-white px-5 py-4 sm:px-8">
        <div>
          <p className="text-lg font-semibold text-navy-900">{config.officeName}</p>
          <p className="text-sm text-navy-500">Your glasses quote</p>
        </div>
        <Button ref={closeButtonRef} variant="secondary" onClick={onClose}>
          <X className="h-4 w-4" aria-hidden="true" />
          Back to optician view
        </Button>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-5 py-6 sm:px-8">
        {usageLabel ? (
          <p className="mb-4 text-base text-navy-700">
            <span className="font-medium text-navy-900">Usage:</span> {usageLabel}
          </p>
        ) : null}
        <ul className="space-y-3">
          {priceableItems.length === 0 ? (
            <li className="text-navy-400">No options selected yet.</li>
          ) : (
            priceableItems.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-4 border-b border-navy-100 pb-3">
                <div>
                  <p className="text-base font-medium text-navy-900">
                    {showExact ? item.label : item.customerLabel}
                  </p>
                  {showExact && item.description ? (
                    <p className="text-sm text-navy-500">{item.description}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-base font-semibold text-navy-900 tabular-nums">
                  {formatCents(item.amountCents)}
                </span>
              </li>
            ))
          )}
          {discountItems.map((item) => (
            <li key={item.id} className="flex items-baseline justify-between gap-4 border-b border-navy-100 pb-3">
              <p className="text-base font-medium text-teal-700">
                {showExact ? item.label : item.customerLabel}
              </p>
              <span className="shrink-0 text-base font-semibold text-teal-700 tabular-nums">
                -{formatCents(Math.abs(item.amountCents))}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 space-y-2 text-base">
          <div className="flex items-center justify-between">
            <span className="text-navy-600">Retail value</span>
            <span className="font-medium text-navy-900 tabular-nums">{formatCents(result.retailTotalCents)}</span>
          </div>

          {insuranceLines ? (
            <>
              {insuranceLines.patient.map((line) => (
                <div key={line.label} className="flex items-center justify-between">
                  <span className="text-navy-600">{line.label}</span>
                  <span className="font-medium text-navy-900 tabular-nums">{formatCents(line.cents)}</span>
                </div>
              ))}
              {insuranceLines.insurance.map((line) => (
                <div key={line.label} className="flex items-center justify-between">
                  <span className="text-navy-600">{line.label}</span>
                  <span className="font-medium text-teal-700 tabular-nums">-{formatCents(line.cents)}</span>
                </div>
              ))}
            </>
          ) : result.insuranceContributionCents > 0 ? (
            <div className="flex items-center justify-between">
              <span className="text-navy-600">Insurance contribution</span>
              <span className="font-medium text-teal-700 tabular-nums">
                -{formatCents(result.insuranceContributionCents)}
              </span>
            </div>
          ) : null}

          {result.discountTotalCents > 0 ? (
            <div className="flex items-center justify-between">
              <span className="text-navy-600">Discounts</span>
              <span className="font-medium text-teal-700 tabular-nums">-{formatCents(result.discountTotalCents)}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-6 rounded-xl border-2 border-navy-900 bg-navy-900 p-6 text-center text-white">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-300">Your responsibility</p>
          <p className="mt-2 text-5xl font-bold tabular-nums">{formatCents(result.patientResponsibilityCents)}</p>
        </div>

        <p className="mt-6 text-center text-sm text-navy-400">{config.disclaimerText}</p>
      </main>

      <footer className="border-t border-navy-100 bg-white px-5 py-4 text-center sm:px-8">
        <Button variant="primary" size="lg" onClick={onClose} className="w-full sm:w-auto">
          Back to optician view
        </Button>
      </footer>
    </div>
  );
}

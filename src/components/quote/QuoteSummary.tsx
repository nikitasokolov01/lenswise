"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/money";
import { formatUsageLabel } from "@/lib/usageOptions";
import type {
  InsuranceBreakdown,
  InsuranceMode,
  PricingConfiguration,
  QuoteCalculationResult,
  UsageKey,
} from "@/lib/types";

/** Patient-owed lines from the insurance breakdown (each a copay that replaces its category's retail, or a flat non-covered charge). */
function patientBreakdownLines(b: InsuranceBreakdown): Array<{ label: string; cents: number }> {
  return [
    { label: "Frame copay", cents: b.frameCopayCents },
    { label: "Lens copay", cents: b.lensCopayCents },
    { label: "Coating copay", cents: b.coatingCopayCents },
    { label: "Photochromic copay", cents: b.photochromicCopayCents },
    { label: "Tint copay", cents: b.tintCopayCents },
    { label: "Other copay", cents: b.otherCopayCents },
    { label: "Other non-covered charge", cents: b.otherChargeCents },
  ].filter((line) => line.cents > 0);
}

/** Insurance-paid lines from the breakdown (allowances applied + fully-covered categories). */
function insuranceBreakdownLines(b: InsuranceBreakdown): Array<{ label: string; cents: number }> {
  return [
    { label: "Frame allowance", cents: b.frameAllowanceAppliedCents },
    { label: "Lens allowance", cents: b.lensAllowanceAppliedCents },
    { label: "Additional insurance credit", cents: b.additionalAllowanceAppliedCents },
    { label: "Frame covered", cents: b.frameCoveredCents },
    { label: "Lens covered", cents: b.lensCoveredCents },
    { label: "Coating covered", cents: b.coatingCoveredCents },
    { label: "Photochromic covered", cents: b.photochromicCoveredCents },
    { label: "Tint covered", cents: b.tintCoveredCents },
  ].filter((line) => line.cents > 0);
}

interface QuoteSummaryProps {
  result: QuoteCalculationResult;
  config: PricingConfiguration;
  mode: InsuranceMode;
  usage: UsageKey | null;
  className?: string;
}

const MODE_LABEL: Record<InsuranceMode, string> = {
  retail: "Retail / Self-Pay",
  insurance: "Use Insurance",
  manual: "Manual Final Price Override",
};

export function QuoteSummary({ result, config, mode, usage, className }: QuoteSummaryProps) {
  const usageLabel = formatUsageLabel(usage);
  const {
    lineItems,
    retailTotalCents,
    discountTotalCents,
    insuranceContributionCents,
    unusedAllowanceCents,
    insuranceBreakdown,
    patientResponsibilityCents,
    isManualOverride,
    overrideNote,
    preOverridePatientResponsibilityCents,
    warnings,
  } = result;

  const priceableItems = lineItems.filter((li) => li.category !== "discount");
  const discountItems = lineItems.filter((li) => li.category === "discount");

  return (
    <Card className={className} id="quote-summary">
      <CardHeader>
        <CardTitle>Quote Summary</CardTitle>
        <p className="text-sm text-navy-500">{config.officeName}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {usageLabel ? (
          <p className="text-sm text-navy-600">
            <span className="font-medium text-navy-800">Usage:</span> {usageLabel}
          </p>
        ) : null}

        {warnings.length > 0 ? (
          <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            {warnings.map((warning, i) => (
              <p key={i} className="text-xs text-amber-900">
                {warning}
              </p>
            ))}
          </div>
        ) : null}

        <ul className="space-y-2">
          {priceableItems.length === 0 ? (
            <li className="text-sm text-navy-400">No options selected yet.</li>
          ) : (
            priceableItems.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-navy-700">
                  {item.label}
                  {item.description ? (
                    <span className="block text-xs text-navy-400">{item.description}</span>
                  ) : null}
                </span>
                <span className="shrink-0 font-medium text-navy-900 tabular-nums">{formatCents(item.amountCents)}</span>
              </li>
            ))
          )}
          {discountItems.map((item) => (
            <li key={item.id} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-teal-700">{item.label}</span>
              <span className="shrink-0 font-medium text-teal-700 tabular-nums">
                -{formatCents(Math.abs(item.amountCents))}
              </span>
            </li>
          ))}
        </ul>

        <div className="border-t border-navy-100 pt-3 space-y-1.5">
          <SummaryRow label="Retail total" valueCents={retailTotalCents} />
          {discountTotalCents > 0 ? <SummaryRow label="Total discounts" valueCents={-discountTotalCents} muted /> : null}
        </div>

        <div className="rounded-md bg-navy-50 p-3 space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-navy-500">{MODE_LABEL[mode]}</p>
          {mode === "insurance" && insuranceBreakdown ? (
            <InsuranceBreakdownDetail
              breakdown={insuranceBreakdown}
              insuranceContributionCents={insuranceContributionCents}
            />
          ) : mode === "manual" ? (
            <p className="text-sm text-navy-700">Manual override — see note below.</p>
          ) : (
            <p className="text-sm text-navy-700">Patient pays the full retail total.</p>
          )}
        </div>

        {isManualOverride ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
            <Badge variant="warning">Manual override applied</Badge>
            <p className="mt-1.5 text-sm text-navy-700">
              Calculated retail-based total was{" "}
              <span className="font-medium">{formatCents(preOverridePatientResponsibilityCents ?? 0)}</span>. The
              optician has overridden the final patient responsibility below.
            </p>
            {overrideNote ? <p className="mt-1 text-xs text-navy-500">Internal note: {overrideNote}</p> : null}
          </div>
        ) : null}

        {unusedAllowanceCents > 0 ? (
          <p className="text-xs text-navy-500">
            Unused allowance not applied elsewhere: <span className="font-medium">{formatCents(unusedAllowanceCents)}</span>
          </p>
        ) : null}

        <div className="rounded-lg border-2 border-navy-900 bg-navy-900 p-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">Patient Responsibility</p>
          <p className="mt-1 text-4xl font-bold tabular-nums leading-none">{formatCents(patientResponsibilityCents)}</p>
        </div>

        <p className="border-t border-navy-100 pt-3 text-xs text-navy-400">{config.disclaimerText}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Itemized insurance breakdown: patient-owed copays/charges shown as
 * positive amounts, insurance allowances and fully-covered categories shown
 * as credits, and the total insurance contribution. Only lines that actually
 * apply are rendered — the quote never collapses everything into a single
 * "Insurance Contribution" line.
 */
function InsuranceBreakdownDetail({
  breakdown,
  insuranceContributionCents,
}: {
  breakdown: InsuranceBreakdown;
  insuranceContributionCents: number;
}) {
  const patientLines = patientBreakdownLines(breakdown);
  const insuranceLines = insuranceBreakdownLines(breakdown);

  if (patientLines.length === 0 && insuranceLines.length === 0) {
    return <p className="text-sm text-navy-700">No insurance copays, allowances, or covered items entered yet.</p>;
  }

  return (
    <div className="space-y-1 text-sm text-navy-700">
      {patientLines.map((line) => (
        <SummaryRow key={line.label} label={line.label} valueCents={line.cents} />
      ))}
      {insuranceLines.map((line) => (
        <SummaryRow key={line.label} label={line.label} valueCents={-line.cents} muted />
      ))}
      {insuranceContributionCents > 0 ? (
        <div className="mt-1 border-t border-navy-100 pt-1.5">
          <SummaryRow label="Total insurance contribution" valueCents={-insuranceContributionCents} muted />
        </div>
      ) : null}
    </div>
  );
}

function SummaryRow({ label, valueCents, muted }: { label: string; valueCents: number; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={muted ? "text-teal-700" : "text-navy-600"}>{label}</span>
      <span className={`font-medium tabular-nums ${muted ? "text-teal-700" : "text-navy-900"}`}>
        {valueCents < 0 ? "-" : ""}
        {formatCents(Math.abs(valueCents))}
      </span>
    </div>
  );
}

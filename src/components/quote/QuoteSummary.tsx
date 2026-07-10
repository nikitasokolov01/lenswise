"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/money";
import type { InsuranceMode, PricingConfiguration, QuoteCalculationResult } from "@/lib/types";

interface QuoteSummaryProps {
  result: QuoteCalculationResult;
  config: PricingConfiguration;
  mode: InsuranceMode;
  className?: string;
}

const MODE_LABEL: Record<InsuranceMode, string> = {
  retail: "Retail / Self-Pay",
  allowances: "Insurance Allowances",
  copays: "Insurance Copays",
  manual: "Manual Override",
};

export function QuoteSummary({ result, config, mode, className }: QuoteSummaryProps) {
  const {
    lineItems,
    retailTotalCents,
    discountTotalCents,
    insuranceContributionCents,
    unusedAllowanceCents,
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
                <span className="text-navy-700">{item.label}</span>
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
          <InsuranceBreakdownSection result={result} />
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

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <SummaryStat label="Total retail value" valueCents={retailTotalCents} />
          <SummaryStat label="Total insurance contribution" valueCents={insuranceContributionCents} />
          <SummaryStat label="Total discounts" valueCents={discountTotalCents} />
          <SummaryStat label="Amount due from patient" valueCents={patientResponsibilityCents} emphasize />
        </dl>

        <p className="border-t border-navy-100 pt-3 text-xs text-navy-400">{config.disclaimerText}</p>
      </CardContent>
    </Card>
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

function SummaryStat({
  label,
  valueCents,
  emphasize,
}: {
  label: string;
  valueCents: number;
  emphasize?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-navy-500">{label}</dt>
      <dd className={`tabular-nums ${emphasize ? "text-base font-semibold text-navy-900" : "text-sm text-navy-700"}`}>
        {formatCents(valueCents)}
      </dd>
    </div>
  );
}

function InsuranceBreakdownSection({ result }: { result: QuoteCalculationResult }) {
  if (result.isManualOverride) {
    return <p className="text-sm text-navy-700">Manual override — see note above.</p>;
  }
  if (result.allowanceBreakdown) {
    const b = result.allowanceBreakdown;
    return (
      <div className="space-y-1 text-sm text-navy-700">
        <SummaryRow label="Frame allowance applied" valueCents={-b.frameAllowanceAppliedCents} muted />
        <SummaryRow label="Lens allowance applied" valueCents={-b.lensAllowanceAppliedCents} muted />
        {b.additionalCreditAppliedCents > 0 ? (
          <SummaryRow label="Additional credit applied" valueCents={-b.additionalCreditAppliedCents} muted />
        ) : null}
      </div>
    );
  }
  return <SummaryRow label="Insurance contribution" valueCents={-result.insuranceContributionCents} muted />;
}

"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/money";
import { formatUsageLabelForCustomer } from "@/lib/usageOptions";
import { patientDisplaySections, patientInsuranceLines, type PatientQuotePair } from "@/lib/patientQuoteDisplay";
import type { PricingConfiguration, QuoteCalculationResult, UsageKey } from "@/lib/types";

interface PatientViewProps {
  result: QuoteCalculationResult;
  config: PricingConfiguration;
  usage: UsageKey | null;
  pairs?: PatientQuotePair[];
  onClose: () => void;
}

/** Separate pair cards show customer-safe selections, benefits, and the final quoted amounts. */
export function PatientView({ result, config, usage, pairs, onClose }: PatientViewProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const displayedPairs: PatientQuotePair[] = pairs?.length ? pairs : [{ id: "pair-1", label: "Pair 1", result, usage }];
  const totalCents = displayedPairs.reduce((total, pair) => total + pair.result.patientResponsibilityCents, 0);
  const showExact = config.showExactTechnologyNamesOnCustomerQuotes;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="patient-view-title"
      className="no-print fixed inset-0 z-50 flex flex-col bg-paper pt-safe-top pb-safe-bottom pl-safe-left pr-safe-right"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-navy-100 bg-white px-5 py-4 sm:px-8">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-navy-900">{config.officeName}</p>
          <h1 id="patient-view-title" className="text-sm text-navy-500">Your glasses quote</h1>
        </div>
        <Button ref={closeButtonRef} variant="secondary" className="shrink-0" onClick={onClose} aria-label="Back to optician view">
          <X className="h-4 w-4" aria-hidden="true" />
          <span className="sm:hidden">Back</span>
          <span className="hidden sm:inline">Back to optician view</span>
        </Button>
      </header>

      <main className={`mx-auto min-h-0 w-full flex-1 overflow-y-auto px-5 py-6 sm:px-8 ${displayedPairs.length > 1 ? "max-w-5xl" : "max-w-3xl"}`}>
        <div className={`grid grid-cols-1 items-start gap-5 ${displayedPairs.length > 1 ? "lg:grid-cols-2" : ""}`}>
          {displayedPairs.map((pair) => <PatientPairCard key={pair.id} pair={pair} showExact={showExact} />)}
        </div>

        <div className="mt-6 rounded-2xl bg-navy-900 p-6 text-center text-white shadow-card">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-300">
            {displayedPairs.length > 1 ? "Combined total" : "Your total"}
          </p>
          <p className="mt-2 text-4xl font-bold tabular-nums sm:text-5xl">{formatCents(totalCents)}</p>
          <p className="mt-2 text-sm text-navy-200">
            {displayedPairs.length > 1 ? `Your responsibility for all ${displayedPairs.length} pairs` : "Your responsibility for this pair"}
          </p>
        </div>
        <p className="mt-6 text-center text-sm leading-6 text-navy-500">{config.disclaimerText}</p>
      </main>

      <footer className="shrink-0 border-t border-navy-100 bg-white px-5 py-4 text-center sm:px-8">
        <Button variant="primary" size="lg" onClick={onClose} className="w-full sm:w-auto">Back to optician view</Button>
      </footer>
    </div>
  );
}

function PatientPairCard({ pair, showExact }: { pair: PatientQuotePair; showExact: boolean }) {
  const sections = patientDisplaySections(pair.result.lineItems, showExact);
  const usageLabel = formatUsageLabelForCustomer(pair.usage, showExact);
  const insuranceLines = pair.result.insuranceBreakdown ? patientInsuranceLines(pair.result.insuranceBreakdown) : null;
  const hasInsuranceLines = insuranceLines && (insuranceLines.patient.length > 0 || insuranceLines.insurance.length > 0);

  return (
    <section aria-labelledby={`patient-${pair.id}-title`} className="min-w-0 overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-card">
      <header className="border-b border-navy-100 bg-teal-50/60 px-5 py-4">
        <h2 id={`patient-${pair.id}-title`} className="text-xl font-bold text-navy-900">{pair.label}</h2>
        {usageLabel ? <p className="mt-1 text-sm text-navy-600">{usageLabel}</p> : null}
      </header>

      <div className="space-y-5 px-5 py-5">
        {sections.length > 0 ? sections.map((section) => (
          <section key={section.title} aria-label={`${pair.label} ${section.title}`}>
            <h3 className={`mb-2 text-xs font-bold uppercase tracking-wider ${section.isDiscount ? "text-teal-700" : "text-navy-500"}`}>{section.title}</h3>
            <ul className="space-y-2.5">
              {section.items.map((item) => (
                <li key={item.id} className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`break-words text-[15px] font-medium ${section.isDiscount ? "text-teal-800" : "text-navy-900"}`}>{item.label}</p>
                    {item.description ? <p className="mt-0.5 break-words text-sm text-navy-500">{item.description}</p> : null}
                  </div>
                  <span className={`shrink-0 text-[15px] font-semibold tabular-nums ${section.isDiscount ? "text-teal-700" : "text-navy-900"}`}>
                    {item.amountCents < 0 ? "−" : ""}{formatCents(Math.abs(item.amountCents))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )) : <p className="text-sm text-navy-500">No options selected yet.</p>}

        <div className="flex justify-between gap-3 border-t border-navy-100 pt-4 text-sm">
          <span className="text-navy-500">Retail value</span>
          <span className="font-medium text-navy-700 tabular-nums">{formatCents(pair.result.retailTotalCents)}</span>
        </div>

        {hasInsuranceLines ? (
          <section aria-label={`${pair.label} insurance`} className="rounded-xl bg-navy-50 p-3.5">
            <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-navy-500">Insurance</h3>
            <div className="space-y-2 text-sm">
              {insuranceLines.patient.map((line) => (
                <div key={line.label} className="flex justify-between gap-3">
                  <span className="text-navy-600">{line.label}</span>
                  <span className="shrink-0 font-medium text-navy-900 tabular-nums">{formatCents(line.cents)}</span>
                </div>
              ))}
              {insuranceLines.insurance.map((line) => (
                <div key={line.label} className="flex justify-between gap-3">
                  <span className="text-navy-600">{line.label}</span>
                  <span className="shrink-0 font-medium text-teal-700 tabular-nums">−{formatCents(line.cents)}</span>
                </div>
              ))}
            </div>
          </section>
        ) : pair.result.insuranceContributionCents > 0 ? (
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-navy-600">Insurance contribution</span>
            <span className="font-medium text-teal-700 tabular-nums">−{formatCents(pair.result.insuranceContributionCents)}</span>
          </div>
        ) : null}

        {pair.result.isManualOverride ? <p className="text-xs text-navy-500">Final price set by your optician.</p> : null}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-teal-100 bg-teal-50 px-5 py-4">
        <p className="text-sm font-semibold text-navy-800">Pair subtotal <span className="block text-xs font-normal text-navy-500">Your responsibility</span></p>
        <p className="text-2xl font-bold text-navy-950 tabular-nums">{formatCents(pair.result.patientResponsibilityCents)}</p>
      </footer>
    </section>
  );
}

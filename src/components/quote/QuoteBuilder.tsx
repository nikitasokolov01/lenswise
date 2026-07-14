"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { usePricingConfiguration } from "@/lib/pricing/usePricingConfiguration";
import { calculateQuote } from "@/lib/calculation/calculateQuote";
import { createDefaultQuoteInput } from "@/lib/calculation/defaultQuoteInput";
import { quoteReducer } from "@/components/quote/quoteReducer";
import { FrameStep } from "@/components/quote/FrameStep";
import { UsageStep } from "@/components/quote/UsageStep";
import { LensTypeStep } from "@/components/quote/LensTypeStep";
import { MaterialStep } from "@/components/quote/MaterialStep";
import { PrescriptionStep } from "@/components/quote/PrescriptionStep";
import { CoatingStep } from "@/components/quote/CoatingStep";
import { PhotochromicStep } from "@/components/quote/PhotochromicStep";
import { TintStep } from "@/components/quote/TintStep";
import { InsuranceStep } from "@/components/quote/InsuranceStep";
import { AdjustmentsStep } from "@/components/quote/AdjustmentsStep";
import { QuoteSummary } from "@/components/quote/QuoteSummary";
import { QuoteActions } from "@/components/quote/QuoteActions";
import { PatientView } from "@/components/quote/PatientView";
import { CustomerEstimatePrint } from "@/components/quote/PrintableQuote";
import { InternalOrderWorksheetPrint } from "@/components/quote/InternalOrderWorksheetPrint";
import { DemoPricingBanner } from "@/components/layout/DemoPricingBanner";
import { clampNonNegative } from "@/lib/money";

function QuoteBuilderSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="h-8 w-64 animate-pulse rounded bg-navy-100" />
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg bg-navy-100" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-lg bg-navy-100" />
      </div>
    </div>
  );
}

export function QuoteBuilder() {
  const { configuration, isLoading } = usePricingConfiguration();

  if (isLoading || !configuration) {
    return <QuoteBuilderSkeleton />;
  }

  return <QuoteBuilderReady initialConfig={configuration} />;
}

function QuoteBuilderReady({
  initialConfig,
}: {
  initialConfig: NonNullable<ReturnType<typeof usePricingConfiguration>["configuration"]>;
}) {
  const config = initialConfig;
  const [input, dispatch] = useReducer(quoteReducer, config, createDefaultQuoteInput);
  const [patientViewOpen, setPatientViewOpen] = useState(false);
  const [printMode, setPrintMode] = useState<"customer" | "internal">("customer");
  const [printRequestId, setPrintRequestId] = useState(0);

  const lensType = input.lensTypeId
    ? config.lensTypes.find((lt) => lt.id === input.lensTypeId)
    : undefined;

  // Lens configuration (lens type, progressive design, material, coating,
  // photochromic) stays locked until a valid prescription has been applied
  // — never applicable at all for a frame-only order.
  const isFrameOnly = input.orderType === "frame_only";
  const lensControlsDisabled = isFrameOnly || input.prescription === null;
  const lensControlsDisabledReason = isFrameOnly
    ? "Not applicable for a frame-only order."
    : "Enter and apply a valid prescription above to continue configuring lenses.";

  // Calculation happens here, via the pure calculateQuote function — never
  // inline in JSX — and is memoized so it only re-runs when inputs change.
  const result = useMemo(() => calculateQuote(input, config), [input, config]);

  const preOverrideEstimateCents = useMemo(() => {
    if (input.insurance.mode === "manual") {
      return result.preOverridePatientResponsibilityCents ?? 0;
    }
    return clampNonNegative(result.retailTotalCents - result.discountTotalCents);
  }, [input.insurance.mode, result]);

  // Printing a specific layout requires the DOM to reflect the new
  // printMode before window.print() runs. Updating printMode and bumping
  // printRequestId happen in the same render; this effect then fires after
  // the commit, so by the time window.print() runs the correct print-only
  // section is already the one marked `print:block`.
  useEffect(() => {
    if (printRequestId === 0) return;
    window.print();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printRequestId]);

  function requestPrint(mode: "customer" | "internal") {
    setPrintMode(mode);
    setPrintRequestId((n) => n + 1);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <DemoPricingBanner />

      <div className="mb-6 no-print">
        <h1 className="text-3xl font-bold tracking-tight text-navy-900">LensWise</h1>
        <p className="text-base font-medium text-teal-700">Optical Quote Builder</p>
        <p className="mt-2 text-sm text-navy-500">
          Configure a pair of glasses to instantly generate a patient price breakdown. This tool does not collect
          or store any patient-identifying information.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-5 lg:col-span-2 no-print">
          <FrameStep input={input} dispatch={dispatch} />
          <UsageStep input={input} dispatch={dispatch} />
          <PrescriptionStep input={input} dispatch={dispatch} />
          <LensTypeStep
            input={input}
            dispatch={dispatch}
            lensTypes={config.lensTypes}
            progressiveDesigns={config.progressiveDesigns}
            disabled={lensControlsDisabled}
            disabledReason={lensControlsDisabledReason}
          />
          <MaterialStep
            input={input}
            dispatch={dispatch}
            materials={config.materials}
            lensType={lensType}
            disabled={lensControlsDisabled}
            disabledReason={lensControlsDisabledReason}
          />
          <CoatingStep
            input={input}
            dispatch={dispatch}
            coatings={config.coatings}
            lensType={lensType}
            disabled={lensControlsDisabled}
            disabledReason={lensControlsDisabledReason}
          />
          <PhotochromicStep
            input={input}
            dispatch={dispatch}
            products={config.photochromicProducts}
            colors={config.photochromicColors}
            lensType={lensType}
            transitionsSurfacingFeeCents={config.transitionsSurfacingFeeCents}
            disabled={lensControlsDisabled}
            disabledReason={lensControlsDisabledReason}
          />
          <TintStep
            input={input}
            dispatch={dispatch}
            tints={config.tints}
            disabled={lensControlsDisabled}
            disabledReason={lensControlsDisabledReason}
          />
          <InsuranceStep input={input} dispatch={dispatch} preOverrideEstimateCents={preOverrideEstimateCents} />
          <AdjustmentsStep input={input} dispatch={dispatch} />
        </div>

        <div className="lg:sticky lg:top-6 space-y-4 no-print">
          <QuoteActions
            result={result}
            config={config}
            usage={input.usage}
            onResetQuote={() => dispatch({ type: "RESET_QUOTE", config })}
            onOpenPatientView={() => setPatientViewOpen(true)}
            onPrintCustomerEstimate={() => requestPrint("customer")}
            onPrintInternalWorksheet={() => requestPrint("internal")}
          />
          <QuoteSummary result={result} config={config} mode={input.insurance.mode} usage={input.usage} />
        </div>
      </div>

      {printMode === "customer" ? <CustomerEstimatePrint result={result} config={config} usage={input.usage} /> : null}
      {printMode === "internal" ? (
        <InternalOrderWorksheetPrint input={input} result={result} config={config} />
      ) : null}

      {patientViewOpen ? (
        <PatientView result={result} config={config} usage={input.usage} onClose={() => setPatientViewOpen(false)} />
      ) : null}
    </div>
  );
}

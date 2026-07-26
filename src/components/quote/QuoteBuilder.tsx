"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
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
import { BlueLightStep } from "@/components/quote/BlueLightStep";
import { SurfacingStep } from "@/components/quote/SurfacingStep";
import { InsuranceStep } from "@/components/quote/InsuranceStep";
import { AdjustmentsStep } from "@/components/quote/AdjustmentsStep";
import { QuoteSummary } from "@/components/quote/QuoteSummary";
import { QuoteActions } from "@/components/quote/QuoteActions";
import { PatientView } from "@/components/quote/PatientView";
import { CustomerEstimatePrint } from "@/components/quote/PrintableQuote";
import { InternalOrderWorksheetPrint } from "@/components/quote/InternalOrderWorksheetPrint";
import {
  QUOTE_STAGE_LABELS,
  QuoteWizardFooter,
  QuoteWizardProgress,
  type QuoteStage,
} from "@/components/quote/QuoteWizardNavigation";
import { compatibleMaterials, materialSupportsCombo } from "@/lib/calculation/materialCompatibility";
import { clampNonNegative } from "@/lib/money";
import type { QuoteFrameInventoryOption } from "@/lib/inventory/types";
import type { OrganizationLocation } from "@/lib/locations/types";
import type { CompletedSale } from "@/lib/sales/types";

const ALL_QUOTE_STAGES: QuoteStage[] = ["order", "prescription", "lenses", "addons", "review"];

const STAGE_COPY: Record<QuoteStage, { title: string; description: string }> = {
  order: {
    title: "Start the order",
    description: "Choose what the order includes, add the frame details, and note how the glasses will be used.",
  },
  prescription: {
    title: "Enter prescription details",
    description: "Apply the prescription and record the PD before choosing the lenses.",
  },
  lenses: {
    title: "Choose the lenses",
    description: "Select the lens type, design, and material that best fit this order.",
  },
  addons: {
    title: "Customize the lenses",
    description: "Add coatings, light-responsive options, tints, and other enhancements.",
  },
  review: {
    title: "Review and finish",
    description: "Apply insurance or adjustments, then present or print the completed quote.",
  },
};

function QuoteBuilderSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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

interface QuoteBuilderProps {
  activeLocation: OrganizationLocation;
  frameInventory: QuoteFrameInventoryOption[];
  frameInventoryLoadError?: string | null;
}

export function QuoteBuilder({
  activeLocation,
  frameInventory,
  frameInventoryLoadError = null,
}: QuoteBuilderProps) {
  const { configuration, isLoading, error, reload } = usePricingConfiguration();

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-800">Couldn&apos;t load your pricing</h2>
          <p className="mt-2 text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => reload()}
            className="mt-4 inline-flex min-h-[44px] items-center rounded-md bg-navy-900 px-4 text-sm font-medium text-white"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !configuration) {
    return <QuoteBuilderSkeleton />;
  }

  return (
    <QuoteBuilderReady
      initialConfig={configuration}
      activeLocation={activeLocation}
      frameInventory={frameInventory}
      frameInventoryLoadError={frameInventoryLoadError}
    />
  );
}

function QuoteBuilderReady({
  initialConfig,
  activeLocation,
  frameInventory,
  frameInventoryLoadError,
}: {
  initialConfig: NonNullable<ReturnType<typeof usePricingConfiguration>["configuration"]>;
  activeLocation: OrganizationLocation;
  frameInventory: QuoteFrameInventoryOption[];
  frameInventoryLoadError: string | null;
}) {
  const config = initialConfig;
  const [input, dispatch] = useReducer(quoteReducer, config, createDefaultQuoteInput);
  const [patientViewOpen, setPatientViewOpen] = useState(false);
  const [printMode, setPrintMode] = useState<"customer" | "internal">("customer");
  const [printRequestId, setPrintRequestId] = useState(0);
  const [activeStage, setActiveStage] = useState<QuoteStage>("order");
  const [saleKey, setSaleKey] = useState("");
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const wizardTopRef = useRef<HTMLDivElement>(null);
  const shouldScrollToTopRef = useRef(false);

  useEffect(() => {
    setSaleKey(crypto.randomUUID());
  }, []);

  const lensType = input.lensTypeId
    ? config.lensTypes.find((lt) => lt.id === input.lensTypeId)
    : undefined;
  const progressiveDesign = input.progressiveDesignId
    ? config.progressiveDesigns.find((d) => d.id === input.progressiveDesignId)
    : undefined;
  const material = input.materialId ? config.materials.find((m) => m.id === input.materialId) : undefined;

  // Only offer materials compatible with the chosen lens type (+ progressive
  // design). If the selected material becomes incompatible after a lens-type or
  // design change, clear it so an impossible combination can never persist.
  const availableMaterials = compatibleMaterials(config.materials, lensType, progressiveDesign);
  useEffect(() => {
    if (material && lensType && !materialSupportsCombo(material, lensType, progressiveDesign)) {
      dispatch({ type: "SET_MATERIAL", materialId: null });
    }
  }, [material, lensType, progressiveDesign]);

  // Lens configuration (lens type, progressive design, material, coating,
  // photochromic) stays locked until a valid prescription has been applied
  // — never applicable at all for a frame-only order.
  const isFrameOnly = input.orderType === "frame_only";
  const lensControlsDisabled = isFrameOnly || input.prescription === null;
  const lensControlsDisabledReason = isFrameOnly
    ? "Not applicable for a frame-only order."
    : "Enter and apply a valid prescription above to continue configuring lenses.";

  const lensSelectionComplete = Boolean(
    lensType &&
      input.materialId &&
      (lensType.key !== "progressive" || input.progressiveDesignId)
  );
  const frameSelectionComplete =
    input.orderType === "lens_only" ||
    (input.frame.entryMode === "inventory"
      ? input.frame.inventoryItemId !== null
      : input.frame.customDescription.trim().length > 0);
  const visibleStages = useMemo<QuoteStage[]>(
    () => (isFrameOnly ? ["order", "review"] : ALL_QUOTE_STAGES),
    [isFrameOnly]
  );
  const activeStageIndex = visibleStages.indexOf(activeStage);
  const previousStage = activeStageIndex > 0 ? visibleStages[activeStageIndex - 1] : undefined;
  const nextStage =
    activeStageIndex >= 0 && activeStageIndex < visibleStages.length - 1
      ? visibleStages[activeStageIndex + 1]
      : undefined;

  const completedStages = useMemo(() => {
    const completed = new Set<QuoteStage>();
    if (activeStage !== "order") completed.add("order");
    if (input.prescription) completed.add("prescription");
    if (lensSelectionComplete) completed.add("lenses");
    if (activeStage === "review") completed.add("addons");
    return completed;
  }, [activeStage, input.prescription, lensSelectionComplete]);

  const nextDisabled =
    (activeStage === "order" && !frameSelectionComplete) ||
    (activeStage === "prescription" && !input.prescription) ||
    (activeStage === "lenses" && !lensSelectionComplete);
  const nextHint =
    activeStage === "order" && !frameSelectionComplete
      ? input.frame.entryMode === "inventory"
        ? "Choose an in-stock frame from inventory, or switch to manual entry."
        : "Enter the frame name to continue."
      : activeStage === "prescription" && !input.prescription
      ? "Apply a valid prescription to continue."
      : activeStage === "lenses" && !lensSelectionComplete
        ? lensType?.key === "progressive" && !input.progressiveDesignId
          ? "Choose a progressive design and lens material to continue."
          : !lensType
            ? "Choose a lens type to continue."
            : "Choose a lens material to continue."
        : undefined;

  function canOpenStage(stage: QuoteStage): boolean {
    if (stage === "order") return true;
    if (!frameSelectionComplete) return false;
    if (isFrameOnly) return stage === "review";
    if (stage === "prescription") return true;
    if (stage === "lenses") return input.prescription !== null;
    return lensSelectionComplete;
  }

  function navigateToStage(stage: QuoteStage) {
    if (!canOpenStage(stage)) return;
    shouldScrollToTopRef.current = true;
    setActiveStage(stage);
  }

  useEffect(() => {
    if (isFrameOnly && activeStage !== "order" && activeStage !== "review") {
      setActiveStage("order");
      return;
    }
    if (!isFrameOnly && !input.prescription && ["lenses", "addons", "review"].includes(activeStage)) {
      setActiveStage("prescription");
      return;
    }
    if (!isFrameOnly && !lensSelectionComplete && ["addons", "review"].includes(activeStage)) {
      setActiveStage("lenses");
    }
  }, [activeStage, input.prescription, isFrameOnly, lensSelectionComplete]);

  useEffect(() => {
    if (!shouldScrollToTopRef.current) return;
    shouldScrollToTopRef.current = false;
    wizardTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeStage]);

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

  const stageCopy = STAGE_COPY[activeStage];
  const selectedInventoryFrame =
    input.frame.entryMode === "inventory" && input.frame.inventoryItemId
      ? frameInventory.find((frame) => frame.id === input.frame.inventoryItemId) ?? null
      : null;
  const canCompleteSale =
    activeStage === "review" &&
    frameSelectionComplete &&
    (isFrameOnly || Boolean(input.prescription && lensSelectionComplete));
  const completeSaleDisabledReason =
    activeStage !== "review"
      ? "Finish the quote and reach Review before recording payment."
      : !canCompleteSale
        ? "Complete the required frame and lens selections first."
        : undefined;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div ref={wizardTopRef} className="scroll-mt-20" />
      <header className="mb-5 no-print">
        <span className="inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-800">
          {activeLocation.name}
        </span>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">Build an eyewear quote</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-navy-500 sm:text-base">
          Guide the patient through each lens decision, keep pricing visible, and finish with a clear estimate.
        </p>
      </header>

      <QuoteWizardProgress
        stages={visibleStages}
        activeStage={activeStage}
        completedStages={completedStages}
        canOpenStage={canOpenStage}
        onStageChange={navigateToStage}
      />

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <main
          className={`no-print ${completedSale ? "pointer-events-none opacity-60" : ""}`}
          aria-disabled={completedSale ? "true" : undefined}
        >
          <div className="mb-5 text-center sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
              {QUOTE_STAGE_LABELS[activeStage]}
            </p>
            <h2 id="quote-stage-title" className="mt-1 text-2xl font-bold tracking-tight text-navy-900">
              {stageCopy.title}
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-navy-500">{stageCopy.description}</p>
          </div>

          <section aria-labelledby="quote-stage-title" className="space-y-5">
            {activeStage === "order" ? (
              <>
                <FrameStep
                  input={input}
                  dispatch={dispatch}
                  frameInventory={frameInventory}
                  inventoryLoadError={frameInventoryLoadError}
                />
                <UsageStep input={input} dispatch={dispatch} />
              </>
            ) : null}

            {activeStage === "prescription" ? <PrescriptionStep input={input} dispatch={dispatch} /> : null}

            {activeStage === "lenses" ? (
              <>
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
                  materials={availableMaterials}
                  lensType={lensType}
                  disabled={lensControlsDisabled}
                  disabledReason={lensControlsDisabledReason}
                />
                <SurfacingStep
                  input={input}
                  dispatch={dispatch}
                  result={result}
                  disabled={lensControlsDisabled}
                  disabledReason={lensControlsDisabledReason}
                />
              </>
            ) : null}

            {activeStage === "addons" ? (
              <>
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
                <BlueLightStep
                  input={input}
                  dispatch={dispatch}
                  options={config.blueLightOptions}
                  disabled={lensControlsDisabled}
                  disabledReason={lensControlsDisabledReason}
                />
              </>
            ) : null}

            {activeStage === "review" ? (
              <>
                <InsuranceStep
                  input={input}
                  dispatch={dispatch}
                  preOverrideEstimateCents={preOverrideEstimateCents}
                  surfacingApplies={result.surfacingFeeCents > 0}
                  blueLightApplies={input.blueLightId !== null}
                />
                <AdjustmentsStep input={input} dispatch={dispatch} />
              </>
            ) : null}
          </section>

          <QuoteWizardFooter
            hasPrevious={Boolean(previousStage)}
            hasNext={Boolean(nextStage)}
            nextDisabled={nextDisabled}
            nextHint={nextHint}
            onPrevious={() => previousStage && navigateToStage(previousStage)}
            onNext={() => nextStage && navigateToStage(nextStage)}
          />
        </main>

        <aside className="space-y-4 no-print lg:sticky lg:top-6">
          <QuoteSummary
            result={result}
            config={config}
            mode={input.insurance.mode}
            usage={input.usage}
            locationName={activeLocation.name}
          />
          <div className="rounded-lg border border-navy-100 bg-white p-4 shadow-card">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy-500">Quote tools</p>
            <QuoteActions
              result={result}
              config={config}
              usage={input.usage}
              locationName={activeLocation.name}
              saleKey={saleKey}
              canCompleteSale={canCompleteSale}
              completeSaleDisabledReason={completeSaleDisabledReason}
              completedSale={completedSale}
              onSaleCompleted={setCompletedSale}
              orderType={input.orderType}
              frameInventoryId={
                input.frame.entryMode === "inventory" ? input.frame.inventoryItemId : null
              }
              frameName={input.frame.customDescription}
              frameColor={input.frame.colorDescription}
              frameSize={input.frame.sizeDescription}
              frameSku={input.frame.sku}
              frameImageUrl={selectedInventoryFrame?.imageUrl ?? ""}
              onResetQuote={() => {
                dispatch({ type: "RESET_QUOTE", config });
                setActiveStage("order");
                setCompletedSale(null);
                setSaleKey(crypto.randomUUID());
              }}
              onOpenPatientView={() => setPatientViewOpen(true)}
              onPrintCustomerEstimate={() => requestPrint("customer")}
              onPrintInternalWorksheet={() => requestPrint("internal")}
            />
          </div>
        </aside>
      </div>

      {printMode === "customer" ? (
        <CustomerEstimatePrint
          result={result}
          config={config}
          usage={input.usage}
          location={activeLocation}
          completedSale={completedSale}
        />
      ) : null}
      {printMode === "internal" ? (
        <InternalOrderWorksheetPrint
          input={input}
          result={result}
          config={config}
          location={activeLocation}
          completedSale={completedSale}
        />
      ) : null}

      {patientViewOpen ? (
        <PatientView result={result} config={config} usage={input.usage} onClose={() => setPatientViewOpen(false)} />
      ) : null}
    </div>
  );
}

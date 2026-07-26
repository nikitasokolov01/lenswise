"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type QuoteStage = "order" | "prescription" | "lenses" | "addons" | "review";

export const QUOTE_STAGE_LABELS: Record<QuoteStage, string> = {
  order: "Order",
  prescription: "Prescription",
  lenses: "Lenses",
  addons: "Add-ons",
  review: "Review",
};

interface QuoteWizardProgressProps {
  stages: QuoteStage[];
  activeStage: QuoteStage;
  completedStages: Set<QuoteStage>;
  canOpenStage: (stage: QuoteStage) => boolean;
  onStageChange: (stage: QuoteStage) => void;
}

export function QuoteWizardProgress({
  stages,
  activeStage,
  completedStages,
  canOpenStage,
  onStageChange,
}: QuoteWizardProgressProps) {
  return (
    <nav aria-label="Quote progress" className="no-print mb-7">
      <ol className="flex border-b border-navy-200">
        {stages.map((stage, index) => {
          const active = stage === activeStage;
          const complete = completedStages.has(stage);
          const enabled = canOpenStage(stage);

          return (
            <li key={stage} className="flex-1">
              <button
                type="button"
                disabled={!enabled}
                aria-current={active ? "step" : undefined}
                onClick={() => onStageChange(stage)}
                className={cn(
                  "relative flex w-full flex-col items-center justify-center gap-1 px-1 pb-3 pt-2 text-[11px] font-medium text-navy-400 transition-colors sm:flex-row sm:gap-2 sm:px-3 sm:text-sm",
                  "after:absolute after:-bottom-px after:left-0 after:h-0.5 after:w-full after:scale-x-0 after:bg-teal-700 after:transition-transform",
                  enabled && "hover:text-navy-700",
                  active && "text-teal-800 after:scale-x-100",
                  !enabled && "cursor-not-allowed opacity-50"
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border border-navy-200 text-[10px] sm:h-6 sm:w-6 sm:text-xs",
                    active && "border-teal-600 bg-teal-50 text-teal-800",
                    complete && "border-teal-600 bg-teal-600 text-white"
                  )}
                >
                  {complete ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
                </span>
                {QUOTE_STAGE_LABELS[stage]}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface QuoteWizardFooterProps {
  hasPrevious: boolean;
  hasNext: boolean;
  nextDisabled?: boolean;
  nextHint?: string;
  onPrevious: () => void;
  onNext: () => void;
}

export function QuoteWizardFooter({
  hasPrevious,
  hasNext,
  nextDisabled,
  nextHint,
  onPrevious,
  onNext,
}: QuoteWizardFooterProps) {
  return (
    <div className="no-print mt-6 border-t border-navy-100 pt-5">
      <div className="flex items-center justify-between gap-3">
        {hasPrevious ? (
          <Button variant="ghost" onClick={onPrevious}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Previous
          </Button>
        ) : (
          <span />
        )}
        {hasNext ? (
          <Button
            variant="primary"
            size="lg"
            className="min-w-36 rounded-full"
            disabled={nextDisabled}
            onClick={onNext}
          >
            Continue
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <span className="inline-flex items-center gap-2 text-sm font-medium text-teal-700">
            <Check className="h-4 w-4" aria-hidden="true" />
            Ready to present
          </span>
        )}
      </div>
      {nextDisabled && nextHint ? <p className="mt-2 text-right text-xs text-amber-700">{nextHint}</p> : null}
    </div>
  );
}

"use client";

import type { Dispatch } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { IllustratedOptionCard } from "@/components/quote/IllustratedOptionCard";
import { LensIllustration } from "@/components/quote/LensIllustration";
import { USAGE_OPTIONS } from "@/lib/usageOptions";
import type { QuoteInput } from "@/lib/types";
import type { QuoteAction } from "@/components/quote/quoteReducer";

interface UsageStepProps {
  input: QuoteInput;
  dispatch: Dispatch<QuoteAction>;
}

/**
 * Optional "what these glasses are for" selection — one usage per quote. It
 * is informational only: it never changes pricing, insurance, the surfacing
 * rule, or the displayed prescription. (Reading/Computer prescription
 * calculations are a separate control in the Prescription step.)
 */
export function UsageStep({ input, dispatch }: UsageStepProps) {
  const { usage } = input;

  return (
    <Card>
      <CardHeader>
        <CardTitle>How will these glasses be used?</CardTitle>
        <CardDescription>
          Choose the patient&apos;s primary visual task. This keeps the worksheet clear and does not change pricing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div role="radiogroup" aria-label="Usage" className="grid gap-3">
          {USAGE_OPTIONS.map((option) => (
            <IllustratedOptionCard
              key={option.key}
              name="usage"
              title={option.label}
              description={option.description}
              value={option.key}
              checked={usage === option.key}
              onChange={() => dispatch({ type: "SET_USAGE", usage: option.key })}
              illustration={<LensIllustration kind={option.key} />}
            />
          ))}
        </div>
        {usage ? (
          <button
            type="button"
            className="mt-3 text-xs font-medium text-teal-700 hover:underline"
            onClick={() => dispatch({ type: "SET_USAGE", usage: null })}
          >
            Clear usage
          </button>
        ) : null}
      </CardContent>
    </Card>
  );
}

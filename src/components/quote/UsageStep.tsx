"use client";

import type { Dispatch } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioCard, RadioCardGroup } from "@/components/ui/radio-card";
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
        <CardTitle>Usage</CardTitle>
        <CardDescription>What are these glasses primarily for? Optional — choose one.</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioCardGroup legend="Usage" className="grid-cols-2 sm:grid-cols-3">
          {USAGE_OPTIONS.map((option) => (
            <RadioCard
              key={option.key}
              name="usage"
              title={option.label}
              subtitle={option.description}
              value={option.key}
              checked={usage === option.key}
              onChange={() => dispatch({ type: "SET_USAGE", usage: option.key })}
            />
          ))}
        </RadioCardGroup>
        {usage ? (
          <button
            type="button"
            className="mt-2.5 text-xs font-medium text-teal-700 hover:underline"
            onClick={() => dispatch({ type: "SET_USAGE", usage: null })}
          >
            Clear usage
          </button>
        ) : null}
      </CardContent>
    </Card>
  );
}

"use client";

import type { Dispatch } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckboxField } from "@/components/ui/checkbox";
import { formatCents } from "@/lib/money";
import type { QuoteCalculationResult, QuoteInput } from "@/lib/types";
import type { QuoteAction } from "@/components/quote/quoteReducer";

interface SurfacingStepProps {
  input: QuoteInput;
  dispatch: Dispatch<QuoteAction>;
  result: QuoteCalculationResult;
  disabled: boolean;
  disabledReason: string;
}

/**
 * Custom Lens Surfacing is a selectable option that also auto-recommends
 * itself. The high-cylinder and custom-color rules automatically enable it (and
 * show why), but the optician can always toggle it. A manual choice is sticky:
 * the reducer only returns to "auto" when the prescription, material, lens type,
 * or photochromic product/color changes. Only one surfacing fee is ever charged.
 */
export function SurfacingStep({ input, dispatch, result, disabled, disabledReason }: SurfacingStepProps) {
  const { surfacingRecommended, surfacingEnabled, surfacingFeeCents, surfacingRecommendationNote } = result;

  return (
    <Card className={disabled ? "opacity-60" : undefined}>
      <CardHeader>
        <CardTitle>Custom Lens Surfacing</CardTitle>
        <CardDescription>
          {disabled
            ? disabledReason
            : "Add custom lens surfacing. Recommended automatically for high-cylinder prescriptions or custom photochromic colors — you can always override it."}
        </CardDescription>
      </CardHeader>
      {disabled ? null : (
        <CardContent className="space-y-2">
          <CheckboxField
            label={
              surfacingFeeCents > 0
                ? `Custom Lens Surfacing — ${formatCents(surfacingFeeCents)}`
                : "Custom Lens Surfacing"
            }
            checked={surfacingEnabled}
            onChange={(e) => dispatch({ type: "SET_SURFACING_OVERRIDE", enabled: e.target.checked })}
          />
          {surfacingRecommended && surfacingEnabled ? (
            <p className="text-xs text-teal-700">
              Automatically selected — {surfacingRecommendationNote ?? "this lens configuration qualifies for surfacing."}
            </p>
          ) : null}
          {surfacingRecommended && !surfacingEnabled ? (
            <p className="text-xs text-amber-700">Recommended for this quote, but you have turned it off.</p>
          ) : null}
        </CardContent>
      )}
    </Card>
  );
}

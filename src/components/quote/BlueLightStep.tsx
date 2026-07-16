"use client";

import type { Dispatch } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioCard, RadioCardGroup } from "@/components/ui/radio-card";
import { formatCents } from "@/lib/money";
import type { BlueLightOptionConfig, QuoteInput } from "@/lib/types";
import type { QuoteAction } from "@/components/quote/quoteReducer";

interface BlueLightStepProps {
  input: QuoteInput;
  dispatch: Dispatch<QuoteAction>;
  options: BlueLightOptionConfig[];
  disabled: boolean;
  disabledReason: string;
}

/**
 * Blue Light — a fully independent configurable lens option (separate from
 * anti-reflective coating, photochromic, tint, and material). Behaves like any
 * other priced option.
 */
export function BlueLightStep({ input, dispatch, options, disabled, disabledReason }: BlueLightStepProps) {
  const active = options.filter((o) => o.active).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <Card className={disabled ? "opacity-60" : undefined}>
      <CardHeader>
        <CardTitle>Blue Light</CardTitle>
        <CardDescription>
          {disabled
            ? disabledReason
            : "Optional blue-light filtering. Independent of coating, photochromic, tint, and material."}
        </CardDescription>
      </CardHeader>
      {disabled ? null : (
        <CardContent>
          <RadioCardGroup legend="Blue Light" className="grid-cols-1 sm:grid-cols-2">
            {active.map((option) => (
              <RadioCard
                key={option.id}
                name="blueLight"
                title={option.name}
                subtitle={option.description}
                priceLabel={option.retailPriceCents > 0 ? formatCents(option.retailPriceCents) : undefined}
                value={option.id}
                checked={input.blueLightId === option.id}
                onChange={() => dispatch({ type: "SET_BLUE_LIGHT", blueLightId: option.id })}
              />
            ))}
          </RadioCardGroup>
        </CardContent>
      )}
    </Card>
  );
}

"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioCard, RadioCardGroup } from "@/components/ui/radio-card";
import { formatCents } from "@/lib/money";
import type { Dispatch } from "react";
import type { CoatingConfig, LensTypeConfig, QuoteInput } from "@/lib/types";
import type { QuoteAction } from "@/components/quote/quoteReducer";

interface CoatingStepProps {
  input: QuoteInput;
  dispatch: Dispatch<QuoteAction>;
  coatings: CoatingConfig[];
  lensType: LensTypeConfig | undefined;
  disabled: boolean;
}

export function CoatingStep({ input, dispatch, coatings, lensType, disabled }: CoatingStepProps) {
  const active = coatings.filter((c) => c.active).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <Card className={disabled ? "opacity-60" : undefined}>
      <CardHeader>
        <CardTitle>4. Anti-Reflective Coating</CardTitle>
        <CardDescription>
          {disabled ? "Not applicable for a frame-only order." : "Choose an anti-reflective coating."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioCardGroup legend="Anti-reflective coating">
          {active.map((coating) => {
            const price = lensType ? coating.priceByLensType?.[lensType.key] ?? coating.retailPriceCents : coating.retailPriceCents;
            return (
              <RadioCard
                key={coating.id}
                name="coating"
                title={coating.name}
                subtitle={coating.description}
                priceLabel={price > 0 ? `+${formatCents(price)}` : "Included"}
                checked={input.coatingId === coating.id}
                disabled={disabled}
                onChange={() => dispatch({ type: "SET_COATING", coatingId: coating.id })}
              />
            );
          })}
        </RadioCardGroup>
      </CardContent>
    </Card>
  );
}

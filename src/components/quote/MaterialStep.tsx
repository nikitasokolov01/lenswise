"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioCard, RadioCardGroup } from "@/components/ui/radio-card";
import { formatCents } from "@/lib/money";
import { findMaterialPrice } from "@/lib/calculation/materialPricing";
import type { Dispatch } from "react";
import type { LensTypeConfig, MaterialConfig, QuoteInput } from "@/lib/types";
import type { QuoteAction } from "@/components/quote/quoteReducer";

interface MaterialStepProps {
  input: QuoteInput;
  dispatch: Dispatch<QuoteAction>;
  materials: MaterialConfig[];
  lensType: LensTypeConfig | undefined;
  disabled: boolean;
  disabledReason: string;
}

export function MaterialStep({ input, dispatch, materials, lensType, disabled, disabledReason }: MaterialStepProps) {
  const active = materials.filter((m) => m.active).sort((a, b) => a.sortOrder - b.sortOrder);
  const isProgressive = lensType?.key === "progressive";
  const needsDesignFirst = isProgressive && !input.progressiveDesignId;
  const stepDisabled = disabled || needsDesignFirst || !lensType;

  return (
    <Card className={disabled ? "opacity-60" : undefined}>
      <CardHeader>
        <CardTitle>4. Lens Material</CardTitle>
        <CardDescription>
          {disabled
            ? disabledReason
            : needsDesignFirst
              ? "Choose a progressive design in step 3 first to see pricing."
              : !lensType
                ? "Choose a lens type in step 3 first to see pricing."
                : "Choose a lens material. The price shown is the full price for this lens type and material."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioCardGroup legend="Lens material">
          {active.map((material) => {
            const matchedPrice = lensType
              ? findMaterialPrice(material, lensType, input.progressiveDesignId)
              : undefined;
            const priceLabel = !lensType || needsDesignFirst ? "—" : matchedPrice ? formatCents(matchedPrice.priceCents) : "Not priced";
            return (
              <RadioCard
                key={material.id}
                name="material"
                title={material.name}
                subtitle={material.shortDescription}
                priceLabel={priceLabel}
                checked={input.materialId === material.id}
                disabled={stepDisabled || !matchedPrice}
                onChange={() => dispatch({ type: "SET_MATERIAL", materialId: material.id })}
              />
            );
          })}
        </RadioCardGroup>
      </CardContent>
    </Card>
  );
}

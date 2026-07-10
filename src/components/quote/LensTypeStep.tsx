"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioCard, RadioCardGroup } from "@/components/ui/radio-card";
import type { Dispatch } from "react";
import type { LensTypeConfig, ProgressiveDesignConfig, QuoteInput } from "@/lib/types";
import type { QuoteAction } from "@/components/quote/quoteReducer";

interface LensTypeStepProps {
  input: QuoteInput;
  dispatch: Dispatch<QuoteAction>;
  lensTypes: LensTypeConfig[];
  progressiveDesigns: ProgressiveDesignConfig[];
}

export function LensTypeStep({ input, dispatch, lensTypes, progressiveDesigns }: LensTypeStepProps) {
  const active = lensTypes.filter((lt) => lt.active).sort((a, b) => a.sortOrder - b.sortOrder);
  const activeDesigns = progressiveDesigns.filter((d) => d.active).sort((a, b) => a.sortOrder - b.sortOrder);

  const selectedLensType = active.find((lt) => lt.id === input.lensTypeId);
  const isProgressive = selectedLensType?.key === "progressive";

  function selectLensType(lensType: LensTypeConfig) {
    dispatch({ type: "SET_LENS_TYPE", lensTypeId: lensType.id, isProgressive: lensType.key === "progressive" });
    dispatch({ type: "SET_FRAME", field: "frameOnly", value: lensType.key === "frame_only" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>2. Lens Type</CardTitle>
        <CardDescription>
          Choose the lens type for this order. Lens type only determines which pricing options are available —
          the price itself comes from the lens material chosen in the next step.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioCardGroup legend="Lens type">
          {active.map((lensType) => (
            <RadioCard
              key={lensType.id}
              name="lens-type"
              title={lensType.name}
              subtitle={lensType.description}
              checked={input.lensTypeId === lensType.id}
              onChange={() => selectLensType(lensType)}
            />
          ))}
        </RadioCardGroup>

        {isProgressive ? (
          <div>
            <p className="mb-2 text-sm font-medium text-navy-700">Progressive design</p>
            {activeDesigns.length === 0 ? (
              <p className="text-sm text-navy-400">
                No progressive designs are configured. Add one in Admin Pricing.
              </p>
            ) : (
              <RadioCardGroup legend="Progressive design">
                {activeDesigns.map((design) => (
                  <RadioCard
                    key={design.id}
                    name="progressive-design"
                    title={design.name}
                    subtitle={design.description}
                    checked={input.progressiveDesignId === design.id}
                    onChange={() => dispatch({ type: "SET_PROGRESSIVE_DESIGN", progressiveDesignId: design.id })}
                  />
                ))}
              </RadioCardGroup>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MoneyField } from "@/components/ui/money-field";
import { CheckboxField } from "@/components/ui/checkbox";
import type { Dispatch } from "react";
import type { LensTypeConfig, QuoteInput } from "@/lib/types";
import type { QuoteAction } from "@/components/quote/quoteReducer";

interface FrameStepProps {
  input: QuoteInput;
  dispatch: Dispatch<QuoteAction>;
  frameOnlyLensType: LensTypeConfig | undefined;
  defaultLensTypeId: string | null;
}

export function FrameStep({ input, dispatch, frameOnlyLensType, defaultLensTypeId }: FrameStepProps) {
  const { frame } = input;

  function toggleFrameOnly(checked: boolean) {
    dispatch({ type: "SET_FRAME", field: "frameOnly", value: checked });
    if (checked && frameOnlyLensType) {
      dispatch({ type: "SET_LENS_TYPE", lensTypeId: frameOnlyLensType.id, isProgressive: false });
    } else if (!checked && input.lensTypeId === frameOnlyLensType?.id) {
      // The default lens type is never Progressive (see QuoteBuilder's
      // defaultLensType selection), so isProgressive is always false here.
      dispatch({ type: "SET_LENS_TYPE", lensTypeId: defaultLensTypeId, isProgressive: false });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Frame</CardTitle>
        <CardDescription>Enter the frame retail price and any frame-specific insurance details.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="frame-retail-price">Frame retail price</Label>
          <MoneyField
            id="frame-retail-price"
            valueCents={frame.retailPriceCents}
            onChangeCents={(cents) => dispatch({ type: "SET_FRAME", field: "retailPriceCents", value: cents })}
            aria-label="Frame retail price"
          />
        </div>

        <CheckboxField
          label="Frame purchase only (no lenses on this order)"
          description="Hides lens, material, coating, and photochromic controls for this quote."
          checked={frame.frameOnly}
          onChange={(e) => toggleFrameOnly(e.target.checked)}
        />

        <div>
          <Label htmlFor="frame-custom-description">
            Custom frame description <span className="font-normal text-navy-400">(optional, anonymous label only)</span>
          </Label>
          <Input
            id="frame-custom-description"
            placeholder='e.g. "Designer frame" or "Patient-owned frame"'
            value={frame.customDescription}
            maxLength={60}
            onChange={(e) => dispatch({ type: "SET_FRAME", field: "customDescription", value: e.target.value })}
            aria-describedby="frame-description-hint"
          />
          <p id="frame-description-hint" className="mt-1 text-xs text-navy-400">
            Do not enter patient names or any identifying information here.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="frame-allowance">Frame insurance allowance</Label>
            <MoneyField
              id="frame-allowance"
              valueCents={frame.insuranceAllowanceCents}
              onChangeCents={(cents) => dispatch({ type: "SET_FRAME", field: "insuranceAllowanceCents", value: cents })}
              aria-label="Frame insurance allowance"
            />
            <p className="mt-1 text-xs text-navy-400">Used when Insurance Allowances mode is selected in step 6.</p>
          </div>
          <div>
            <Label htmlFor="frame-copay">Frame copay</Label>
            <MoneyField
              id="frame-copay"
              valueCents={frame.copayCents}
              onChangeCents={(cents) => dispatch({ type: "SET_FRAME", field: "copayCents", value: cents })}
              aria-label="Frame copay"
            />
            <p className="mt-1 text-xs text-navy-400">Used when Insurance Copays mode is selected in step 6.</p>
          </div>
        </div>

        <div>
          <Label htmlFor="frame-manual-adjustment">Manual frame adjustment</Label>
          <MoneyField
            id="frame-manual-adjustment"
            valueCents={frame.manualAdjustmentCents}
            onChangeCents={(cents) => dispatch({ type: "SET_FRAME", field: "manualAdjustmentCents", value: cents })}
            allowNegative
            aria-label="Manual frame adjustment"
          />
          <p className="mt-1 text-xs text-navy-400">
            Enter a negative amount to reduce the frame price, or positive to increase it.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

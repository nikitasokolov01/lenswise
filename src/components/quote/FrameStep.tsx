"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MoneyField } from "@/components/ui/money-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { Dispatch } from "react";
import type { OrderType, QuoteInput } from "@/lib/types";
import type { QuoteAction } from "@/components/quote/quoteReducer";

interface FrameStepProps {
  input: QuoteInput;
  dispatch: Dispatch<QuoteAction>;
}

const ORDER_TYPE_OPTIONS: { value: OrderType; label: string }[] = [
  { value: "complete_pair", label: "Complete Pair" },
  { value: "lens_only", label: "Lens Only" },
  { value: "frame_only", label: "Frame Only" },
];

const ORDER_TYPE_HELP: Record<OrderType, string> = {
  complete_pair: "Frame and lenses. Lens configuration unlocks once a valid prescription is applied below.",
  lens_only: "New lenses only, e.g. into a patient-owned frame. No frame charge. A prescription is still required.",
  frame_only: "Frame purchase only — no lenses on this order, so no prescription is needed.",
};

/**
 * Frame retail price/description, and the order type (Complete Pair / Lens
 * Only / Frame Only). Order type is a first-class choice made here — not
 * derived from the lens type — because it determines whether the
 * Prescription section (directly below this step) is required at all.
 * Insurance fields for the frame (copay, allowance) live in the unified
 * Insurance section near the bottom of the Quote Builder — not here — so
 * every insurance-related control is grouped in one place.
 */
export function FrameStep({ input, dispatch }: FrameStepProps) {
  const { frame, orderType } = input;

  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Frame &amp; Order Type</CardTitle>
        <CardDescription>Enter the frame retail price and choose what this order includes.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium text-navy-700">Order type</p>
          <SegmentedControl
            label="Order type"
            options={ORDER_TYPE_OPTIONS}
            value={orderType}
            onChange={(value) => dispatch({ type: "SET_ORDER_TYPE", orderType: value })}
            className="w-full sm:w-auto"
          />
          <p className="mt-1.5 text-xs text-navy-500">{ORDER_TYPE_HELP[orderType]}</p>
        </div>

        <div>
          <Label htmlFor="frame-retail-price">Frame retail price</Label>
          <MoneyField
            id="frame-retail-price"
            valueCents={frame.retailPriceCents}
            onChangeCents={(cents) => dispatch({ type: "SET_FRAME", field: "retailPriceCents", value: cents })}
            disabled={orderType === "lens_only"}
            aria-label="Frame retail price"
          />
          {orderType === "lens_only" ? (
            <p className="mt-1 text-xs text-navy-400">Not applicable for a lens-only order.</p>
          ) : null}
        </div>

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

        <div>
          <Label htmlFor="frame-manual-adjustment">Manual frame adjustment</Label>
          <MoneyField
            id="frame-manual-adjustment"
            valueCents={frame.manualAdjustmentCents}
            onChangeCents={(cents) => dispatch({ type: "SET_FRAME", field: "manualAdjustmentCents", value: cents })}
            allowNegative
            disabled={orderType === "lens_only"}
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

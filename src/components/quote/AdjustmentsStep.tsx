"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyField } from "@/components/ui/money-field";
import { Trash2, Plus } from "lucide-react";
import type { Dispatch } from "react";
import type { AdjustmentType, QuoteInput } from "@/lib/types";
import type { QuoteAction } from "@/components/quote/quoteReducer";

interface AdjustmentsStepProps {
  input: QuoteInput;
  dispatch: Dispatch<QuoteAction>;
}

const ADJUSTMENT_LABELS: Record<AdjustmentType, string> = {
  fixed_discount: "Fixed-dollar discount",
  percent_discount: "Percentage discount",
  charge: "Custom charge",
  credit: "Custom credit",
};

export function AdjustmentsStep({ input, dispatch }: AdjustmentsStepProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>7. Adjustments</CardTitle>
          <CardDescription>Add optional discounts, charges, or credits.</CardDescription>
        </div>
        {input.adjustments.length > 0 ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (window.confirm("Remove all adjustments from this quote?")) {
                dispatch({ type: "RESET_ADJUSTMENTS" });
              }
            }}
          >
            Reset adjustments
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ADJUSTMENT_LABELS) as AdjustmentType[]).map((type) => (
            <Button
              key={type}
              variant="secondary"
              size="sm"
              onClick={() => dispatch({ type: "ADD_ADJUSTMENT", adjustmentType: type })}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {ADJUSTMENT_LABELS[type]}
            </Button>
          ))}
        </div>

        {input.adjustments.length === 0 ? (
          <p className="text-sm text-navy-400">No adjustments added.</p>
        ) : (
          <ul className="space-y-3">
            {input.adjustments.map((adj) => (
              <li key={adj.id} className="rounded-md border border-navy-100 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-navy-700">{ADJUSTMENT_LABELS[adj.type]}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${ADJUSTMENT_LABELS[adj.type]}`}
                    className="flex h-9 w-9 items-center justify-center rounded-md text-navy-400 hover:bg-navy-50 hover:text-red-600"
                    onClick={() => dispatch({ type: "REMOVE_ADJUSTMENT", id: adj.id })}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`adj-label-${adj.id}`}>
                      Short anonymous label <span className="font-normal text-navy-400">(optional)</span>
                    </Label>
                    <Input
                      id={`adj-label-${adj.id}`}
                      placeholder='e.g. "Loyalty discount"'
                      maxLength={40}
                      value={adj.label}
                      onChange={(e) =>
                        dispatch({ type: "UPDATE_ADJUSTMENT", id: adj.id, patch: { label: e.target.value } })
                      }
                    />
                  </div>
                  {adj.type === "percent_discount" ? (
                    <div>
                      <Label htmlFor={`adj-percent-${adj.id}`}>Percent off</Label>
                      <div className="relative">
                        <Input
                          id={`adj-percent-${adj.id}`}
                          type="text"
                          inputMode="decimal"
                          className="pr-8"
                          value={adj.percent === 0 ? "" : String(adj.percent)}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9.]/g, "");
                            const value = Math.min(Math.max(Number.parseFloat(raw || "0"), 0), 100);
                            dispatch({ type: "UPDATE_ADJUSTMENT", id: adj.id, patch: { percent: value } });
                          }}
                          placeholder="0"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-navy-400">
                          %
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor={`adj-amount-${adj.id}`}>Amount</Label>
                      <MoneyField
                        id={`adj-amount-${adj.id}`}
                        valueCents={adj.amountCents}
                        onChangeCents={(cents) =>
                          dispatch({ type: "UPDATE_ADJUSTMENT", id: adj.id, patch: { amountCents: cents } })
                        }
                      />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

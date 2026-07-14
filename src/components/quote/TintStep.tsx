"use client";

import type { Dispatch } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import { TINT_PERCENTS } from "@/lib/pricing/seedConfiguration";
import type { QuoteInput, TintConfig, TintType } from "@/lib/types";
import type { QuoteAction } from "@/components/quote/quoteReducer";

interface TintStepProps {
  input: QuoteInput;
  dispatch: Dispatch<QuoteAction>;
  tints: TintConfig;
  disabled: boolean;
  disabledReason: string;
}

/**
 * Tint selection — independent of lens material, coating, and photochromic.
 * Choose a type (None / Solid / Gradient), then a color and percentage. Only
 * globally-enabled types and colors that support the chosen type are offered.
 */
export function TintStep({ input, dispatch, tints, disabled, disabledReason }: TintStepProps) {
  const { tint } = input;

  const typeOptions: SegmentedOption<TintType>[] = [{ value: "none", label: "None" }];
  if (tints.solidTintEnabled) typeOptions.push({ value: "solid", label: "Solid Tint" });
  if (tints.gradientTintEnabled) typeOptions.push({ value: "gradient", label: "Gradient Tint" });

  const isActiveType = tint.type === "solid" || tint.type === "gradient";
  const availableColors = tints.colors
    .filter((c) => c.active && (tint.type === "solid" ? c.supportsSolid : tint.type === "gradient" ? c.supportsGradient : false))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <Card className={disabled ? "opacity-60" : undefined}>
      <CardHeader>
        <CardTitle>Tint</CardTitle>
        <CardDescription>
          {disabled ? disabledReason : "Solid or gradient lens tint. Independent of material, coating, and photochromic."}
        </CardDescription>
      </CardHeader>
      {disabled ? null : (
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-navy-700">Tint type</p>
            <SegmentedControl
              label="Tint type"
              options={typeOptions}
              value={tint.type}
              onChange={(value) => dispatch({ type: "SET_TINT_TYPE", tintType: value })}
              className="w-full sm:w-auto"
            />
          </div>

          {isActiveType ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="tint-color">Tint color</Label>
                <Select
                  id="tint-color"
                  value={tint.colorId ?? ""}
                  onChange={(e) => dispatch({ type: "SET_TINT_COLOR", colorId: e.target.value || null })}
                  aria-label="Tint color"
                >
                  <option value="">Select a color</option>
                  {availableColors.map((color) => (
                    <option key={color.id} value={color.id}>
                      {color.name}
                    </option>
                  ))}
                </Select>
                {availableColors.length === 0 ? (
                  <p className="mt-1 text-xs text-amber-700">No colors support this tint type.</p>
                ) : null}
              </div>

              <div>
                <Label htmlFor="tint-percent">
                  Tint percentage {tint.type === "gradient" ? "(darkest / top)" : null}
                </Label>
                <Select
                  id="tint-percent"
                  value={tint.percent == null ? "" : String(tint.percent)}
                  onChange={(e) =>
                    dispatch({ type: "SET_TINT_PERCENT", percent: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  aria-label="Tint percentage"
                >
                  <option value="">Select %</option>
                  {TINT_PERCENTS.map((percent) => (
                    <option key={percent} value={percent}>
                      {percent}%
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          ) : null}
        </CardContent>
      )}
    </Card>
  );
}

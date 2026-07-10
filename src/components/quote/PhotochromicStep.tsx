"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioCard, RadioCardGroup } from "@/components/ui/radio-card";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/money";
import type { Dispatch } from "react";
import type {
  LensTypeConfig,
  PhotochromicColorConfig,
  PhotochromicProductConfig,
  QuoteInput,
} from "@/lib/types";
import type { QuoteAction } from "@/components/quote/quoteReducer";

interface PhotochromicStepProps {
  input: QuoteInput;
  dispatch: Dispatch<QuoteAction>;
  products: PhotochromicProductConfig[];
  colors: PhotochromicColorConfig[];
  lensType: LensTypeConfig | undefined;
  transitionsSurfacingFeeCents: number;
  disabled: boolean;
}

export function PhotochromicStep({
  input,
  dispatch,
  products,
  colors,
  lensType,
  transitionsSurfacingFeeCents,
  disabled,
}: PhotochromicStepProps) {
  const active = products.filter((p) => p.active).sort((a, b) => a.sortOrder - b.sortOrder);
  const activeColors = colors.filter((c) => c.active).sort((a, b) => a.sortOrder - b.sortOrder);

  const selectedProduct = active.find((p) => p.id === input.photochromic.productId);
  const selectedColor = activeColors.find((c) => c.id === input.photochromic.colorId);

  const willTriggerSurfacingFee =
    !disabled &&
    lensType?.key === "single_vision" &&
    selectedProduct?.key === "transitions_gen_s" &&
    Boolean(selectedColor) &&
    selectedColor?.isStandardColor === false;

  return (
    <Card className={disabled ? "opacity-60" : undefined}>
      <CardHeader>
        <CardTitle>5. Photochromic</CardTitle>
        <CardDescription>
          {disabled ? "Not applicable for a frame-only order." : "Choose a light-adaptive lens option."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioCardGroup legend="Photochromic product">
          {active.map((product) => (
            <RadioCard
              key={product.id}
              name="photochromic-product"
              title={product.name}
              subtitle={product.description}
              priceLabel={product.retailPriceCents > 0 ? `+${formatCents(product.retailPriceCents)}` : "None"}
              checked={input.photochromic.productId === product.id}
              disabled={disabled}
              onChange={() =>
                dispatch({
                  type: "SET_PHOTOCHROMIC_PRODUCT",
                  productId: product.id,
                  requiresColor: product.requiresColorSelection,
                })
              }
            />
          ))}
        </RadioCardGroup>

        {selectedProduct?.requiresColorSelection ? (
          <div>
            <p className="mb-2 text-sm font-medium text-navy-700">Color</p>
            <RadioCardGroup legend="Transitions color" className="grid-cols-2 sm:grid-cols-4">
              {activeColors.map((color) => (
                <RadioCard
                  key={color.id}
                  name="photochromic-color"
                  title={color.name}
                  checked={input.photochromic.colorId === color.id}
                  disabled={disabled}
                  onChange={() => dispatch({ type: "SET_PHOTOCHROMIC_COLOR", colorId: color.id })}
                />
              ))}
            </RadioCardGroup>
          </div>
        ) : null}

        {willTriggerSurfacingFee ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
            <Badge variant="warning">Automatic fee</Badge>
            <p className="text-sm text-navy-700">
              This combination adds a <strong>Transitions custom-color surfacing fee</strong> of{" "}
              {formatCents(transitionsSurfacingFeeCents)}, shown as its own line in the quote summary.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

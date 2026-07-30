"use client";

import Image from "next/image";
import { useMemo, useState, type Dispatch } from "react";
import { Check, Glasses, PackageSearch, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MoneyField } from "@/components/ui/money-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { catalogColorSwatch } from "@/lib/catalog/options";
import { useFramePhotosEnabled } from "@/lib/catalog/framePhotoVisibilityContext";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  formatQuoteFrameName,
  formatQuoteFrameSize,
  groupQuoteFrameInventoryByModel,
  type QuoteFrameInventoryModelGroup,
  type QuoteFrameInventoryOption,
} from "@/lib/inventory/types";
import type { FrameEntryMode, OrderType, QuoteInput } from "@/lib/types";
import type { QuoteAction } from "@/components/quote/quoteReducer";

interface FrameStepProps {
  input: QuoteInput;
  dispatch: Dispatch<QuoteAction>;
  frameInventory: QuoteFrameInventoryOption[];
  inventoryLoadError?: string | null;
}

const ORDER_TYPE_OPTIONS: { value: OrderType; label: string }[] = [
  { value: "complete_pair", label: "Complete Pair" },
  { value: "lens_only", label: "Lens Only" },
  { value: "frame_only", label: "Frame Only" },
];

const FRAME_ENTRY_OPTIONS: { value: FrameEntryMode; label: string }[] = [
  { value: "inventory", label: "Choose from inventory" },
  { value: "manual", label: "Enter manually" },
];

const ORDER_TYPE_HELP: Record<OrderType, string> = {
  complete_pair: "Frame and lenses. Lens configuration unlocks once a valid prescription is applied.",
  lens_only: "New lenses only, e.g. into a patient-owned frame. No frame charge. A prescription is still required.",
  frame_only: "Frame purchase only — no lenses on this order, so no prescription is needed.",
};

export function FrameStep({
  input,
  dispatch,
  frameInventory,
  inventoryLoadError = null,
}: FrameStepProps) {
  const framePhotosEnabled = useFramePhotosEnabled();
  const { frame, orderType } = input;
  const [inventorySearch, setInventorySearch] = useState("");
  const [activeVariantIds, setActiveVariantIds] = useState<Record<string, string>>({});
  const normalizedSearch = inventorySearch.trim().toLowerCase();
  const filteredFrames = useMemo(
    () =>
      frameInventory.filter((item) => {
        if (!normalizedSearch) return true;
        return [item.brand, item.model, item.color, item.sku, item.upc]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedSearch));
      }),
    [frameInventory, normalizedSearch]
  );
  const filteredFrameGroups = useMemo(
    () => groupQuoteFrameInventoryByModel(filteredFrames),
    [filteredFrames]
  );
  const selectedInventoryFrame = frame.inventoryItemId
    ? frameInventory.find((item) => item.id === frame.inventoryItemId)
    : undefined;

  function changeActiveInventoryVariant(
    group: QuoteFrameInventoryModelGroup,
    nextFrame: QuoteFrameInventoryOption
  ) {
    setActiveVariantIds((current) => ({ ...current, [group.key]: nextFrame.id }));
    if (group.variants.some((variant) => variant.id === frame.inventoryItemId)) {
      dispatch({ type: "SELECT_INVENTORY_FRAME", frame: nextFrame });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order details</CardTitle>
        <CardDescription>Choose what the order includes, then select the frame source.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
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

        {orderType === "lens_only" ? (
          <div className="rounded-lg border border-navy-100 bg-navy-50 p-4">
            <p className="font-medium text-navy-900">No frame will be added to this quote</p>
            <p className="mt-1 text-sm text-navy-500">
              The worksheet will identify this as a patient-owned frame, and the frame charge will remain $0.
            </p>
          </div>
        ) : (
          <>
            <div>
              <p className="mb-2 text-sm font-medium text-navy-700">
                How do you want to add the frame?
              </p>
              <SegmentedControl
                label="Frame source"
                options={FRAME_ENTRY_OPTIONS}
                value={frame.entryMode}
                onChange={(mode) => dispatch({ type: "SET_FRAME_ENTRY_MODE", mode })}
                className="w-full"
              />
            </div>

            {frame.entryMode === "inventory" ? (
              <div className="space-y-3">
                {inventoryLoadError ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    {inventoryLoadError}
                  </div>
                ) : null}

                {frameInventory.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-navy-200 bg-navy-50 p-5 text-center">
                    <PackageSearch className="mx-auto h-7 w-7 text-navy-400" aria-hidden="true" />
                    <p className="mt-2 font-medium text-navy-900">No active frames are in inventory yet</p>
                    <p className="mt-1 text-sm text-navy-500">
                      Add frames in Inventory, or use manual entry for this quote.
                    </p>
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      <a
                        href="/inventory"
                        className="inline-flex min-h-10 items-center rounded-md border border-navy-200 bg-white px-3 text-sm font-medium text-navy-800 hover:bg-navy-50"
                      >
                        Open inventory
                      </a>
                      <button
                        type="button"
                        onClick={() => dispatch({ type: "SET_FRAME_ENTRY_MODE", mode: "manual" })}
                        className="inline-flex min-h-10 items-center rounded-md bg-navy-900 px-3 text-sm font-medium text-white hover:bg-navy-800"
                      >
                        Enter frame manually
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="frame-inventory-search">Search inventory</Label>
                      <div className="relative">
                        <Search
                          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400"
                          aria-hidden="true"
                        />
                        <Input
                          id="frame-inventory-search"
                          type="search"
                          value={inventorySearch}
                          onChange={(event) => setInventorySearch(event.target.value)}
                          placeholder="Search brand, model, color, SKU, or UPC"
                          className="pl-9"
                        />
                      </div>
                    </div>

                    <div
                      className="max-h-[40rem] space-y-3 overflow-y-auto rounded-lg border border-navy-100 bg-navy-50 p-2"
                      aria-label="Frame inventory choices"
                    >
                      {filteredFrameGroups.length === 0 ? (
                        <p className="p-4 text-center text-sm text-navy-500">
                          No inventory frames match “{inventorySearch.trim()}”.
                        </p>
                      ) : (
                        filteredFrameGroups.map((group) => {
                          const selectedGroupFrame = group.variants.find(
                            (variant) => variant.id === frame.inventoryItemId
                          );
                          const preferredVariantId = activeVariantIds[group.key];
                          const activeFrame =
                            selectedGroupFrame ??
                            group.variants.find(
                              (variant) => variant.id === preferredVariantId
                            ) ??
                            group.variants.find((variant) => variant.quantityOnHand > 0) ??
                            group.variants[0];

                          return (
                            <QuoteInventoryModelCard
                              key={group.key}
                              group={group}
                              frame={activeFrame}
                              selected={activeFrame.id === frame.inventoryItemId}
                              onSelect={() =>
                                dispatch({ type: "SELECT_INVENTORY_FRAME", frame: activeFrame })
                              }
                              onVariantChange={(nextFrame) =>
                                changeActiveInventoryVariant(group, nextFrame)
                              }
                            />
                          );
                        })
                      )}
                    </div>

                    {selectedInventoryFrame ? (
                      <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
                          Selected inventory frame
                        </p>
                        <div className="mt-2 flex items-center gap-3">
                          {framePhotosEnabled ? (
                            <span className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white p-1 ring-1 ring-teal-100">
                              {selectedInventoryFrame.imageUrl ? (
                                <Image
                                  src={selectedInventoryFrame.imageUrl}
                                  unoptimized
                                  width={120}
                                  height={72}
                                  sizes="80px"
                                  className="h-full w-full object-contain"
                                  alt=""
                                />
                              ) : (
                                <Glasses className="h-8 w-8 text-navy-300" aria-hidden="true" />
                              )}
                            </span>
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <p className="font-semibold text-navy-900">
                                {formatQuoteFrameName(selectedInventoryFrame)}
                              </p>
                              <p className="font-semibold text-navy-900">
                                {formatCents(frame.retailPriceCents)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-navy-500">
                          Inventory retail pricing is locked. Use the adjustment below if this quote needs an override.
                        </p>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4 rounded-lg border border-navy-100 bg-navy-50 p-4">
                <div>
                  <Label htmlFor="frame-custom-description">
                    Frame name <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="frame-custom-description"
                    placeholder='e.g. "Modern Optical M200"'
                    value={frame.customDescription}
                    maxLength={100}
                    onChange={(event) =>
                      dispatch({
                        type: "SET_FRAME",
                        field: "customDescription",
                        value: event.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="frame-color">
                    Frame color <span className="font-normal text-navy-400">(optional)</span>
                  </Label>
                  <Input
                    id="frame-color"
                    placeholder='e.g. "Tortoise"'
                    value={frame.colorDescription}
                    maxLength={80}
                    onChange={(event) =>
                      dispatch({
                        type: "SET_FRAME",
                        field: "colorDescription",
                        value: event.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="frame-retail-price">Frame retail price</Label>
                  <MoneyField
                    id="frame-retail-price"
                    valueCents={frame.retailPriceCents}
                    onChangeCents={(cents) =>
                      dispatch({ type: "SET_FRAME", field: "retailPriceCents", value: cents })
                    }
                    aria-label="Frame retail price"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="frame-sku">
                      SKU <span className="font-normal text-navy-400">(optional)</span>
                    </Label>
                    <Input
                      id="frame-sku"
                      value={frame.sku}
                      maxLength={60}
                      onChange={(event) =>
                        dispatch({ type: "SET_FRAME", field: "sku", value: event.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="frame-upc">
                      UPC <span className="font-normal text-navy-400">(optional)</span>
                    </Label>
                    <Input
                      id="frame-upc"
                      value={frame.upc}
                      maxLength={30}
                      inputMode="numeric"
                      onChange={(event) =>
                        dispatch({
                          type: "SET_FRAME",
                          field: "upc",
                          value: event.target.value.replace(/\D/g, "").slice(0, 30),
                        })
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="frame-size">
                    Frame size <span className="font-normal text-navy-400">(optional)</span>
                  </Label>
                  <Input
                    id="frame-size"
                    placeholder="e.g. 52-18-140"
                    value={frame.sizeDescription}
                    maxLength={30}
                    onChange={(event) =>
                      dispatch({
                        type: "SET_FRAME",
                        field: "sizeDescription",
                        value: event.target.value,
                      })
                    }
                  />
                </div>

                <p className="text-xs text-navy-400">
                  Use frame details only. Do not enter patient names or identifying information.
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="frame-manual-adjustment">Manual frame adjustment</Label>
              <MoneyField
                id="frame-manual-adjustment"
                valueCents={frame.manualAdjustmentCents}
                onChangeCents={(cents) =>
                  dispatch({ type: "SET_FRAME", field: "manualAdjustmentCents", value: cents })
                }
                allowNegative
                aria-label="Manual frame adjustment"
              />
              <p className="mt-1 text-xs text-navy-400">
                Enter a negative amount to reduce the frame price, or positive to increase it.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface QuoteInventoryModelCardProps {
  group: QuoteFrameInventoryModelGroup;
  frame: QuoteFrameInventoryOption;
  selected: boolean;
  onSelect: () => void;
  onVariantChange: (frame: QuoteFrameInventoryOption) => void;
}

function QuoteInventoryModelCard({
  group,
  frame,
  selected,
  onSelect,
  onVariantChange,
}: QuoteInventoryModelCardProps) {
  const framePhotosEnabled = useFramePhotosEnabled();
  const colorKey = (variant: QuoteFrameInventoryOption) =>
    variant.color.trim().toLowerCase();
  const sizeKey = (variant: QuoteFrameInventoryOption) =>
    `${variant.eyeSizeMm ?? ""}-${variant.bridgeSizeMm ?? ""}-${variant.templeLengthMm ?? ""}`;
  const activeColorKey = colorKey(frame);
  const activeSizeKey = sizeKey(frame);
  const outOfStock = frame.quantityOnHand <= 0;
  const size = formatQuoteFrameSize(frame);
  const colorChoices = Array.from(
    group.variants.reduce<Map<string, QuoteFrameInventoryOption>>((choices, variant) => {
      const key = colorKey(variant);
      if (!choices.has(key)) choices.set(key, variant);
      return choices;
    }, new Map())
  );
  const sizeChoices = Array.from(
    group.variants.reduce<Map<string, QuoteFrameInventoryOption>>((choices, variant) => {
      const key = sizeKey(variant);
      if (!choices.has(key)) choices.set(key, variant);
      return choices;
    }, new Map())
  ).sort(([, left], [, right]) =>
    formatQuoteFrameSize(left).localeCompare(formatQuoteFrameSize(right))
  );

  function chooseColor(nextColorKey: string) {
    const colorVariants = group.variants.filter(
      (variant) => colorKey(variant) === nextColorKey
    );
    const matchingSizeVariants = colorVariants.filter(
      (variant) => sizeKey(variant) === activeSizeKey
    );
    const nextFrame =
      matchingSizeVariants.find((variant) => variant.quantityOnHand > 0) ??
      colorVariants.find((variant) => variant.quantityOnHand > 0) ??
      matchingSizeVariants[0] ??
      colorVariants[0];
    if (nextFrame) onVariantChange(nextFrame);
  }

  function chooseSize(nextSizeKey: string) {
    const nextFrame = group.variants.find(
      (variant) =>
        colorKey(variant) === activeColorKey &&
        sizeKey(variant) === nextSizeKey &&
        variant.quantityOnHand > 0
    );
    if (nextFrame) onVariantChange(nextFrame);
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-white transition",
        selected
          ? "border-teal-600 ring-1 ring-teal-600"
          : "border-navy-100 hover:border-navy-300"
      )}
    >
      <button
        type="button"
        disabled={outOfStock}
        aria-pressed={selected}
        onClick={onSelect}
        className={cn(
          "grid w-full items-center gap-3 p-3 text-left",
          framePhotosEnabled
            ? "grid-cols-[72px_minmax(0,1fr)_auto]"
            : "grid-cols-[minmax(0,1fr)_auto]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600",
          outOfStock && "cursor-not-allowed opacity-55"
        )}
      >
        {framePhotosEnabled ? (
          <span className="flex h-14 w-[72px] items-center justify-center overflow-hidden rounded-md bg-white p-1 ring-1 ring-navy-100">
            {frame.imageUrl ? (
              <Image
                src={frame.imageUrl}
                unoptimized
                width={112}
                height={64}
                sizes="72px"
                className="h-full w-full object-contain"
                alt=""
              />
            ) : (
              <Glasses
                className="h-8 w-8 text-navy-300"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            )}
          </span>
        ) : null}
        <span className="min-w-0">
          <span className="block truncate font-semibold text-navy-900">
            {group.brand} {group.model}
          </span>
          <span className="mt-1 block text-xs text-navy-500">
            {[frame.sku ? `SKU ${frame.sku}` : null, size ? `Size ${size}` : null]
              .filter(Boolean)
              .join(" · ") || "No SKU or size recorded"}
          </span>
          <span
            className={cn(
              "mt-1 block text-xs font-medium",
              outOfStock ? "text-red-700" : "text-teal-700"
            )}
          >
            {outOfStock ? "Out of stock" : `${frame.quantityOnHand} in stock`}
          </span>
        </span>
        <span className="flex items-start gap-2 whitespace-nowrap">
          <span className="font-semibold text-navy-900">
            {formatCents(frame.retailPriceCents)}
          </span>
          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
            {selected ? <Check className="h-5 w-5 text-teal-700" aria-hidden="true" /> : null}
          </span>
        </span>
      </button>

      <div className="space-y-2.5 border-t border-navy-100 bg-navy-50/40 px-3 py-2.5">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-navy-500">Color</p>
            <p className="truncate text-xs font-semibold text-navy-800">
              {frame.color || "Color not listed"}
            </p>
          </div>
          <div
            className="flex max-w-[65%] flex-wrap justify-end gap-2"
            role="group"
            aria-label={`Color for ${group.brand} ${group.model}`}
          >
            {colorChoices.map(([choiceKey, variant]) => {
              const active = choiceKey === activeColorKey;
              const available = group.variants.some(
                (candidate) =>
                  colorKey(candidate) === choiceKey && candidate.quantityOnHand > 0
              );
              const label = variant.color || "Color not listed";
              return (
                <button
                  key={choiceKey}
                  type="button"
                  onClick={() => chooseColor(choiceKey)}
                  disabled={!available}
                  aria-label={`${label}${available ? "" : ", out of stock"}`}
                  aria-pressed={active}
                  title={`${label}${available ? "" : " — out of stock"}`}
                  className={cn(
                    "relative h-7 w-7 rounded-full border-2 border-white shadow-sm ring-1 transition",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2",
                    active
                      ? "scale-110 ring-2 ring-navy-800"
                      : "ring-navy-200 hover:scale-105 hover:ring-navy-400",
                    !available && "cursor-not-allowed grayscale opacity-30"
                  )}
                  style={{ background: catalogColorSwatch(label) }}
                >
                  {active ? (
                    <span className="absolute inset-1 rounded-full border-2 border-white/90 shadow-sm" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium text-navy-500">Size</p>
            <p className="text-[10px] text-navy-400">Eye–bridge–temple</p>
          </div>
          <div
            className="flex max-w-[72%] flex-wrap justify-end gap-1.5"
            role="group"
            aria-label={`Size for ${group.brand} ${group.model} in ${
              frame.color || "this color"
            }`}
          >
            {sizeChoices.map(([choiceKey, variant]) => {
              const matchingVariant = group.variants.find(
                (candidate) =>
                  colorKey(candidate) === activeColorKey &&
                  sizeKey(candidate) === choiceKey &&
                  candidate.quantityOnHand > 0
              );
              const active = choiceKey === activeSizeKey;
              const unavailable = !matchingVariant;
              const sizeLabel = formatQuoteFrameSize(variant) || "Size not listed";
              return (
                <button
                  key={choiceKey}
                  type="button"
                  onClick={() => chooseSize(choiceKey)}
                  disabled={unavailable}
                  aria-pressed={active}
                  aria-label={`${sizeLabel}${
                    unavailable ? `, unavailable in ${frame.color || "this color"}` : ""
                  }`}
                  title={
                    unavailable
                      ? `Not available in ${frame.color || "this color"}`
                      : sizeLabel
                  }
                  className={cn(
                    "min-h-8 rounded-md border px-2 text-xs font-semibold tabular-nums transition",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1",
                    active
                      ? "border-navy-800 bg-navy-800 text-white"
                      : "border-navy-200 bg-white text-navy-700 hover:border-navy-400",
                    unavailable &&
                      "cursor-not-allowed border-navy-100 bg-navy-100 text-navy-300 line-through opacity-70"
                  )}
                >
                  {sizeLabel}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

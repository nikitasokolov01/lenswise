"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Check, ChevronLeft, ChevronRight, Glasses, Library, PackagePlus, Search, X } from "lucide-react";
import {
  addCatalogFramesToInventoryAction,
  type FrameInventoryActionState,
} from "@/app/(app)/inventory/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  catalogColorSwatch,
  filterCatalogOptions,
  formatCatalogFrameSize,
  groupCatalogOptionsByModel,
  type FrameCatalogModelGroup,
  type FrameCatalogOption,
} from "@/lib/catalog/options";
import { useFramePhotosEnabled } from "@/lib/catalog/framePhotoVisibilityContext";
import { toggleCatalogVariantSelection } from "@/lib/catalog/selection";
import { cn } from "@/lib/utils";

const EMPTY_STATE: FrameInventoryActionState = {};
const RESULTS_PER_PAGE = 18;

type CatalogPaginationItem = number | "gap";

function getCatalogPaginationItems(currentPage: number, pageCount: number): CatalogPaginationItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const visiblePages = new Set(
    [1, pageCount, currentPage - 1, currentPage, currentPage + 1].filter(
      (page) => page >= 1 && page <= pageCount
    )
  );
  const sortedPages = Array.from(visiblePages).sort((a, b) => a - b);

  return sortedPages.flatMap((page, index) => {
    const previousPage = sortedPages[index - 1];
    return previousPage != null && page - previousPage > 1 ? ["gap", page] : [page];
  });
}

interface FrameCatalogPickerProps {
  frames: FrameCatalogOption[];
  status: "active" | "not_connected" | "error";
  loadError: string | null;
}

export function FrameCatalogPicker({
  frames,
  status,
  loadError,
}: FrameCatalogPickerProps) {
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("all");
  const [material, setMaterial] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeVariantIds, setActiveVariantIds] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [state, formAction] = useFormState(
    addCatalogFramesToInventoryAction,
    EMPTY_STATE
  );

  const brands = useMemo(
    () => Array.from(new Set(frames.map((frame) => frame.brand))).sort(),
    [frames]
  );
  const materials = useMemo(
    () =>
      Array.from(
        new Set(frames.map((frame) => frame.material).filter((value): value is string => Boolean(value)))
      ).sort(),
    [frames]
  );
  const matchingFrames = useMemo(
    () => filterCatalogOptions(frames, query, material, brand),
    [brand, frames, material, query]
  );
  const matchingModelGroups = useMemo(
    () => groupCatalogOptionsByModel(matchingFrames),
    [matchingFrames]
  );
  const pageCount = Math.max(1, Math.ceil(matchingModelGroups.length / RESULTS_PER_PAGE));
  const activePage = Math.min(currentPage, pageCount);
  const currentPageModelGroups = useMemo(
    () =>
      matchingModelGroups.slice(
        (activePage - 1) * RESULTS_PER_PAGE,
        activePage * RESULTS_PER_PAGE
      ),
    [activePage, matchingModelGroups]
  );
  const paginationItems = useMemo(
    () => getCatalogPaginationItems(activePage, pageCount),
    [activePage, pageCount]
  );
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  useEffect(() => {
    if (state.ok) setSelectedIds([]);
  }, [state.ok, state.message]);

  function updateQuery(value: string) {
    setQuery(value);
    setCurrentPage(1);
  }

  function updateMaterial(value: string) {
    setMaterial(value);
    setCurrentPage(1);
  }

  function updateBrand(value: string) {
    setBrand(value);
    setCurrentPage(1);
  }

  function toggleFrame(frame: FrameCatalogOption) {
    setSelectedIds((current) => toggleCatalogVariantSelection(current, frame.id));
  }

  function changeActiveVariant(group: FrameCatalogModelGroup, frameId: string) {
    if (!group.variants.some((variant) => variant.id === frameId)) return;

    setActiveVariantIds((current) => ({ ...current, [group.key]: frameId }));
  }

  if (status === "not_connected") {
    return (
      <CatalogNotice
        title="Frames Data access is not active for this office"
        description="The catalog is imported, but this organization still needs its licensed connection activated before staff can browse it."
      />
    );
  }

  if (status === "error" || loadError) {
    return (
      <CatalogNotice
        title="The frame catalog could not be loaded"
        description={loadError ?? "Please try again in a moment."}
        tone="error"
      />
    );
  }

  if (frames.length === 0) {
    return (
      <CatalogNotice
        title="No active catalog frames are available"
        description="Run a licensed Frames Data import, then return here to choose a frame."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-white p-2 text-teal-700 shadow-sm">
            <Library className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-navy-900">Licensed Frames Data catalog</p>
            <p className="mt-0.5 text-sm text-navy-600">
              Choose one or more exact colors and sizes. Switching variants keeps your earlier
              selections checked so you can add them together.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_190px]">
        <div>
          <Label htmlFor="catalog-search">Search catalog</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-navy-400" />
            <Input
              id="catalog-search"
              className="pl-9"
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
              placeholder="Brand, model, color, shape, or size"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="catalog-brand">Brand</Label>
          <Select
            id="catalog-brand"
            value={brand}
            onChange={(event) => updateBrand(event.target.value)}
          >
            <option value="all">All brands</option>
            {brands.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="catalog-material">Material</Label>
          <Select
            id="catalog-material"
            value={material}
            onChange={(event) => updateMaterial(event.target.value)}
          >
            <option value="all">All materials</option>
            {materials.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-navy-500">
          {matchingModelGroups.length} {matchingModelGroups.length === 1 ? "model" : "models"}
          {" · "}
          {matchingFrames.length} color {matchingFrames.length === 1 ? "variant" : "variants"}
        </p>
        <p className="text-navy-400">Selections stay checked while you change filters.</p>
      </div>

      {matchingFrames.length > 0 ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Frames Data catalog results">
            {currentPageModelGroups.map((group) => {
              const preferredVariantId = activeVariantIds[group.key];
              const activeFrame =
                group.variants.find((variant) => variant.id === preferredVariantId) ??
                group.variants.find((variant) => !variant.alreadyInInventory) ??
                group.variants[0];
              const selectedVariantCount = group.variants.filter((variant) =>
                selectedIdSet.has(variant.id)
              ).length;

              return (
                <CatalogFrameCard
                  key={group.key}
                  group={group}
                  frame={activeFrame}
                  selected={selectedIdSet.has(activeFrame.id)}
                  selectedVariantCount={selectedVariantCount}
                  selectedVariantIds={selectedIdSet}
                  onSelect={() => toggleFrame(activeFrame)}
                  onVariantChange={(frameId) => changeActiveVariant(group, frameId)}
                />
              );
            })}
          </div>
          {pageCount > 1 ? (
            <nav
              className="flex flex-wrap items-center justify-center gap-1.5"
              aria-label="Frame catalog pages"
            >
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={activePage === 1}
              onClick={() => setCurrentPage(activePage - 1)}
              aria-label="Previous catalog page"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            {paginationItems.map((item, index) =>
              item === "gap" ? (
                <span
                  key={`gap-${index}`}
                  className="flex h-9 w-7 items-center justify-center text-navy-400"
                  aria-hidden="true"
                >
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  type="button"
                  size="sm"
                  variant={item === activePage ? "accent" : "secondary"}
                  className="min-w-9 px-2"
                  onClick={() => setCurrentPage(item)}
                  aria-label={`Catalog page ${item}`}
                  aria-current={item === activePage ? "page" : undefined}
                >
                  {item}
                </Button>
              )
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={activePage === pageCount}
              onClick={() => setCurrentPage(activePage + 1)}
              aria-label="Next catalog page"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="ml-2 text-xs text-navy-500">
              Page {activePage} of {pageCount}
            </span>
          </nav>
          ) : null}
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-navy-200 bg-navy-50/40 px-6 py-10 text-center">
          <Search className="mx-auto h-8 w-8 text-navy-300" />
          <p className="mt-3 font-semibold text-navy-900">No catalog frames match</p>
          <p className="mt-1 text-sm text-navy-500">Try a different model, color, size, or material.</p>
        </div>
      )}

      <form
        action={formAction}
        className="sticky bottom-4 z-10 rounded-xl border border-teal-200 bg-white/95 p-4 shadow-lg backdrop-blur"
      >
        {selectedIds.map((id) => (
          <input key={id} type="hidden" name="catalogRecordIds" value={id} />
        ))}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-navy-900">
              {selectedIds.length} {selectedIds.length === 1 ? "frame" : "frames"} selected
            </p>
            <p className="text-xs text-navy-500">
              New frames start at quantity 1 and a low-stock alert of 1, ready to edit below.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds([])}
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
            ) : null}
            <CatalogBatchSubmitButton selectedCount={selectedIds.length} />
          </div>
        </div>

        {state.error ? (
          <p className="mt-3 text-sm font-medium text-red-600" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.ok && state.message ? (
          <p className="mt-3 text-sm font-medium text-teal-700" role="status">
            {state.message}
          </p>
        ) : null}
      </form>
    </div>
  );
}

function CatalogFrameCard({
  group,
  frame,
  selected,
  selectedVariantCount,
  selectedVariantIds,
  onSelect,
  onVariantChange,
}: {
  group: FrameCatalogModelGroup;
  frame: FrameCatalogOption;
  selected: boolean;
  selectedVariantCount: number;
  selectedVariantIds: ReadonlySet<string>;
  onSelect: () => void;
  onVariantChange: (frameId: string) => void;
}) {
  const framePhotosEnabled = useFramePhotosEnabled();
  const details = [frame.material, frame.shape].filter(Boolean).join(" · ");
  const colorKey = (variant: FrameCatalogOption) => variant.colorName.trim().toLowerCase();
  const sizeKey = (variant: FrameCatalogOption) =>
    `${variant.eyeSizeMm ?? ""}-${variant.bridgeSizeMm ?? ""}-${variant.templeLengthMm ?? ""}`;
  const activeColorKey = colorKey(frame);
  const activeSizeKey = sizeKey(frame);
  const colorChoices = Array.from(
    group.variants.reduce<Map<string, FrameCatalogOption>>((choices, variant) => {
      const key = colorKey(variant);
      if (!choices.has(key)) choices.set(key, variant);
      return choices;
    }, new Map())
  );
  const sizeChoices = Array.from(
    group.variants.reduce<Map<string, FrameCatalogOption>>((choices, variant) => {
      const key = sizeKey(variant);
      if (!choices.has(key)) choices.set(key, variant);
      return choices;
    }, new Map())
  ).sort(([, left], [, right]) =>
    formatCatalogFrameSize(left).localeCompare(formatCatalogFrameSize(right))
  );

  function chooseColor(nextColorKey: string) {
    const colorVariants = group.variants.filter(
      (variant) => colorKey(variant) === nextColorKey
    );
    const matchingSizeVariants = colorVariants.filter(
      (variant) => sizeKey(variant) === activeSizeKey
    );
    const nextFrame =
      matchingSizeVariants.find((variant) => !variant.alreadyInInventory) ??
      matchingSizeVariants[0] ??
      colorVariants.find((variant) => !variant.alreadyInInventory) ??
      colorVariants[0];
    if (nextFrame) onVariantChange(nextFrame.id);
  }

  function chooseSize(nextSizeKey: string) {
    const matchingVariants = group.variants.filter(
      (variant) =>
        colorKey(variant) === activeColorKey && sizeKey(variant) === nextSizeKey
    );
    const nextFrame =
      matchingVariants.find((variant) => !variant.alreadyInInventory) ??
      matchingVariants[0] ??
      null;
    if (nextFrame) onVariantChange(nextFrame.id);
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-white shadow-sm transition",
        selected
          ? "border-teal-600 ring-1 ring-teal-600"
          : "border-navy-100 hover:border-teal-300 hover:shadow-card"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={frame.alreadyInInventory}
        aria-pressed={selected}
        className={cn(
          "block w-full p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600",
          frame.alreadyInInventory && "cursor-not-allowed opacity-60"
        )}
      >
        {framePhotosEnabled ? (
          <div className="flex h-32 items-center justify-center rounded-lg bg-white px-2">
            {frame.imageUrl ? (
              <Image
                src={frame.imageUrl}
                unoptimized
                width={240}
                height={120}
                sizes="(min-width: 1280px) 240px, (min-width: 768px) 220px, 80vw"
                className="h-28 w-full object-contain"
                alt={`${frame.brand} ${frame.model} in ${frame.colorName}`}
              />
            ) : (
              <Glasses className="h-16 w-16 text-navy-300" strokeWidth={1.4} />
            )}
          </div>
        ) : null}
        <div className={cn("flex items-start justify-between gap-2", framePhotosEnabled && "mt-3")}>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-teal-700">
              {frame.brand}
            </p>
            <p className="truncate font-semibold text-navy-900">{frame.model}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {selectedVariantCount > 0 ? (
              <Badge variant="teal">
                {selectedVariantCount} selected
              </Badge>
            ) : null}
            {frame.alreadyInInventory ? (
              <Badge variant="outline">In inventory</Badge>
            ) : selected ? (
              <span className="rounded-full bg-teal-600 p-1 text-white" aria-label="Selected">
                <Check className="h-3.5 w-3.5" />
              </span>
            ) : null}
          </div>
        </div>
        <p className="mt-1 text-xs font-medium tabular-nums text-navy-500">
          {formatCatalogFrameSize(frame)}
        </p>
        {details ? <p className="mt-1 truncate text-xs text-navy-400">{details}</p> : null}
      </button>

      <div className="space-y-3 border-t border-navy-100 bg-navy-50/40 px-3 py-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-navy-500">Color</p>
            <p className="truncate text-sm font-semibold text-navy-800">{frame.colorName}</p>
          </div>
          <div
            className="flex max-w-[65%] flex-wrap justify-end gap-2"
            role="group"
            aria-label={`Color for ${group.brand} ${group.model}`}
          >
            {colorChoices.map(([choiceKey, variant]) => {
              const active = choiceKey === activeColorKey;
              const selectedInColor = group.variants.some(
                (candidate) =>
                  colorKey(candidate) === choiceKey &&
                  selectedVariantIds.has(candidate.id)
              );
              const unavailableAtCurrentSize = !group.variants.some(
                (candidate) =>
                  colorKey(candidate) === choiceKey && sizeKey(candidate) === activeSizeKey
              );
              return (
                <button
                  key={choiceKey}
                  type="button"
                  onClick={() => chooseColor(choiceKey)}
                  aria-label={`${variant.colorName}${
                    unavailableAtCurrentSize ? ", available in another size" : ""
                  }${selectedInColor ? ", selected" : ""}`}
                  aria-pressed={active}
                  title={`${variant.colorName}${
                    unavailableAtCurrentSize ? " — choosing this color will update the size" : ""
                  }`}
                  className={cn(
                    "relative h-7 w-7 rounded-full border-2 border-white shadow-sm ring-1 transition",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2",
                    active
                      ? "scale-110 ring-2 ring-navy-800"
                      : "ring-navy-200 hover:scale-105 hover:ring-navy-400"
                  )}
                  style={{ background: catalogColorSwatch(variant.colorName) }}
                >
                  {selectedInColor ? (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-teal-600 text-white ring-1 ring-white">
                      <Check className="h-2.5 w-2.5" aria-hidden="true" />
                    </span>
                  ) : active ? (
                    <span className="absolute inset-1 rounded-full border-2 border-white/90 shadow-sm" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-navy-500">Size</p>
            <p className="text-[11px] text-navy-400">Eye–bridge–temple</p>
          </div>
          <div
            className="flex max-w-[72%] flex-wrap justify-end gap-1.5"
            role="group"
            aria-label={`Size for ${group.brand} ${group.model} in ${frame.colorName}`}
          >
            {sizeChoices.map(([choiceKey, variant]) => {
              const matchingVariant = group.variants.find(
                (candidate) =>
                  colorKey(candidate) === activeColorKey && sizeKey(candidate) === choiceKey
              );
              const active = choiceKey === activeSizeKey;
              const unavailable = !matchingVariant;
              return (
                <button
                  key={choiceKey}
                  type="button"
                  onClick={() => chooseSize(choiceKey)}
                  disabled={unavailable}
                  aria-pressed={active}
                  aria-label={`${formatCatalogFrameSize(variant)}${
                    unavailable ? `, unavailable in ${frame.colorName}` : ""
                  }`}
                  title={
                    unavailable
                      ? `Not available in ${frame.colorName}`
                      : formatCatalogFrameSize(variant)
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
                  {formatCatalogFrameSize(variant)}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function CatalogBatchSubmitButton({ selectedCount }: { selectedCount: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" disabled={selectedCount === 0 || pending}>
      <PackagePlus className="h-4 w-4" />
      {pending
        ? "Adding selected frames…"
        : selectedCount === 1
          ? "Add selected frame"
          : `Add ${selectedCount} selected frames`}
    </Button>
  );
}

function CatalogNotice({
  title,
  description,
  tone = "default",
}: {
  title: string;
  description: string;
  tone?: "default" | "error";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-5 py-8 text-center",
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-dashed border-navy-200 bg-navy-50/40 text-navy-600"
      )}
      role={tone === "error" ? "alert" : undefined}
    >
      <Library className="mx-auto h-9 w-9 opacity-50" />
      <p className="mt-3 font-semibold text-navy-900">{title}</p>
      <p className="mx-auto mt-1 max-w-xl text-sm">{description}</p>
    </div>
  );
}

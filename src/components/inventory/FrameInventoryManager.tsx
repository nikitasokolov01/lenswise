"use client";

import Image from "next/image";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  Archive,
  Boxes,
  Glasses,
  Minus,
  PackagePlus,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  createFrameInventoryAction,
  deleteFrameInventoryAction,
  setFrameActiveAction,
  setFrameStockAction,
  updateFrameInventoryAction,
  type FrameInventoryActionState,
} from "@/app/(app)/inventory/actions";
import { useFramePhotosEnabled } from "@/lib/catalog/framePhotoVisibilityContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCents } from "@/lib/money";
import type { FrameInventoryItem } from "@/lib/inventory/types";

type InventoryFilter = "active" | "low" | "out" | "archived" | "all";
type AddFrameMode = "catalog" | "manual";
const EMPTY_STATE: FrameInventoryActionState = {};
const ADD_FRAME_OPTIONS = [
  { value: "catalog", label: "Choose from catalog" },
  { value: "manual", label: "Enter manually" },
] satisfies Array<{ value: AddFrameMode; label: string }>;

export function FrameInventoryManager({
  frames,
  locationName,
  catalogPanel,
  canManage,
  loadError,
}: {
  frames: FrameInventoryItem[];
  locationName: string;
  catalogPanel: ReactNode;
  canManage: boolean;
  loadError: string | null;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InventoryFilter>("active");
  const [showAdd, setShowAdd] = useState(frames.length === 0);
  const [addMode, setAddMode] = useState<AddFrameMode>("catalog");

  const stats = useMemo(() => {
    const active = frames.filter((frame) => frame.isActive);
    return {
      styles: active.length,
      units: active.reduce((total, frame) => total + frame.quantityOnHand, 0),
      low: active.filter(
        (frame) => frame.quantityOnHand > 0 && frame.quantityOnHand <= frame.reorderLevel
      ).length,
      out: active.filter((frame) => frame.quantityOnHand === 0).length,
    };
  }, [frames]);

  const visibleFrames = useMemo(() => {
    const query = search.trim().toLowerCase();
    return frames.filter((frame) => {
      const matchesSearch =
        query === "" ||
        [frame.brand, frame.model, frame.color, frame.sku ?? "", frame.upc ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(query);
      if (!matchesSearch) return false;

      if (filter === "active") return frame.isActive;
      if (filter === "archived") return !frame.isActive;
      if (!frame.isActive) return false;
      if (filter === "out") return frame.quantityOnHand === 0;
      if (filter === "low") {
        return frame.quantityOnHand > 0 && frame.quantityOnHand <= frame.reorderLevel;
      }
      return true;
    });
  }, [filter, frames, search]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">Office catalog</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">Frame inventory</h1>
          <p className="mt-1 max-w-2xl text-sm text-navy-500">
            Viewing <span className="font-semibold text-navy-700">{locationName}</span>. Keep this
            frame board searchable, track stock, and preserve the exact model and size used for a quote.
          </p>
        </div>
        {canManage ? (
          <Button variant="accent" onClick={() => setShowAdd((shown) => !shown)}>
            {showAdd ? <X className="h-4 w-4" /> : <PackagePlus className="h-4 w-4" />}
            {showAdd ? "Close form" : "Add frame"}
          </Button>
        ) : null}
      </div>

      {loadError ? (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {loadError}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active styles" value={stats.styles} icon={Glasses} />
        <StatCard label="Units on hand" value={stats.units} icon={Boxes} />
        <StatCard label="Low stock" value={stats.low} icon={TriangleAlert} warning={stats.low > 0} />
        <StatCard label="Out of stock" value={stats.out} icon={Archive} warning={stats.out > 0} />
      </div>

      {showAdd && canManage ? (
        <Card className="mt-6 overflow-hidden border-teal-200">
          <CardHeader className="bg-teal-50/60">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Add a frame</CardTitle>
                <CardDescription>
                  {addMode === "catalog"
                    ? `Search the licensed catalog and copy an exact color and size into ${locationName}.`
                    : "Enter a frame that is not available in the connected catalog."}
                </CardDescription>
              </div>
              <SegmentedControl
                label="Frame entry method"
                options={ADD_FRAME_OPTIONS}
                value={addMode}
                onChange={setAddMode}
              />
            </div>
          </CardHeader>
          <CardContent>
            {addMode === "catalog" ? catalogPanel : <FrameForm mode="create" />}
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-navy-100 bg-white p-3 shadow-sm sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-navy-400" />
          <Input
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search brand, model, color, SKU, or UPC"
            aria-label="Search frame inventory"
          />
        </div>
        <Select
          className="sm:w-44"
          value={filter}
          onChange={(event) => setFilter(event.target.value as InventoryFilter)}
          aria-label="Filter frame inventory"
        >
          <option value="active">Active frames</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
          <option value="archived">Archived</option>
          <option value="all">All frames</option>
        </Select>
      </div>

      {visibleFrames.length > 0 ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {visibleFrames.map((frame) => (
            <FrameCard key={frame.id} frame={frame} canManage={canManage} />
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-navy-200 bg-white px-6 py-12 text-center">
          <Glasses className="mx-auto h-10 w-10 text-navy-300" />
          <h2 className="mt-3 font-semibold text-navy-900">
            {frames.length === 0 ? "No frames added yet" : "No frames match this view"}
          </h2>
          <p className="mt-1 text-sm text-navy-500">
            {frames.length === 0
              ? "Add the first frame from your board to begin tracking inventory."
              : "Try a different search or stock filter."}
          </p>
        </div>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  warning = false,
}: {
  label: string;
  value: number;
  icon: typeof Glasses;
  warning?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-navy-100 bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-navy-500">{label}</p>
        <Icon className={`h-4 w-4 ${warning ? "text-amber-600" : "text-teal-700"}`} />
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-navy-900">{value}</p>
    </div>
  );
}

function FrameCard({ frame, canManage }: { frame: FrameInventoryItem; canManage: boolean }) {
  const framePhotosEnabled = useFramePhotosEnabled();
  const dimensions = [frame.eyeSizeMm, frame.bridgeSizeMm, frame.templeLengthMm].every(
    (value) => value != null
  )
    ? `${frame.eyeSizeMm}–${frame.bridgeSizeMm}–${frame.templeLengthMm}`
    : null;
  const lowStock =
    frame.isActive && frame.quantityOnHand > 0 && frame.quantityOnHand <= frame.reorderLevel;

  return (
    <Card className={!frame.isActive ? "opacity-70" : undefined}>
      <CardContent className="p-0">
        <div className="flex gap-4 p-4">
          {framePhotosEnabled ? (
            <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-navy-50 p-1 text-teal-700 ring-1 ring-navy-100">
              {frame.imageUrl ? (
                <Image
                  src={frame.imageUrl}
                  unoptimized
                  width={160}
                  height={96}
                  sizes="112px"
                  className="h-full w-full object-contain"
                  alt={`${frame.brand} ${frame.model} in ${frame.color}`}
                />
              ) : (
                <Glasses className="h-11 w-11" strokeWidth={1.5} aria-hidden="true" />
              )}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">{frame.brand}</p>
                <h2 className="truncate text-lg font-semibold text-navy-900">{frame.model}</h2>
                <p className="text-sm text-navy-500">
                  {[frame.color, dimensions].filter(Boolean).join(" · ") || "No color or size entered"}
                </p>
              </div>
              <StockBadge frame={frame} lowStock={lowStock} />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-semibold tabular-nums text-navy-900">
                {formatCents(frame.retailPriceCents)}
              </span>
              {frame.sku ? <span className="text-navy-500">SKU {frame.sku}</span> : null}
              {frame.upc ? <span className="text-navy-500">UPC {frame.upc}</span> : null}
            </div>
          </div>
        </div>

        {canManage ? (
          <div className="border-t border-navy-100 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StockControls frame={frame} />
              <div className="flex flex-wrap items-start justify-end gap-2">
                <FrameStatusButton frame={frame} />
                <FrameDeleteButton frame={frame} />
              </div>
            </div>
            <details className="group mt-3">
              <summary className="flex h-9 w-fit cursor-pointer list-none items-center gap-2 rounded-full border border-navy-200 bg-white px-3 text-sm font-semibold text-navy-900 hover:bg-navy-50">
                <Pencil className="h-3.5 w-3.5" /> Edit details
              </summary>
              <div className="mt-3 rounded-2xl border border-navy-100 bg-navy-50/40 p-4">
                <FrameForm mode="edit" frame={frame} />
              </div>
            </details>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StockBadge({ frame, lowStock }: { frame: FrameInventoryItem; lowStock: boolean }) {
  if (!frame.isActive) return <Badge variant="outline">Archived</Badge>;
  if (frame.quantityOnHand === 0) return <Badge variant="warning">Out of stock</Badge>;
  if (lowStock) return <Badge variant="warning">{frame.quantityOnHand} left · low</Badge>;
  return <Badge variant="teal">{frame.quantityOnHand} in stock</Badge>;
}

function StockControls({ frame }: { frame: FrameInventoryItem }) {
  const [state, formAction] = useFormState(setFrameStockAction, EMPTY_STATE);

  return (
    <div>
      <div className="flex items-center gap-2" aria-label={`Stock controls for ${frame.brand} ${frame.model}`}>
        <form action={formAction}>
          <input type="hidden" name="id" value={frame.id} />
          <input type="hidden" name="quantity" value={Math.max(0, frame.quantityOnHand - 1)} />
          <IconSubmitButton label="Remove one from stock" disabled={frame.quantityOnHand === 0}>
            <Minus className="h-4 w-4" />
          </IconSubmitButton>
        </form>
        <span className="min-w-8 text-center text-sm font-semibold tabular-nums text-navy-900">
          {frame.quantityOnHand}
        </span>
        <form action={formAction}>
          <input type="hidden" name="id" value={frame.id} />
          <input type="hidden" name="quantity" value={frame.quantityOnHand + 1} />
          <IconSubmitButton label="Add one to stock">
            <Plus className="h-4 w-4" />
          </IconSubmitButton>
        </form>
      </div>
      {state.error ? <p className="mt-1 text-xs text-red-600">{state.error}</p> : null}
    </div>
  );
}

function IconSubmitButton({
  label,
  disabled,
  children,
}: {
  label: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant="secondary"
      className="h-9 w-9 p-0"
      disabled={disabled || pending}
      aria-label={label}
    >
      {children}
    </Button>
  );
}

function FrameStatusButton({ frame }: { frame: FrameInventoryItem }) {
  const [state, formAction] = useFormState(setFrameActiveAction, EMPTY_STATE);

  function confirmArchive(event: FormEvent<HTMLFormElement>) {
    if (frame.isActive && !window.confirm(`Archive ${frame.brand} ${frame.model}?`)) {
      event.preventDefault();
    }
  }

  return (
    <form action={formAction} onSubmit={confirmArchive}>
      <input type="hidden" name="id" value={frame.id} />
      <input type="hidden" name="isActive" value={String(!frame.isActive)} />
      <StatusSubmitButton active={frame.isActive} />
      {state.error ? <p className="mt-1 text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}

function StatusSubmitButton({ active }: { active: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={active ? "ghost" : "secondary"} disabled={pending}>
      {active ? <Archive className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
      {pending ? "Saving…" : active ? "Archive" : "Restore"}
    </Button>
  );
}

function FrameDeleteButton({ frame }: { frame: FrameInventoryItem }) {
  const [state, formAction] = useFormState(deleteFrameInventoryAction, EMPTY_STATE);

  function confirmDelete(event: FormEvent<HTMLFormElement>) {
    const description = [frame.brand, frame.model, frame.color].filter(Boolean).join(" ");
    const confirmed = window.confirm(
      `Permanently delete ${description} from this office's inventory?\n\nThis cannot be undone.`
    );
    if (!confirmed) event.preventDefault();
  }

  return (
    <form action={formAction} onSubmit={confirmDelete}>
      <input type="hidden" name="id" value={frame.id} />
      <DeleteSubmitButton />
      {state.error ? <p className="mt-1 text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}

function DeleteSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="danger" disabled={pending}>
      <Trash2 className="h-3.5 w-3.5" />
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}

function FrameForm({ mode, frame }: { mode: "create" | "edit"; frame?: FrameInventoryItem }) {
  const action = mode === "create" ? createFrameInventoryAction : updateFrameInventoryAction;
  const [state, formAction] = useFormState(action, EMPTY_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (mode === "create" && state.ok) formRef.current?.reset();
  }, [mode, state.ok]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {frame ? <input type="hidden" name="id" value={frame.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Brand" name="brand" required defaultValue={frame?.brand} placeholder="Ray-Ban" />
        <Field label="Model" name="model" required defaultValue={frame?.model} placeholder="RX5228" />
        <Field label="Color" name="color" defaultValue={frame?.color} placeholder="Black" />
        <Field
          label="Eye size (mm)"
          name="eyeSizeMm"
          inputMode="numeric"
          defaultValue={frame?.eyeSizeMm ?? ""}
          placeholder="53"
        />
        <Field
          label="Bridge (mm)"
          name="bridgeSizeMm"
          inputMode="numeric"
          defaultValue={frame?.bridgeSizeMm ?? ""}
          placeholder="17"
        />
        <Field
          label="Temple (mm)"
          name="templeLengthMm"
          inputMode="numeric"
          defaultValue={frame?.templeLengthMm ?? ""}
          placeholder="140"
        />
        <Field label="SKU" name="sku" defaultValue={frame?.sku ?? ""} placeholder="Internal item number" />
        <Field label="UPC" name="upc" defaultValue={frame?.upc ?? ""} inputMode="numeric" placeholder="Barcode" />
        <Field
          label="Retail price"
          name="retailPrice"
          defaultValue={frame ? (frame.retailPriceCents / 100).toFixed(2) : ""}
          inputMode="decimal"
          prefix="$"
          placeholder="199.00"
        />
        <Field
          label="Wholesale cost"
          name="wholesaleCost"
          defaultValue={frame ? (frame.wholesaleCostCents / 100).toFixed(2) : ""}
          inputMode="decimal"
          prefix="$"
          placeholder="80.00"
        />
        <Field
          label="Quantity"
          name="quantityOnHand"
          defaultValue={frame?.quantityOnHand ?? 1}
          inputMode="numeric"
          required
        />
        <Field
          label="Low-stock alert at"
          name="reorderLevel"
          defaultValue={frame?.reorderLevel ?? 1}
          inputMode="numeric"
          required
        />
      </div>
      <div>
        <Label htmlFor={`${mode}-${frame?.id ?? "new"}-notes`}>Notes</Label>
        <Textarea
          id={`${mode}-${frame?.id ?? "new"}-notes`}
          name="notes"
          defaultValue={frame?.notes}
          maxLength={1000}
          placeholder="Supplier, shelf location, special ordering notes…"
        />
      </div>

      {state.error ? <p className="text-sm font-medium text-red-600">{state.error}</p> : null}
      {state.ok && state.message ? <p className="text-sm font-medium text-teal-700">{state.message}</p> : null}
      <FrameFormSubmitButton mode={mode} />
    </form>
  );
}

function Field({
  label,
  name,
  prefix,
  ...props
}: {
  label: string;
  name: string;
  prefix?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId();
  const id = `frame-${name}-${generatedId}`;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute left-3 top-3 text-navy-400">{prefix}</span>
        ) : null}
        <Input id={id} name={name} className={prefix ? "pl-7" : undefined} {...props} />
      </div>
    </div>
  );
}

function FrameFormSubmitButton({ mode }: { mode: "create" | "edit" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" disabled={pending}>
      {pending ? "Saving…" : mode === "create" ? "Add to inventory" : "Save changes"}
    </Button>
  );
}

"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  Ban,
  Banknote,
  CalendarClock,
  CreditCard,
  ReceiptText,
  RotateCcw,
  X,
} from "lucide-react";
import {
  reverseSaleAction,
  type ReverseSaleActionState,
} from "@/app/(app)/sales/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCents } from "@/lib/money";
import {
  formatSalePayment,
  type SaleHistoryRow,
  type SaleReversalOutcome,
} from "@/lib/sales/types";

const EMPTY_STATE: ReverseSaleActionState = {};

interface SalesHistoryProps {
  locationName: string;
  sales: SaleHistoryRow[];
  canReverse: boolean;
  loadError: string | null;
}

function ReverseSubmit({ outcome }: { outcome: SaleReversalOutcome }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={outcome === "voided" ? "danger" : "primary"}
      className="w-full"
      disabled={pending}
    >
      {pending
        ? "Saving…"
        : outcome === "voided"
          ? "Void sale and restore stock"
          : "Record return and restore stock"}
    </Button>
  );
}

function ReverseSaleDialog({
  sale,
  outcome,
  onClose,
}: {
  sale: SaleHistoryRow;
  outcome: SaleReversalOutcome;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction] = useFormState(reverseSaleAction, EMPTY_STATE);

  useEffect(() => {
    if (!state.ok) return;
    onClose();
    router.refresh();
  }, [onClose, router, state.ok]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const isVoid = outcome === "voided";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-navy-950/55 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="reverse-sale-title"
        className="w-full max-w-md rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-navy-100 px-5 py-4">
          <div>
            <h2 id="reverse-sale-title" className="text-xl font-bold text-navy-900">
              {isVoid ? "Void this sale?" : "Return frame to inventory?"}
            </h2>
            <p className="mt-1 text-sm text-navy-500">
              {sale.frameInventoryId
                ? "One unit will be restored to the linked frame."
                : "This sale has no linked inventory frame, so stock will not change."}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="-mr-2 -mt-2" aria-label="Close" onClick={onClose}>
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
        <form action={formAction} className="space-y-4 px-5 py-5">
          <input type="hidden" name="saleId" value={sale.id} />
          <input type="hidden" name="outcome" value={outcome} />
          <div>
            <Label htmlFor={`reversal-reason-${sale.id}`}>Reason</Label>
            <Textarea
              id={`reversal-reason-${sale.id}`}
              name="reason"
              required
              minLength={3}
              maxLength={500}
              rows={3}
              autoFocus
              placeholder={isVoid ? "Example: Payment entry was accidental" : "Example: Frame returned in sellable condition"}
            />
          </div>
          {state.error ? (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          ) : null}
          <ReverseSubmit outcome={outcome} />
        </form>
      </section>
    </div>
  );
}

export function SalesHistory({
  locationName,
  sales,
  canReverse,
  loadError,
}: SalesHistoryProps) {
  const [reverseTarget, setReverseTarget] = useState<{
    sale: SaleHistoryRow;
    outcome: SaleReversalOutcome;
  } | null>(null);

  const completedSales = sales.filter((sale) => sale.status === "completed");
  const collectedCents = completedSales.reduce(
    (total, sale) => total + sale.patientResponsibilityCents,
    0
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
      <header className="mb-6">
        <span className="inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-800">
          {locationName}
        </span>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy-900">Sales history</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-navy-500">
          Payments recorded in LensWise and the inventory movements connected to them.
          Payments are still collected in your existing POS or as cash.
        </p>
      </header>

      <section className="mb-6 grid gap-3 sm:grid-cols-3" aria-label="Sales summary">
        <div className="rounded-lg border border-navy-100 bg-white p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">Completed sales</p>
          <p className="mt-1 text-2xl font-bold text-navy-900">{completedSales.length}</p>
        </div>
        <div className="rounded-lg border border-navy-100 bg-white p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">Recorded total</p>
          <p className="mt-1 text-2xl font-bold text-navy-900">{formatCents(collectedCents)}</p>
        </div>
        <div className="rounded-lg border border-navy-100 bg-white p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">Reversed / returned</p>
          <p className="mt-1 text-2xl font-bold text-navy-900">
            {sales.length - completedSales.length}
          </p>
        </div>
      </section>

      {loadError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </p>
      ) : null}

      {!loadError && sales.length === 0 ? (
        <section className="rounded-xl border border-dashed border-navy-200 bg-white px-6 py-14 text-center">
          <ReceiptText className="mx-auto h-10 w-10 text-navy-300" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold text-navy-900">No sales recorded yet</h2>
          <p className="mt-1 text-sm text-navy-500">
            Complete a quote and press Complete Sale after collecting payment.
          </p>
        </section>
      ) : null}

      <div className="space-y-3">
        {sales.map((sale) => (
          <article key={sale.id} className="rounded-xl border border-navy-100 bg-white p-4 shadow-card sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-lg bg-navy-50 sm:w-36">
                {sale.frameImageUrl ? (
                  <Image
                    src={sale.frameImageUrl}
                    alt={sale.frameName ?? "Sold frame"}
                    fill
                    sizes="144px"
                    className="object-contain p-2"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-navy-300">
                    <ReceiptText className="h-8 w-8" aria-hidden="true" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-navy-950">
                    {sale.frameName || (sale.orderType === "lens_only" ? "Lens-only order" : "Manual frame")}
                  </h2>
                  <Badge
                    variant={
                      sale.status === "completed"
                        ? "teal"
                        : sale.status === "returned"
                          ? "warning"
                          : "outline"
                    }
                    className={sale.status === "voided" ? "border-red-200 bg-red-50 text-red-700" : undefined}
                  >
                    {sale.status === "completed"
                      ? "Completed"
                      : sale.status === "returned"
                        ? "Returned"
                        : "Voided"}
                  </Badge>
                </div>

                <p className="mt-1 text-sm text-navy-500">
                  {[sale.frameColor, sale.frameSize, sale.frameSku ? `SKU ${sale.frameSku}` : null]
                    .filter(Boolean)
                    .join(" · ") || "No frame details"}
                </p>

                <div className="mt-3 grid gap-2 text-sm text-navy-700 sm:grid-cols-2 lg:grid-cols-4">
                  <span className="flex items-center gap-2 font-semibold text-navy-950">
                    {sale.paymentMethod === "cash" ? (
                      <Banknote className="h-4 w-4 text-teal-700" aria-hidden="true" />
                    ) : (
                      <CreditCard className="h-4 w-4 text-teal-700" aria-hidden="true" />
                    )}
                    {formatSalePayment(sale.paymentMethod, sale.cardBrand)}
                  </span>
                  <span className="font-semibold text-navy-950">
                    {formatCents(sale.patientResponsibilityCents)}
                  </span>
                  <span className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-navy-400" aria-hidden="true" />
                    {new Date(sale.soldAt).toLocaleString()}
                  </span>
                  <span>{sale.soldByName}</span>
                </div>

                {sale.externalReference ? (
                  <p className="mt-2 text-xs text-navy-500">POS reference: {sale.externalReference}</p>
                ) : null}
                {sale.note ? <p className="mt-1 text-xs text-navy-500">Note: {sale.note}</p> : null}
                {sale.reversalReason ? (
                  <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    {sale.status === "returned" ? "Return" : "Void"} reason: {sale.reversalReason}
                  </p>
                ) : null}
              </div>

              {canReverse && sale.status === "completed" ? (
                <div className="flex shrink-0 gap-2 sm:flex-col">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setReverseTarget({ sale, outcome: "voided" })}
                  >
                    <Ban className="h-4 w-4" aria-hidden="true" />
                    Void
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setReverseTarget({ sale, outcome: "returned" })}
                  >
                    <ArrowDownLeft className="h-4 w-4" aria-hidden="true" />
                    Return
                  </Button>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {!canReverse && sales.some((sale) => sale.status === "completed") ? (
        <p className="mt-5 flex items-center gap-2 text-xs text-navy-500">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          An owner or admin can void a mistaken entry or return a frame to inventory.
        </p>
      ) : null}

      {reverseTarget ? (
        <ReverseSaleDialog
          sale={reverseTarget.sale}
          outcome={reverseTarget.outcome}
          onClose={() => setReverseTarget(null)}
        />
      ) : null}
    </main>
  );
}

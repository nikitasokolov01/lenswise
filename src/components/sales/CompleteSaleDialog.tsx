"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { CheckCircle2, CreditCard, LockKeyhole, ShoppingBag, X } from "lucide-react";
import { completeSaleAction, type CompleteSaleActionState } from "@/app/(app)/sales/actions";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCents } from "@/lib/money";
import {
  formatSalePayment,
  type CompletedSale,
  type SalePaymentMethod,
} from "@/lib/sales/types";
import type { OrderType } from "@/lib/types";

const EMPTY_STATE: CompleteSaleActionState = {};

interface CompleteSaleDialogProps {
  saleKey: string;
  canComplete: boolean;
  disabledReason?: string;
  completedSale: CompletedSale | null;
  onCompleted: (sale: CompletedSale) => void;
  orderType: OrderType;
  patientResponsibilityCents: number;
  frameInventoryId: string | null;
  frameName: string;
  frameColor: string;
  frameSize: string;
  frameSku: string;
  frameImageUrl: string;
}

function CompleteSaleSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" className="w-full" disabled={pending}>
      <LockKeyhole className="h-4 w-4" aria-hidden="true" />
      {pending ? "Recording sale…" : "Confirm payment and complete sale"}
    </Button>
  );
}

export function CompleteSaleDialog({
  saleKey,
  canComplete,
  disabledReason,
  completedSale,
  onCompleted,
  orderType,
  patientResponsibilityCents,
  frameInventoryId,
  frameName,
  frameColor,
  frameSize,
  frameSku,
  frameImageUrl,
}: CompleteSaleDialogProps) {
  const [open, setOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>("card");
  const [state, formAction] = useFormState(completeSaleAction, EMPTY_STATE);

  useEffect(() => {
    if (!state.sale || state.sale.id === completedSale?.id) return;
    onCompleted(state.sale);
    setOpen(false);
  }, [completedSale?.id, onCompleted, state.sale]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (completedSale) {
    return (
      <div className="w-full rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
          <div>
            <p className="font-semibold">
              {completedSale.status === "completed" ? "Sale completed" : `Sale ${completedSale.status}`}
            </p>
            <p className="mt-0.5 text-emerald-800">
              {formatSalePayment(completedSale.paymentMethod, completedSale.cardBrand)}
              {completedSale.externalReference
                ? ` · Ref ${completedSale.externalReference}`
                : ""}
            </p>
            {completedSale.quantityAfter != null ? (
              <p className="mt-1 text-xs text-emerald-700">
                Inventory updated: {completedSale.quantityAfter} remaining.
              </p>
            ) : (
              <p className="mt-1 text-xs text-emerald-700">
                No inventory item was linked, so stock was not changed.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full">
        <Button
          variant="accent"
          className="w-full"
          disabled={!canComplete || !saleKey}
          onClick={() => setOpen(true)}
        >
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
          Complete Sale
        </Button>
        {disabledReason ? (
          <p className="mt-1.5 text-xs leading-5 text-navy-500">{disabledReason}</p>
        ) : null}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-navy-950/55 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="complete-sale-title"
            className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-navy-100 px-5 py-4">
              <div>
                <h2 id="complete-sale-title" className="text-xl font-bold text-navy-900">
                  Complete this sale
                </h2>
                <p className="mt-1 text-sm text-navy-500">
                  Record payment after it has been collected in your POS or as cash.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="-mr-2 -mt-2"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>

            <form action={formAction} className="space-y-5 px-5 py-5">
              <input type="hidden" name="idempotencyKey" value={saleKey} />
              <input type="hidden" name="frameInventoryId" value={frameInventoryId ?? ""} />
              <input type="hidden" name="orderType" value={orderType} />
              <input
                type="hidden"
                name="patientResponsibilityCents"
                value={patientResponsibilityCents}
              />
              <input type="hidden" name="manualFrameName" value={frameName} />
              <input type="hidden" name="manualFrameColor" value={frameColor} />
              <input type="hidden" name="manualFrameSize" value={frameSize} />
              <input type="hidden" name="manualFrameSku" value={frameSku} />
              <input type="hidden" name="manualFrameImageUrl" value={frameImageUrl} />

              <div className="rounded-lg bg-navy-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">
                  Amount collected
                </p>
                <p className="mt-1 text-3xl font-bold text-navy-950">
                  {formatCents(patientResponsibilityCents)}
                </p>
                {frameInventoryId ? (
                  <p className="mt-2 text-xs text-navy-600">
                    Completing the sale removes one {frameName || "frame"} from this location’s
                    inventory.
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-navy-600">
                    No inventory frame is linked. The sale will be recorded without changing
                    stock.
                  </p>
                )}
              </div>

              <fieldset>
                <legend className="text-sm font-semibold text-navy-900">Payment method</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["card", "cash"] as const).map((method) => (
                    <label
                      key={method}
                      className={`flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors ${
                        paymentMethod === method
                          ? "border-teal-600 bg-teal-50 text-teal-900"
                          : "border-navy-200 bg-white text-navy-700 hover:bg-navy-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method}
                        checked={paymentMethod === method}
                        onChange={() => setPaymentMethod(method)}
                        className="sr-only"
                      />
                      <CreditCard className="h-4 w-4" aria-hidden="true" />
                      {method === "card" ? "Card" : "Cash"}
                    </label>
                  ))}
                </div>
              </fieldset>

              {paymentMethod === "card" ? (
                <div>
                  <Label htmlFor="sale-card-brand">Card brand</Label>
                  <Select id="sale-card-brand" name="cardBrand" defaultValue="" required>
                    <option value="" disabled>
                      Choose card brand
                    </option>
                    <option value="visa">Visa</option>
                    <option value="mastercard">Mastercard</option>
                    <option value="amex">American Express</option>
                    <option value="discover">Discover</option>
                  </Select>
                </div>
              ) : (
                <input type="hidden" name="cardBrand" value="" />
              )}

              <div>
                <Label htmlFor="sale-external-reference">
                  POS receipt or reference <span className="font-normal text-navy-400">(optional)</span>
                </Label>
                <Input
                  id="sale-external-reference"
                  name="externalReference"
                  maxLength={120}
                  placeholder="Example: Receipt 1842"
                />
              </div>

              <div>
                <Label htmlFor="sale-note">
                  Internal payment note <span className="font-normal text-navy-400">(optional)</span>
                </Label>
                <Textarea
                  id="sale-note"
                  name="note"
                  maxLength={1000}
                  rows={3}
                  placeholder="Do not enter patient details or card numbers."
                />
              </div>

              <CheckboxField
                name="paymentConfirmed"
                value="confirmed"
                required
                label="Payment was collected outside LensWise"
                description="Mark this order as sold and update linked frame inventory."
              />

              {state.error ? (
                <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {state.error}
                </p>
              ) : null}

              <p className="text-xs leading-5 text-navy-400">
                LensWise stores the payment type only. Never enter a full card number,
                expiration date, or security code.
              </p>
              <CompleteSaleSubmit />
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}

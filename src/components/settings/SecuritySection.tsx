"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LockButton } from "@/components/settings/LockButton";
import { PIN_MAX_LENGTH } from "@/lib/settings/pinFormat";
import { changePinAction, resetPinAction, type PinActionState } from "@/app/(app)/settings/actions";

const EMPTY: PinActionState = {};

/**
 * Settings → Security. Owner-only PIN management: change PIN (requires current),
 * reset a forgotten PIN (owner account authorization, no current PIN), and Lock
 * Settings. The PIN is only ever hashed/verified server-side.
 */
export function SecuritySection({ canManagePin }: { canManagePin: boolean }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-navy-900">Security</h2>
        <p className="mt-1 text-sm text-navy-500">
          Manage the Office PIN that protects pricing and organization settings on shared office devices.
        </p>
      </div>

      {canManagePin ? (
        <>
          <section className="rounded-lg border border-navy-100 bg-white p-5">
            <h3 className="mb-3 text-base font-semibold text-navy-900">Change Office PIN</h3>
            <PinForm
              action={changePinAction}
              fields={[
                { name: "currentPin", label: "Current PIN" },
                { name: "newPin", label: "New PIN" },
                { name: "confirmPin", label: "Confirm new PIN" },
              ]}
              submitLabel="Change PIN"
              successLabel="Office PIN changed."
            />
          </section>

          <section className="rounded-lg border border-navy-100 bg-white p-5">
            <h3 className="mb-1 text-base font-semibold text-navy-900">Reset a forgotten Office PIN</h3>
            <p className="mb-3 text-sm text-navy-500">
              Sets a new PIN using your owner account. Your old PIN is never shown or emailed.
            </p>
            <PinForm
              action={resetPinAction}
              fields={[
                { name: "newPin", label: "New PIN" },
                { name: "confirmPin", label: "Confirm new PIN" },
              ]}
              submitLabel="Reset PIN"
              successLabel="Office PIN reset."
            />
          </section>
        </>
      ) : (
        <section className="rounded-lg border border-navy-100 bg-white p-5">
          <p className="text-sm text-navy-600">Only the organization owner can change or reset the Office PIN.</p>
        </section>
      )}

      <section className="rounded-lg border border-navy-100 bg-white p-5">
        <h3 className="mb-1 text-base font-semibold text-navy-900">Lock protected settings</h3>
        <p className="mb-3 text-sm text-navy-500">
          Immediately re-lock protected settings on this device. You&apos;ll need the Office PIN to unlock again. Billing
          stays available without the PIN.
        </p>
        <LockButton />
      </section>
    </div>
  );
}

function PinForm({
  action,
  fields,
  submitLabel,
  successLabel,
}: {
  action: (prev: PinActionState, formData: FormData) => Promise<PinActionState>;
  fields: { name: string; label: string }[];
  submitLabel: string;
  successLabel: string;
}) {
  const [state, formAction] = useFormState(action, EMPTY);
  const [show, setShow] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      {fields.map((field) => (
        <div key={field.name} className="space-y-1.5">
          <Label htmlFor={`sec-${field.name}`}>{field.label}</Label>
          <div className="relative">
            <input
              id={`sec-${field.name}`}
              name={field.name}
              type={show ? "text" : "password"}
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]*"
              maxLength={PIN_MAX_LENGTH}
              required
              className="h-12 w-full rounded-md border border-navy-200 bg-white px-3 pr-11 text-lg tracking-[0.35em] text-navy-900 placeholder:tracking-normal placeholder:text-navy-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              placeholder="••••"
            />
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <SubmitButton label={submitLabel} />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="flex items-center gap-1.5 text-sm text-navy-500 hover:text-navy-800"
        >
          {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          {show ? "Hide" : "Show"}
        </button>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      {state.ok ? <p className="text-sm text-teal-700">{successLabel}</p> : null}
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Please wait…" : label}
    </Button>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PIN_MAX_LENGTH } from "@/lib/settings/pinFormat";
import {
  setInitialPinAction,
  verifyPinAction,
  resetPinAction,
  type PinActionState,
} from "@/app/(app)/settings/actions";

const EMPTY: PinActionState = {};

/**
 * The Settings gate shown when Settings is locked. Three modes:
 *  - no PIN + owner → "Create Settings PIN" setup,
 *  - no PIN + admin → ask the owner to set it up,
 *  - PIN exists → "Settings Locked" unlock (owners also get a forgot-PIN reset).
 * All verification happens server-side; a wrong PIN returns a single generic
 * error and never reveals which part was wrong.
 */
export function SettingsPinGate({ hasPin, canManagePin }: { hasPin: boolean; canManagePin: boolean }) {
  if (!hasPin) {
    return (
      <GateCard icon={ShieldCheck} title="Create Office PIN">
        {canManagePin ? (
          <>
            <p className="mb-4 text-sm text-navy-600">
              Choose a 4–8 digit PIN to protect pricing and organization settings on shared office devices.
            </p>
            <PinForm action={setInitialPinAction} fields={["pin", "confirmPin"]} submitLabel="Create PIN" />
          </>
        ) : (
          <p className="text-sm text-navy-600">
            Your organization owner needs to set up the Office PIN before these settings can be opened.
          </p>
        )}
      </GateCard>
    );
  }

  return (
    <GateCard icon={Lock} title="Enter Office PIN">
      <p className="mb-4 text-sm text-navy-600">Enter the Office PIN to manage pricing and organization settings.</p>
      <PinForm action={verifyPinAction} fields={["pin"]} submitLabel="Unlock" />
      {canManagePin ? <ForgotPin /> : null}
    </GateCard>
  );
}

function GateCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Lock;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center px-4 py-10">
      <div className="w-full rounded-xl border border-navy-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-700">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="text-xl font-bold text-navy-900">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

type FieldName = "pin" | "confirmPin" | "currentPin" | "newPin";

const FIELD_LABEL: Record<FieldName, string> = {
  pin: "PIN",
  confirmPin: "Confirm PIN",
  currentPin: "Current PIN",
  newPin: "New PIN",
};

function PinForm({
  action,
  fields,
  submitLabel,
}: {
  action: (prev: PinActionState, formData: FormData) => Promise<PinActionState>;
  fields: FieldName[];
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, EMPTY);
  const [show, setShow] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={formAction} className="space-y-4">
      {fields.map((name, i) => (
        <div key={name} className="space-y-1.5">
          <Label htmlFor={`pin-${name}`}>{FIELD_LABEL[name]}</Label>
          <div className="relative">
            <input
              id={`pin-${name}`}
              name={name}
              type={show ? "text" : "password"}
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]*"
              maxLength={PIN_MAX_LENGTH}
              autoFocus={i === 0}
              required
              className="h-12 w-full rounded-md border border-navy-200 bg-white px-3 pr-11 text-lg tracking-[0.4em] text-navy-900 placeholder:tracking-normal placeholder:text-navy-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              placeholder="••••"
            />
            {i === 0 ? (
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide PIN" : "Show PIN"}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-navy-400 hover:text-navy-700"
              >
                {show ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
              </button>
            ) : null}
          </div>
        </div>
      ))}

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <SubmitButton label={submitLabel} />
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" size="lg" className="h-12 w-full" disabled={pending}>
      {pending ? "Please wait…" : label}
    </Button>
  );
}

/** Owner-only forgotten-PIN reset: choose a new PIN without the old one. */
function ForgotPin() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-5 border-t border-navy-100 pt-4">
      {open ? (
        <>
          <p className="mb-3 text-sm font-medium text-navy-800">Reset your PIN</p>
          <p className="mb-3 text-xs text-navy-500">
            As the owner, you can set a new PIN using your signed-in account. Your old PIN is not shown or emailed.
          </p>
          <PinForm action={resetPinAction} fields={["newPin", "confirmPin"]} submitLabel="Set new PIN" />
        </>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800"
        >
          Forgot PIN?
        </button>
      )}
    </div>
  );
}

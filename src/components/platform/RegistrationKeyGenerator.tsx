"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Copy, Check } from "lucide-react";
import { generateRegistrationKeyAction, type GenerateKeyState } from "@/app/platform-admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckboxField } from "@/components/ui/checkbox";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Generating…" : "Generate key"}
    </Button>
  );
}

export function RegistrationKeyGenerator() {
  const [state, formAction] = useFormState<GenerateKeyState, FormData>(generateRegistrationKeyAction, {});
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-3">
      <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="key-label">Label (optional)</Label>
          <Input id="key-label" name="label" placeholder="e.g. Downtown Optical — spring 2026" />
        </div>
        <div>
          <Label htmlFor="key-expires">Expires in (days, 0 = never)</Label>
          <Input id="key-expires" name="expiresInDays" type="number" min={0} max={365} defaultValue={0} />
        </div>
        <div>
          <Label htmlFor="key-max">Maximum uses</Label>
          <Input id="key-max" name="maxUses" type="number" min={1} max={1000} defaultValue={1} />
        </div>
        <div className="sm:col-span-2">
          <CheckboxField label="One-time use (overrides maximum uses)" name="oneTime" />
        </div>
        <div className="sm:col-span-2">
          <SubmitButton />
        </div>
      </form>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      {state.rawKey ? (
        <div className="rounded-md border border-teal-300 bg-teal-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-teal-800">
            Copy this key now — it is shown only once
          </p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 select-all font-mono text-sm text-navy-900">{state.rawKey}</code>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                navigator.clipboard?.writeText(state.rawKey!).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
            >
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

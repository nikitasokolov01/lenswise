"use client";

import { useFormState, useFormStatus } from "react-dom";
import { updateFullNameAction, sendPasswordResetAction, type AccountState } from "@/app/(app)/account/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

function ResetButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Sending…" : "Email me a reset link"}
    </Button>
  );
}

export function AccountNameForm({ fullName }: { fullName: string }) {
  const [state, formAction] = useFormState<AccountState, FormData>(updateFullNameAction, {});
  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      {state.ok ? <p className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">Saved.</p> : null}
      <div>
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" defaultValue={fullName} required />
      </div>
      <SaveButton />
    </form>
  );
}

export function PasswordResetForm() {
  const [state, formAction] = useFormState<AccountState, FormData>(sendPasswordResetAction, {});
  return (
    <form action={formAction} className="space-y-2">
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.resetSent ? (
        <p className="text-sm text-teal-800">Check your email for a password reset link.</p>
      ) : (
        <ResetButton />
      )}
    </form>
  );
}

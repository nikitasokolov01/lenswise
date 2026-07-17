"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { startTrialAction, type FormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/auth/PasswordField";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Starting your trial…" : "Start Free Trial"}
    </Button>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

/**
 * Public onboarding form (no registration key). Creates the owner account and
 * opens Stripe Checkout; the organization is created by the webhook after
 * Checkout completes.
 */
export function StartTrialForm() {
  const [state, formAction] = useFormState<FormState, FormData>(startTrialAction, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <div>
        <Label htmlFor="practiceName">Practice name</Label>
        <Input id="practiceName" name="practiceName" required autoComplete="organization" />
        <FieldError message={fe.practiceName} />
      </div>
      <div>
        <Label htmlFor="ownerName">Your name</Label>
        <Input id="ownerName" name="ownerName" required autoComplete="name" />
        <FieldError message={fe.ownerName} />
      </div>
      <div>
        <Label htmlFor="trial-email">Business email</Label>
        <Input id="trial-email" name="email" type="email" required autoComplete="email" />
        <FieldError message={fe.email} />
      </div>
      <div>
        <PasswordField id="trial-password" name="password" label="Password" autoComplete="new-password" />
        <FieldError message={fe.password} />
      </div>
      <div>
        <PasswordField id="trial-confirm" name="confirmPassword" label="Confirm password" autoComplete="new-password" />
        <FieldError message={fe.confirmPassword} />
      </div>

      <SubmitButton />
      <p className="text-center text-xs text-navy-400">
        You&apos;ll continue to secure checkout to start your 14-day free trial. No charge today.
      </p>
      <p className="text-center text-sm text-navy-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-teal-700 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

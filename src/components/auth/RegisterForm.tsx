"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { registerOrganizationAction, type FormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/auth/PasswordField";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Creating your organization…" : "Create organization"}
    </Button>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

export function RegisterForm() {
  const [state, formAction] = useFormState<FormState, FormData>(registerOrganizationAction, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <div>
        <Label htmlFor="registrationKey">Registration key</Label>
        <Input id="registrationKey" name="registrationKey" placeholder="LW-XXXX-XXXX-XXXX-XXXX" required autoComplete="off" />
        <FieldError message={fe.registrationKey} />
      </div>
      <div>
        <Label htmlFor="officeName">Office name</Label>
        <Input id="officeName" name="officeName" required autoComplete="organization" />
        <FieldError message={fe.officeName} />
      </div>
      <div>
        <Label htmlFor="fullName">Your full name</Label>
        <Input id="fullName" name="fullName" required autoComplete="name" />
        <FieldError message={fe.fullName} />
      </div>
      <div>
        <Label htmlFor="reg-email">Email</Label>
        <Input id="reg-email" name="email" type="email" required autoComplete="email" />
        <FieldError message={fe.email} />
      </div>
      <div>
        <PasswordField id="reg-password" name="password" label="Password" autoComplete="new-password" />
        <FieldError message={fe.password} />
      </div>
      <div>
        <PasswordField id="reg-confirm" name="confirmPassword" label="Confirm password" autoComplete="new-password" />
        <FieldError message={fe.confirmPassword} />
      </div>

      <SubmitButton />
      <p className="text-center text-sm text-navy-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-teal-700 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

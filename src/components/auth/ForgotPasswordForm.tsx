"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    const supabase = createSupabaseBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (resetError) {
      setError("We couldn't start a password reset. Please try again.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <p className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
          If an account exists for that email, a password reset link is on its way. Check your inbox.
        </p>
        <Link href="/login" className="text-sm font-medium text-teal-700 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div>
        <Label htmlFor="forgot-email">Email</Label>
        <Input id="forgot-email" name="email" type="email" autoComplete="email" required />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-center text-sm text-navy-500">
        <Link href="/login" className="font-medium text-teal-700 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

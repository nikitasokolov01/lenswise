"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/auth/PasswordField";

export function ResetPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // The recovery link establishes a session. With the PKCE flow the link
  // carries a `?code=...` to exchange; otherwise the browser client picks up
  // the session from the URL automatically.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      createSupabaseBrowserClient()
        .auth.exchangeCodeForSession(code)
        .catch(() => undefined);
    }
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirmPassword") ?? "");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError("Your reset link may have expired. Request a new one.");
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1200);
  }

  if (done) {
    return (
      <p className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
        Password updated. Taking you into LensWise…
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <PasswordField id="new-password" name="password" label="New password" autoComplete="new-password" />
      <PasswordField id="confirm-password" name="confirmPassword" label="Confirm new password" autoComplete="new-password" />
      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}

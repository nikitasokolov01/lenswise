"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/auth/PasswordField";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    if (signInError) {
      setError("Invalid email or password.");
      setSubmitting(false);
      return;
    }
    router.push(params.get("redirectTo") || "/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div>
        <Label htmlFor="login-email">Email</Label>
        <Input id="login-email" name="email" type="email" autoComplete="email" required />
      </div>
      <PasswordField id="login-password" name="password" label="Password" autoComplete="current-password" />
      <div className="text-right">
        <Link href="/forgot-password" className="text-sm font-medium text-teal-700 hover:underline">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-sm text-navy-500">
        Have a registration key?{" "}
        <Link href="/register" className="font-medium text-teal-700 hover:underline">
          Register your office
        </Link>
      </p>
    </form>
  );
}

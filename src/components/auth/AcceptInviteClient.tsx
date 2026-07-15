"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  previewInvitationAction,
  acceptInvitationAction,
  type InvitePreview,
  type AcceptState,
} from "@/lib/invitations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/auth/PasswordField";

function AcceptButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Joining…" : "Accept invitation"}
    </Button>
  );
}

export function AcceptInviteClient({ token }: { token: string }) {
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [acceptState, acceptAction] = useFormState<AcceptState, FormData>(acceptInvitationAction, {});

  useEffect(() => {
    (async () => {
      const [p, { data }] = await Promise.all([
        previewInvitationAction(token),
        createSupabaseBrowserClient().auth.getUser(),
      ]);
      setPreview(p);
      setSessionEmail(data.user?.email ?? null);
      setReady(true);
    })();
  }, [token]);

  if (!ready) return <p className="text-sm text-navy-500">Loading invitation…</p>;
  if (!preview || preview.error) return <ErrorBox>{preview?.error ?? "This invitation link is not valid."}</ErrorBox>;
  if (preview.status !== "pending") return <ErrorBox>This invitation has already been used or revoked.</ErrorBox>;
  if (preview.expired) return <ErrorBox>This invitation has expired. Ask for a new one.</ErrorBox>;

  const invitedEmail = (preview.email ?? "").toLowerCase();
  const summary = (
    <div className="mb-4 rounded-md border border-navy-100 bg-navy-50 p-3 text-sm text-navy-700">
      You&apos;ve been invited to join <strong>{preview.organizationName}</strong> as{" "}
      <strong className="capitalize">{preview.role}</strong> ({preview.email}).
    </div>
  );

  // Signed in with a different email.
  if (sessionEmail && sessionEmail.toLowerCase() !== invitedEmail) {
    return (
      <>
        {summary}
        <ErrorBox>
          You&apos;re signed in as {sessionEmail}, but this invitation is for {preview.email}. Log out and sign in with
          the invited email to accept.
        </ErrorBox>
      </>
    );
  }

  // Signed in with the matching email — accept directly.
  if (sessionEmail) {
    return (
      <>
        {summary}
        {acceptState.error ? <ErrorBox>{acceptState.error}</ErrorBox> : null}
        <form action={acceptAction}>
          <input type="hidden" name="token" value={token} />
          <AcceptButton />
        </form>
      </>
    );
  }

  // Not signed in — sign in or create an account with the invited email, then accept.
  async function onAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const supabase = createSupabaseBrowserClient();
    const result = createMode
      ? await supabase.auth.signUp({ email: invitedEmail, password })
      : await supabase.auth.signInWithPassword({ email: invitedEmail, password });
    setAuthBusy(false);
    if (result.error) {
      setAuthError(createMode ? "Could not create your account." : "Invalid password for this email.");
      return;
    }
    // Now authenticated with the invited email → show the accept step.
    setSessionEmail(invitedEmail);
  }

  return (
    <>
      {summary}
      {authError ? <ErrorBox>{authError}</ErrorBox> : null}
      <form onSubmit={onAuthSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="invite-email">Email</Label>
          <Input id="invite-email" type="email" value={preview.email} readOnly className="bg-navy-50" />
        </div>
        <PasswordField
          id="invite-password"
          name="password"
          label={createMode ? "Create a password" : "Password"}
          autoComplete={createMode ? "new-password" : "current-password"}
        />
        <Button type="submit" size="lg" className="w-full" disabled={authBusy}>
          {authBusy ? "Please wait…" : createMode ? "Create account & continue" : "Sign in & continue"}
        </Button>
      </form>
      <button
        type="button"
        onClick={() => setCreateMode((v) => !v)}
        className="mt-3 text-sm font-medium text-teal-700 hover:underline"
      >
        {createMode ? "I already have an account" : "I need to create an account"}
      </button>
      <p className="mt-2 text-center text-xs text-navy-400">
        <Link href="/login" className="hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{children}</p>;
}

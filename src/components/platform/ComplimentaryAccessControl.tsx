"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { FormEvent } from "react";
import {
  grantLifetimeComplimentaryAccessAction,
  revokeLifetimeComplimentaryAccessAction,
  type ComplimentaryActionState,
} from "@/app/platform-admin/actions";
import { Button } from "@/components/ui/button";
import { ORG_ACTION_LABELS } from "@/lib/platform/orgActionLabels";

const EMPTY: ComplimentaryActionState = {};

/**
 * Platform Super Admin control to grant or revoke an organization's lifetime
 * complimentary access. Both actions require a confirmation dialog. Rendered
 * only inside Platform Admin — normal organization owners never see it.
 */
export function ComplimentaryAccessControl({
  organizationId,
  organizationName,
  isComplimentary,
}: {
  organizationId: string;
  organizationName: string;
  isComplimentary: boolean;
}) {
  const action = isComplimentary
    ? revokeLifetimeComplimentaryAccessAction
    : grantLifetimeComplimentaryAccessAction;
  const [state, formAction] = useFormState(action, EMPTY);

  const confirmMessage = isComplimentary
    ? `Revoke complimentary access from ${organizationName}?\nNormal Stripe subscription rules will apply immediately.`
    : `Grant lifetime complimentary access to ${organizationName}?\nThis organization will be able to use LensWise without an active Stripe subscription.`;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm(confirmMessage)) event.preventDefault();
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="w-full">
      <input type="hidden" name="organizationId" value={organizationId} />
      <SubmitButton isComplimentary={isComplimentary} />
      {state.error ? <p className="mt-1 text-right text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}

function SubmitButton({ isComplimentary }: { isComplimentary: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={isComplimentary ? "danger" : "secondary"}
      size="sm"
      disabled={pending}
      className="min-h-10 w-full whitespace-nowrap"
    >
      {pending
        ? "Saving…"
        : isComplimentary
          ? ORG_ACTION_LABELS.revokeComplimentary
          : ORG_ACTION_LABELS.grantComplimentary}
    </Button>
  );
}

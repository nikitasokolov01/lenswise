"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { FormEvent } from "react";
import {
  setFramePhotoVisibilityAction,
  type FramePhotoVisibilityActionState,
} from "@/app/platform-admin/actions";
import { Button } from "@/components/ui/button";

const EMPTY_STATE: FramePhotoVisibilityActionState = {};

/**
 * Platform Super Admin control for an organization's licensed frame photos.
 * Organization owners/admins never receive this control.
 */
export function FramePhotoVisibilityControl({
  organizationId,
  organizationName,
  enabled,
}: {
  organizationId: string;
  organizationName: string;
  enabled: boolean;
}) {
  const [state, formAction] = useFormState(setFramePhotoVisibilityAction, EMPTY_STATE);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (enabled) return;
    const confirmed = window.confirm(
      `Enable licensed frame photos for ${organizationName}?\nOnly continue if this organization has permission to display the catalog images.`
    );
    if (!confirmed) event.preventDefault();
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="w-full">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
      <FramePhotoSubmitButton enabled={enabled} />
      {state.error ? <p className="mt-1 text-right text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}

function FramePhotoSubmitButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={enabled ? "danger" : "secondary"}
      size="sm"
      disabled={pending}
      className="min-h-10 w-full whitespace-nowrap"
    >
      {pending ? "Saving..." : enabled ? "Hide frame photos" : "Show frame photos"}
    </Button>
  );
}

"use client";

import type { FormEvent } from "react";
import { setOrganizationStatusAction } from "@/app/platform-admin/actions";
import { Button } from "@/components/ui/button";
import { ORG_ACTION_LABELS } from "@/lib/platform/orgActionLabels";

/** Disable/Re-enable an organization. Disabling requires confirmation. */
export function OrgStatusButton({ id, status }: { id: string; status: "active" | "disabled" }) {
  const disabling = status === "active";

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (disabling && !window.confirm("Disable this organization? Its team loses access to LensWise immediately.")) {
      event.preventDefault();
    }
  }

  return (
    <form action={setOrganizationStatusAction} onSubmit={onSubmit} className="w-full">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={disabling ? "disabled" : "active"} />
      <Button
        type="submit"
        variant={disabling ? "secondary" : "primary"}
        size="sm"
        className="min-h-10 w-full whitespace-nowrap"
      >
        {disabling ? ORG_ACTION_LABELS.disableOrg : ORG_ACTION_LABELS.enableOrg}
      </Button>
    </form>
  );
}

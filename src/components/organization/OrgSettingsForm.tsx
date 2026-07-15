"use client";

import { useFormState, useFormStatus } from "react-dom";
import { updateOrganizationSettingsAction, type OrgSettingsState } from "@/app/(app)/organization/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

export function OrgSettingsForm({
  defaults,
}: {
  defaults: { officeName: string; contactEmail: string; contactPhone: string; contactAddress: string };
}) {
  const [state, formAction] = useFormState<OrgSettingsState, FormData>(updateOrganizationSettingsAction, {});

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      {state.ok ? <p className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">Saved.</p> : null}
      <div>
        <Label htmlFor="officeName">Office name</Label>
        <Input id="officeName" name="officeName" defaultValue={defaults.officeName} required />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="contactEmail">Contact email</Label>
          <Input id="contactEmail" name="contactEmail" type="email" defaultValue={defaults.contactEmail} />
        </div>
        <div>
          <Label htmlFor="contactPhone">Contact phone</Label>
          <Input id="contactPhone" name="contactPhone" defaultValue={defaults.contactPhone} />
        </div>
      </div>
      <div>
        <Label htmlFor="contactAddress">Address (shown on printouts)</Label>
        <Textarea id="contactAddress" name="contactAddress" rows={3} defaultValue={defaults.contactAddress} />
      </div>
      <SaveButton />
    </form>
  );
}

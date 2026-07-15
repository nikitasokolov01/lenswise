"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Copy, Check } from "lucide-react";
import { inviteMemberAction, type InviteState } from "@/app/(app)/team/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Inviting…" : "Send invitation"}
    </Button>
  );
}

/** Invite form. `canInviteAdmin` (Owner only) controls whether Admin is offered. */
export function InviteForm({ canInviteAdmin }: { canInviteAdmin: boolean }) {
  const [state, formAction] = useFormState<InviteState, FormData>(inviteMemberAction, {});
  const [copied, setCopied] = useState(false);
  const inviteLink =
    state.inviteToken && typeof window !== "undefined"
      ? `${window.location.origin}/accept-invite?token=${state.inviteToken}`
      : null;

  return (
    <div className="space-y-3">
      <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <div>
          <Label htmlFor="invite-email">Email</Label>
          <Input id="invite-email" name="email" type="email" required />
        </div>
        <div>
          <Label htmlFor="invite-role">Role</Label>
          <Select id="invite-role" name="role" defaultValue="staff">
            <option value="staff">Staff</option>
            {canInviteAdmin ? <option value="admin">Admin</option> : null}
          </Select>
        </div>
        <div>
          <Label htmlFor="invite-expires">Expires (days)</Label>
          <Input id="invite-expires" name="expiresInDays" type="number" min={0} max={90} defaultValue={14} />
        </div>
        <SubmitButton />
      </form>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      {inviteLink ? (
        <div className="rounded-md border border-teal-300 bg-teal-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-teal-800">
            Invitation created for {state.email} — share this link
          </p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 select-all break-all font-mono text-xs text-navy-900">{inviteLink}</code>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                navigator.clipboard?.writeText(inviteLink).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                })
              }
            >
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

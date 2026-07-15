"use client";

import type { FormEvent } from "react";
import { changeRoleAction, removeMemberAction } from "@/app/(app)/team/actions";
import { canAssignRole, type OrgRole } from "@/lib/auth/permissions";

const ALL_ROLES: OrgRole[] = ["owner", "admin", "staff"];
const ROLE_LABEL: Record<OrgRole, string> = { owner: "Owner", admin: "Admin", staff: "Staff" };

export function MemberRow({
  actorRole,
  actorUserId,
  member,
}: {
  actorRole: OrgRole | null;
  actorUserId: string;
  member: { userId: string; email: string | null; fullName: string | null; role: OrgRole };
}) {
  const targets = ALL_ROLES.filter((r) => r !== member.role && canAssignRole(actorRole, r));
  const isSelf = member.userId === actorUserId;

  function confirmRemove(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm(`Remove ${member.email ?? "this member"} from the organization?`)) {
      event.preventDefault();
    }
  }

  return (
    <tr className="border-b border-navy-50">
      <td className="py-2 pr-3">
        <div className="text-navy-800">{member.fullName || member.email || "—"}</div>
        {member.fullName ? <div className="text-xs text-navy-400">{member.email}</div> : null}
      </td>
      <td className="py-2 pr-3">{ROLE_LABEL[member.role]}</td>
      <td className="py-2">
        <div className="flex flex-wrap justify-end gap-1.5">
          {targets.map((r) => (
            <form action={changeRoleAction} key={r}>
              <input type="hidden" name="userId" value={member.userId} />
              <input type="hidden" name="role" value={r} />
              <button
                type="submit"
                className="rounded-md border border-navy-200 px-2 py-1 text-xs font-medium text-navy-700 hover:bg-navy-50"
              >
                {r === "owner" ? "Make owner" : `Make ${ROLE_LABEL[r]}`}
              </button>
            </form>
          ))}
          {!isSelf ? (
            <form action={removeMemberAction} onSubmit={confirmRemove}>
              <input type="hidden" name="userId" value={member.userId} />
              <button
                type="submit"
                className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Remove
              </button>
            </form>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

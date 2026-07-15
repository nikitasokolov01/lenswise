import { AcceptInviteClient } from "@/components/auth/AcceptInviteClient";

export const metadata = { title: "Accept invitation — LensWise" };

export default function AcceptInvitePage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token ?? "";
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-navy-900">Join your team on LensWise</h1>
      <p className="mb-5 text-sm text-navy-500">Accept your invitation to get started.</p>
      <AcceptInviteClient token={token} />
    </div>
  );
}

import { requireAuthContext } from "@/lib/auth/guards";
import { AccountNameForm, PasswordResetForm } from "@/components/account/AccountForm";

export const metadata = { title: "Account Settings — LensWise" };

const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin", staff: "Staff" };

export default async function AccountPage() {
  const ctx = await requireAuthContext();

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Account Settings</h1>
        <p className="mt-1 text-sm text-navy-500">Manage your name and password.</p>
      </div>

      <section className="rounded-lg border border-navy-100 bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold text-navy-900">Profile</h2>
        <AccountNameForm fullName={ctx.fullName ?? ""} />
        <dl className="mt-4 space-y-1.5 border-t border-navy-100 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-navy-500">Email</dt>
            <dd className="text-navy-800">{ctx.user.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-navy-500">Organization</dt>
            <dd className="text-navy-800">{ctx.organization?.name ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-navy-500">Role</dt>
            <dd className="text-navy-800">
              {ctx.role ? ROLE_LABEL[ctx.role] : "—"}
              {ctx.isSuperAdmin ? " · Super Admin" : ""}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-navy-100 bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold text-navy-900">Password</h2>
        <PasswordResetForm />
      </section>
    </div>
  );
}

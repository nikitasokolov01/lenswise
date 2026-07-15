import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata = { title: "Set a new password — LensWise" };

export default function ResetPasswordPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-navy-900">Set a new password</h1>
      <p className="mb-5 text-sm text-navy-500">Choose a new password for your LensWise account.</p>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}

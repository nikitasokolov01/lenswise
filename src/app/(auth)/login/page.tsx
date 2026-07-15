import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = { title: "Sign in — LensWise" };

export default function LoginPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-navy-900">Sign in</h1>
      <p className="mb-5 text-sm text-navy-500">Access your organization&apos;s LensWise.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}

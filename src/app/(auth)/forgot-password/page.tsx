import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata = { title: "Reset your password — LensWise" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-navy-900">Forgot your password?</h1>
      <p className="mb-5 text-sm text-navy-500">Enter your email and we&apos;ll send a reset link.</p>
      <ForgotPasswordForm />
    </div>
  );
}

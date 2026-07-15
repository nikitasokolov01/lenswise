import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata = { title: "Register your office — LensWise" };

export default function RegisterPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-navy-900">Register your office</h1>
      <p className="mb-5 text-sm text-navy-500">
        Registration is invitation-only. Enter the registration key provided by LensWise to create your organization.
      </p>
      <RegisterForm />
    </div>
  );
}

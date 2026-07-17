import { StartTrialForm } from "@/components/auth/StartTrialForm";

export const metadata = { title: "Start your free trial — LensWise" };

export default function StartTrialPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-navy-900">Start your free trial</h1>
      <p className="mb-5 text-sm text-navy-500">
        Create your LensWise account and start a 14-day free trial. No registration key required.
      </p>
      <StartTrialForm />
    </div>
  );
}

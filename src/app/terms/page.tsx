import Link from "next/link";

export const metadata = { title: "Terms of Service — LensWise" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
      <Link href="/" className="text-sm font-medium text-teal-700 hover:underline">
        ← Back to LensWise
      </Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-navy-900">Terms of Service</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-navy-600">
        <p>
          By creating a LensWise account you agree to use the service for lawful, in-office optical quoting. LensWise
          provides pricing and estimate tools; the prices and estimates you generate are your responsibility to review
          and confirm before presenting them to patients.
        </p>
        <p>
          LensWise is offered on a monthly subscription with a free trial. You may cancel at any time from Settings →
          Billing; cancellation stops future renewals. The free trial is available once per organization.
        </p>
        <p>
          The service is provided on an &ldquo;as is&rdquo; basis. We work to keep it reliable and accurate, but we do
          not warrant that it will be uninterrupted or error-free, and we are not liable for pricing decisions made
          using the tool.
        </p>
        <p>
          Questions about these terms? Contact{" "}
          <a href="mailto:support@lenswise.app" className="font-medium text-teal-700 hover:underline">
            support@lenswise.app
          </a>
          .
        </p>
      </div>
    </div>
  );
}

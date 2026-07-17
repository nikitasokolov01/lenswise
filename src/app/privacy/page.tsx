import Link from "next/link";

export const metadata = { title: "Privacy Policy — LensWise" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
      <Link href="/" className="text-sm font-medium text-teal-700 hover:underline">
        ← Back to LensWise
      </Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-navy-900">Privacy Policy</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-navy-600">
        <p>
          LensWise is an in-office optical quote tool. It is designed as an anonymous tool: it does not request or store
          patient names, dates of birth, prescriptions tied to an identity, insurance member IDs, or other personally
          identifying patient information. Please do not enter patient-identifying information into any field.
        </p>
        <p>
          We collect the information needed to operate your account: your practice name, owner name, and email address,
          plus your organization&apos;s pricing configuration. Payment and billing are handled by our payment processor,
          Stripe; we do not store card numbers.
        </p>
        <p>
          Your organization&apos;s data is isolated from other organizations and protected by database-level access
          controls. We use your information only to provide and improve the LensWise service.
        </p>
        <p>
          For privacy questions or requests, contact{" "}
          <a href="mailto:support@lenswise.app" className="font-medium text-teal-700 hover:underline">
            support@lenswise.app
          </a>
          .
        </p>
      </div>
    </div>
  );
}

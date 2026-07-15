import type { ReactNode } from "react";

/**
 * Layout for the unauthenticated pages (login / register / forgot / reset /
 * accept-invite). A calm, centered card in the LensWise palette — not a
 * generic SaaS landing. Works well on iPad; large touch targets throughout.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-4 py-10 pt-safe-top pb-safe-bottom">
      <div className="mb-6 text-center">
        <p className="text-2xl font-bold tracking-tight text-navy-900">LensWise</p>
        <p className="text-sm font-medium text-teal-700">Optical Quote Builder</p>
      </div>
      <div className="w-full max-w-md rounded-xl border border-navy-100 bg-white p-6 shadow-sm sm:p-8">
        {children}
      </div>
    </div>
  );
}

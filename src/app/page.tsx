import Link from "next/link";
import type { Metadata } from "next";
import {
  Glasses,
  Calculator,
  ShieldCheck,
  Layers,
  Palette,
  Monitor,
  Cloud,
  Lock,
  Check,
  ArrowRight,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LENSWISE_PLAN } from "@/lib/marketing/plan";
import { LandingThemeToggle } from "@/components/marketing/LandingThemeToggle";

export const metadata: Metadata = {
  title: "LensWise — Modern Quote Management for Optical Practices",
  description:
    "Generate accurate optical quotes in seconds with intelligent pricing, insurance support, prescription tools, and integrated billing.",
};

const FEATURES: { icon: typeof Glasses; title: string; description: string }[] = [
  { icon: Glasses, title: "Fast Quote Builder", description: "Configure frame, lenses, and add-ons and see an itemized price in seconds." },
  { icon: Calculator, title: "Intelligent Lens Pricing", description: "Consistent, rule-based pricing for lens types, materials, and coatings." },
  { icon: ShieldCheck, title: "Insurance Calculations", description: "Apply coverage, copays, and allowances with a clear breakdown." },
  { icon: Layers, title: "Progressive Lens Support", description: "Handle progressive designs and material compatibility automatically." },
  { icon: Palette, title: "Tint & Coating Management", description: "Configure tints, photochromics, blue light, and coatings per office." },
  { icon: Monitor, title: "Customer Display Mode", description: "Show a clean, patient-friendly estimate that hides internal details." },
  { icon: Cloud, title: "Secure Cloud Storage", description: "Your pricing syncs across every office device, backed by Supabase." },
  { icon: Lock, title: "Office PIN Protected Settings", description: "Protect pricing and settings on shared devices with an Office PIN." },
];

export default async function LandingPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user);

  return (
    <div className="scroll-smooth bg-paper text-navy-900">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-navy-100/70 bg-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-4 sm:px-8">
          <span className="text-lg font-bold tracking-tight">LensWise</span>
          <nav className="ml-2 hidden items-center gap-6 text-sm font-medium text-navy-500 md:flex">
            <a href="#features" className="hover:text-navy-900">Features</a>
            <a href="#pricing" className="hover:text-navy-900">Pricing</a>
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <LandingThemeToggle />
            {isAuthenticated ? (
              <Link href="/app" className="inline-flex h-10 items-center rounded-full bg-navy-900 px-5 text-sm font-semibold text-white hover:bg-navy-800">
                Open App
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden text-sm font-semibold text-navy-700 hover:text-navy-900 sm:inline">
                  Sign In
                </Link>
                <Link href="/start-trial" className="inline-flex h-10 items-center rounded-full bg-teal-600 px-5 text-sm font-semibold text-white hover:bg-teal-700">
                  Start Free Trial
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-5 pb-20 pt-20 text-center sm:px-8 sm:pt-28">
        <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-navy-900 sm:text-6xl">
          Modern Quote Management for Optical Practices.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-navy-500 sm:text-xl">
          Generate accurate optical quotes in seconds with intelligent pricing, insurance support, prescription tools,
          and integrated billing.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={isAuthenticated ? "/app" : "/start-trial"}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-teal-600 px-7 text-base font-semibold text-white hover:bg-teal-700 sm:w-auto"
          >
            {isAuthenticated ? "Open App" : "Start Free Trial"} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          {!isAuthenticated ? (
            <Link
              href="/login"
              className="inline-flex h-12 w-full items-center justify-center rounded-full border border-navy-200 bg-white px-7 text-base font-semibold text-navy-800 hover:bg-navy-50 sm:w-auto"
            >
              Sign In
            </Link>
          ) : null}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Everything an optical office needs</h2>
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-2xl border border-navy-100 bg-white p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-navy-900">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-navy-500">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why LensWise */}
      <section className="mx-auto max-w-3xl px-5 py-16 text-center sm:px-8">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Why LensWise</h2>
        <p className="mx-auto mt-5 text-lg leading-relaxed text-navy-500">
          LensWise eliminates manual, error-prone calculations and keeps pricing consistent across everyone in the
          office. Set your prices once, and every quote — on every device — reflects the same approved numbers, so your
          team can focus on patients instead of spreadsheets.
        </p>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Simple, transparent pricing</h2>
        <div className="mx-auto mt-12 max-w-md rounded-3xl border border-navy-100 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">{LENSWISE_PLAN.name}</p>
          <p className="mt-3 flex items-baseline gap-1">
            <span className="text-5xl font-bold tracking-tight text-navy-900">{LENSWISE_PLAN.price}</span>
            <span className="text-lg text-navy-400">{LENSWISE_PLAN.period}</span>
          </p>
          <ul className="mt-7 space-y-3">
            {LENSWISE_PLAN.features.map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-sm text-navy-700">
                <Check className="h-4 w-4 shrink-0 text-teal-600" aria-hidden="true" />
                {feature}
              </li>
            ))}
          </ul>
          <Link
            href={isAuthenticated ? "/app" : "/start-trial"}
            className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-full bg-teal-600 px-6 text-base font-semibold text-white hover:bg-teal-700"
          >
            {isAuthenticated ? "Open App" : "Start Free Trial"}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-navy-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-10 text-sm text-navy-500 sm:flex-row sm:px-8">
          <span className="font-semibold text-navy-700">LensWise</span>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <Link href="/privacy" className="hover:text-navy-900">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-navy-900">Terms</Link>
            <a href="mailto:support@lenswise.app" className="hover:text-navy-900">Contact</a>
            <Link href="/login" className="hover:text-navy-900">Sign In</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

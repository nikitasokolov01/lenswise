import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LandingPreview } from "@/app/landing-preview/LandingPreview";

export const metadata: Metadata = {
  title: {
    absolute: "LensWise — Optical Quote Builder for Optical Practices",
  },
  description:
    "Create accurate optical quotes, manage frame inventory, track sales, and run multiple office locations from one LensWise workspace.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "LensWise",
    title: "LensWise — Optical Quote Builder for Optical Practices",
    description:
      "Create accurate optical quotes, manage frame inventory, track sales, and run multiple office locations from one LensWise workspace.",
  },
};

const WEBSITE_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "LensWise",
  alternateName: "Lens Wise",
  url: "https://www.uselenswise.com/",
} as const;

export default async function LandingPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(WEBSITE_STRUCTURED_DATA).replace(/</g, "\\u003c"),
        }}
      />
      <LandingPreview isAuthenticated={Boolean(user)} />
    </>
  );
}

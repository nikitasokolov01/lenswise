import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LandingPreview } from "./LandingPreview";

export const metadata: Metadata = {
  title: "LensWise — The Optical Office, In Focus",
  description:
    "A preview of the next LensWise landing page: optical quoting, frame inventory, catalog access, and multi-location control in one workspace.",
};

export default async function LandingPreviewPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <LandingPreview isAuthenticated={Boolean(user)} />;
}

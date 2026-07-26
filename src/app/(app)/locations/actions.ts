"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveOrg } from "@/lib/auth/guards";
import { ACTIVE_LOCATION_COOKIE } from "@/lib/locations/context";
import { safeLocationReturnPath } from "@/lib/locations/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const locationIdSchema = z.string().uuid();

export async function setActiveLocationAction(formData: FormData): Promise<void> {
  const ctx = await requireActiveOrg();
  const locationId = locationIdSchema.safeParse(formData.get("locationId"));
  const returnTo = safeLocationReturnPath(formData.get("returnTo"));

  if (!locationId.success) {
    redirect(returnTo);
  }

  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("organization_locations")
    .select("id")
    .eq("id", locationId.data)
    .eq("organization_id", ctx.organization.id)
    .eq("is_active", true)
    .maybeSingle();

  if (data) {
    cookies().set(ACTIVE_LOCATION_COOKIE, data.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  redirect(returnTo);
}

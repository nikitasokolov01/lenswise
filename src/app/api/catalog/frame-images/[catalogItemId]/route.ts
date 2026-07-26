import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth/context";
import { isBillingBlocked } from "@/lib/billing/status";
import { FRAME_CATALOG_IMAGE_BUCKET } from "@/lib/catalog/imageHosting";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const catalogItemIdSchema = z.string().uuid();
const SIGNED_URL_SECONDS = 15 * 60;
const REDIRECT_CACHE_SECONDS = 5 * 60;

function privateRedirect(url: string) {
  const response = NextResponse.redirect(url, 307);
  response.headers.set(
    "Cache-Control",
    `private, max-age=${REDIRECT_CACHE_SECONDS}, stale-while-revalidate=60`
  );
  response.headers.set("Vary", "Cookie");
  return response;
}

function validFramesDataSource(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname.toLowerCase() === "www.framesdata.com"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: { catalogItemId: string } }
) {
  const parsedId = catalogItemIdSchema.safeParse(context.params.catalogItemId);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid catalog image." }, { status: 400 });
  }

  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (
    !auth.isSuperAdmin &&
    (!auth.organization ||
      auth.organization.status !== "active" ||
      isBillingBlocked(auth.billing))
  ) {
    return NextResponse.json({ error: "Catalog image access is unavailable." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!auth.isSuperAdmin && auth.organization) {
    const { data: connection } = await admin
      .from("organization_catalog_connections")
      .select("id")
      .eq("organization_id", auth.organization.id)
      .eq("provider", "frames_data")
      .eq("status", "active")
      .maybeSingle();

    if (!connection) {
      return NextResponse.json({ error: "Catalog image access is unavailable." }, { status: 403 });
    }
  }

  const { data: item, error } = await admin
    .from("frame_catalog_items")
    .select("hosted_image_path,source_image_url,image_url")
    .eq("id", parsedId.data)
    .eq("provider", "frames_data")
    .eq("is_active", true)
    .maybeSingle();

  if (error || !item) {
    return NextResponse.json({ error: "Catalog image not found." }, { status: 404 });
  }

  if (item.hosted_image_path) {
    const { data: signed, error: signedError } = await admin.storage
      .from(FRAME_CATALOG_IMAGE_BUCKET)
      .createSignedUrl(item.hosted_image_path, SIGNED_URL_SECONDS);

    if (!signedError && signed?.signedUrl) {
      return privateRedirect(signed.signedUrl);
    }
  }

  const sourceUrl = validFramesDataSource(
    item.source_image_url ?? item.image_url
  );
  if (sourceUrl && !/\/imgnotavail(?:_|\.|\/)/i.test(sourceUrl)) {
    return privateRedirect(sourceUrl);
  }

  return NextResponse.json({ error: "Catalog image unavailable." }, { status: 404 });
}

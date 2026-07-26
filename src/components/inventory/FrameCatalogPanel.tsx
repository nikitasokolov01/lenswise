import { FrameCatalogPicker } from "@/components/inventory/FrameCatalogPicker";
import {
  frameCatalogOptionFromRow,
  type FrameCatalogRow,
} from "@/lib/catalog/options";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const CATALOG_PAGE_SIZE = 1000;

export async function FrameCatalogPanel({
  organizationId,
  existingCatalogRecordIds,
}: {
  organizationId: string;
  existingCatalogRecordIds: string[];
}) {
  const supabase = createSupabaseServerClient();
  const connectionResult = await supabase
    .from("organization_catalog_connections")
    .select("status")
    .eq("organization_id", organizationId)
    .eq("provider", "frames_data")
    .maybeSingle();

  if (connectionResult.error) {
    return (
      <FrameCatalogPicker
        frames={[]}
        status="error"
        loadError="Frames Data catalog access could not be verified."
      />
    );
  }

  if (connectionResult.data?.status !== "active") {
    return <FrameCatalogPicker frames={[]} status="not_connected" loadError={null} />;
  }

  const catalogRows: FrameCatalogRow[] = [];

  for (let offset = 0; ; offset += CATALOG_PAGE_SIZE) {
    const result = await supabase
      .from("frame_catalog_items")
      .select(
        "id,provider,manufacturer,brand,model,color_name,color_code,eye_size_mm,bridge_size_mm,temple_length_mm,material,shape,frame_type,rim_type,suggested_retail_price_cents,image_url,source_image_url,hosted_image_path"
      )
      .eq("provider", "frames_data")
      .eq("is_active", true)
      .order("brand")
      .order("model")
      .order("color_name")
      .order("id")
      .range(offset, offset + CATALOG_PAGE_SIZE - 1);

    if (result.error) {
      return (
        <FrameCatalogPicker
          frames={[]}
          status="error"
          loadError="The licensed frame catalog could not be loaded. Please try again."
        />
      );
    }

    const pageRows = (result.data ?? []) as FrameCatalogRow[];
    catalogRows.push(...pageRows);
    if (pageRows.length < CATALOG_PAGE_SIZE) break;
  }

  const existingIds = new Set(existingCatalogRecordIds);
  const catalogFrames = catalogRows.map((row) =>
    frameCatalogOptionFromRow(row, existingIds)
  );

  return <FrameCatalogPicker frames={catalogFrames} status="active" loadError={null} />;
}

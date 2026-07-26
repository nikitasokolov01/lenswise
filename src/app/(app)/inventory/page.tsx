import { Suspense } from "react";
import { FrameCatalogLoading } from "@/components/inventory/FrameCatalogLoading";
import { FrameCatalogPanel } from "@/components/inventory/FrameCatalogPanel";
import { FrameInventoryManager } from "@/components/inventory/FrameInventoryManager";
import { requireBilledOrg } from "@/lib/auth/guards";
import { isOwnerOrAdmin } from "@/lib/auth/permissions";
import { frameInventoryFromRow, type FrameInventoryRow } from "@/lib/inventory/types";
import { requireActiveOrganizationLocation } from "@/lib/locations/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Frame Inventory — LensWise" };

export default async function FrameInventoryPage() {
  const ctx = await requireBilledOrg();
  const activeLocation = await requireActiveOrganizationLocation(ctx.organization.id);
  const supabase = createSupabaseServerClient();
  const canManage = isOwnerOrAdmin(ctx.role);
  const { data, error } = await supabase
    .from("frame_inventory")
    .select(
      "id,organization_id,location_id,brand,model,color,eye_size_mm,bridge_size_mm,temple_length_mm,sku,upc,wholesale_cost_cents,retail_price_cents,quantity_on_hand,reorder_level,notes,is_active,image_url,catalog_source,catalog_item_id,catalog_record_id,created_at,updated_at"
    )
    .eq("organization_id", ctx.organization.id)
    .eq("location_id", activeLocation.id)
    .order("is_active", { ascending: false })
    .order("brand")
    .order("model");

  const frames = error
    ? []
    : ((data ?? []) as FrameInventoryRow[]).map(frameInventoryFromRow);
  const existingCatalogRecordIds = frames
    .map((frame) => frame.catalogRecordId)
    .filter((id): id is string => Boolean(id));

  return (
    <FrameInventoryManager
      frames={frames}
      locationName={activeLocation.name}
      catalogPanel={
        canManage ? (
          <Suspense fallback={<FrameCatalogLoading />}>
            <FrameCatalogPanel
              organizationId={ctx.organization.id}
              existingCatalogRecordIds={existingCatalogRecordIds}
            />
          </Suspense>
        ) : null
      }
      canManage={canManage}
      loadError={
        error
          ? "Frame inventory could not be loaded. Confirm the inventory migration is applied."
          : null
      }
    />
  );
}

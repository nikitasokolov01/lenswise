import { requireBilledOrg } from "@/lib/auth/guards";
import { QuoteBuilder } from "@/components/quote/QuoteBuilder";
import { PricingImportPrompt } from "@/components/pricing/PricingImportPrompt";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  quoteFrameInventoryOptionFromRow,
  type QuoteFrameInventoryRow,
} from "@/lib/inventory/types";
import { requireActiveOrganizationLocation } from "@/lib/locations/context";

/**
 * The authenticated application home: the Quote Builder. The public marketing
 * landing page now lives at `/`; the app moved here to `/app`.
 */
export default async function AppHomePage() {
  const ctx = await requireBilledOrg();
  const activeLocation = await requireActiveOrganizationLocation(ctx.organization.id);
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("frame_inventory")
    .select(
      "id,brand,model,color,image_url,eye_size_mm,bridge_size_mm,temple_length_mm,sku,upc,retail_price_cents,quantity_on_hand"
    )
    .eq("organization_id", ctx.organization.id)
    .eq("location_id", activeLocation.id)
    .eq("is_active", true)
    .order("brand")
    .order("model");

  const frameInventory = error
    ? []
    : ((data ?? []) as QuoteFrameInventoryRow[]).map(quoteFrameInventoryOptionFromRow);

  return (
    <>
      <PricingImportPrompt role={ctx.role} />
      <QuoteBuilder
        activeLocation={activeLocation}
        frameInventory={frameInventory}
        frameInventoryLoadError={
          error ? "Your frame inventory could not be loaded. You can still enter a frame manually." : null
        }
      />
    </>
  );
}

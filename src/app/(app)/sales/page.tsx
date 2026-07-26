import { SalesHistory } from "@/components/sales/SalesHistory";
import { requireBilledOrg } from "@/lib/auth/guards";
import { isOwnerOrAdmin } from "@/lib/auth/permissions";
import { requireActiveOrganizationLocation } from "@/lib/locations/context";
import type { SaleHistoryRow } from "@/lib/sales/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface SaleDatabaseRow {
  id: string;
  organization_id: string;
  location_id: string;
  status: SaleHistoryRow["status"];
  order_type: SaleHistoryRow["orderType"];
  patient_responsibility_cents: number;
  payment_method: SaleHistoryRow["paymentMethod"];
  card_brand: SaleHistoryRow["cardBrand"];
  external_reference: string | null;
  note: string | null;
  frame_inventory_id: string | null;
  frame_name: string | null;
  frame_color: string | null;
  frame_size: string | null;
  frame_sku: string | null;
  frame_image_url: string | null;
  sold_by: string | null;
  sold_at: string;
  voided_at: string | null;
  returned_at: string | null;
  reversal_reason: string | null;
}

export default async function SalesPage() {
  const ctx = await requireBilledOrg();
  const activeLocation = await requireActiveOrganizationLocation(ctx.organization.id);
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sales")
    .select(
      "id,organization_id,location_id,status,order_type,patient_responsibility_cents,payment_method,card_brand,external_reference,note,frame_inventory_id,frame_name,frame_color,frame_size,frame_sku,frame_image_url,sold_by,sold_at,voided_at,returned_at,reversal_reason"
    )
    .eq("organization_id", ctx.organization.id)
    .eq("location_id", activeLocation.id)
    .order("sold_at", { ascending: false })
    .limit(250);

  const databaseRows = (data ?? []) as SaleDatabaseRow[];
  const actorIds = Array.from(
    new Set(databaseRows.map((sale) => sale.sold_by).filter((id): id is string => Boolean(id)))
  );
  const actorNames = new Map<string, string>();

  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,full_name,email")
      .in("id", actorIds);
    for (const profile of profiles ?? []) {
      actorNames.set(profile.id, profile.full_name || profile.email || "Team member");
    }
  }

  const sales: SaleHistoryRow[] = databaseRows.map((sale) => ({
    id: sale.id,
    organizationId: sale.organization_id,
    locationId: sale.location_id,
    status: sale.status,
    orderType: sale.order_type,
    patientResponsibilityCents: sale.patient_responsibility_cents,
    paymentMethod: sale.payment_method,
    cardBrand: sale.card_brand,
    externalReference: sale.external_reference,
    note: sale.note,
    frameInventoryId: sale.frame_inventory_id,
    frameName: sale.frame_name,
    frameColor: sale.frame_color,
    frameSize: sale.frame_size,
    frameSku: sale.frame_sku,
    frameImageUrl: sale.frame_image_url,
    soldBy: sale.sold_by,
    soldByName: sale.sold_by ? actorNames.get(sale.sold_by) ?? "Team member" : "Former team member",
    soldAt: sale.sold_at,
    voidedAt: sale.voided_at,
    returnedAt: sale.returned_at,
    reversalReason: sale.reversal_reason,
  }));

  return (
    <SalesHistory
      locationName={activeLocation.name}
      sales={sales}
      canReverse={isOwnerOrAdmin(ctx.role) || ctx.isSuperAdmin}
      loadError={error ? "Sales history could not be loaded. Please refresh and try again." : null}
    />
  );
}


"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireArea } from "@/lib/auth/guards";
import { frameCatalogImageUrl } from "@/lib/catalog/imageHosting";
import { frameInventoryValuesFromFormData } from "@/lib/inventory/validation";
import { requireActiveOrganizationLocation } from "@/lib/locations/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface FrameInventoryActionState {
  ok?: boolean;
  message?: string;
  error?: string;
}

const idSchema = z.string().uuid();
const stockSchema = z.coerce.number().int().min(0).max(99999);
const catalogInventoryBatchSchema = z.object({
  catalogRecordIds: z
    .array(z.string().uuid())
    .min(1, "Select at least one frame.")
    .max(100, "Add up to 100 frames at a time."),
});

function validationMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the frame details and try again.";
}

function databaseMessage(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "That SKU is already used by another frame in this inventory.";
  return "The frame could not be saved. Please try again.";
}

export async function createFrameInventoryAction(
  _previous: FrameInventoryActionState,
  formData: FormData
): Promise<FrameInventoryActionState> {
  const ctx = await requireArea("inventory_manage");
  const parsed = frameInventoryValuesFromFormData(formData);
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  const activeLocation = await requireActiveOrganizationLocation(ctx.organization.id);
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("frame_inventory").insert({
    organization_id: ctx.organization.id,
    location_id: activeLocation.id,
    ...parsed.data,
    created_by: ctx.user.id,
    updated_by: ctx.user.id,
  });

  if (error) return { error: databaseMessage(error) };
  revalidatePath("/inventory");
  return { ok: true, message: `${parsed.data.brand} ${parsed.data.model} was added to inventory.` };
}

/**
 * Promotes selected licensed catalog variants into an organization's inventory.
 * Catalog RLS ensures the office has an active provider connection; product
 * facts are copied once so later vendor refreshes never change local stock or
 * retail pricing.
 */
export async function addCatalogFramesToInventoryAction(
  _previous: FrameInventoryActionState,
  formData: FormData
): Promise<FrameInventoryActionState> {
  const ctx = await requireArea("inventory_manage");
  const requestedIds = Array.from(
    new Set(
      formData
        .getAll("catalogRecordIds")
        .filter((value): value is string => typeof value === "string")
    )
  );
  const parsed = catalogInventoryBatchSchema.safeParse({
    catalogRecordIds: requestedIds,
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  const activeLocation = await requireActiveOrganizationLocation(ctx.organization.id);
  const supabase = createSupabaseServerClient();
  const { data: existingItems, error: existingError } = await supabase
    .from("frame_inventory")
    .select("catalog_record_id")
    .eq("organization_id", ctx.organization.id)
    .eq("location_id", activeLocation.id)
    .in("catalog_record_id", parsed.data.catalogRecordIds);

  if (existingError) {
    return { error: "Existing inventory could not be checked. Please try again." };
  }

  const existingIds = new Set(
    (existingItems ?? [])
      .map((item) => item.catalog_record_id)
      .filter((id): id is string => Boolean(id))
  );
  const availableIds = parsed.data.catalogRecordIds.filter((id) => !existingIds.has(id));

  if (availableIds.length === 0) {
    return { error: "All selected frames are already in this office's inventory." };
  }

  const { data: catalogItems, error: catalogError } = await supabase
    .from("frame_catalog_items")
    .select(
      "id,provider,provider_item_id,brand,model,color_name,color_code,eye_size_mm,bridge_size_mm,temple_length_mm,sku,upc,wholesale_price_cents,suggested_retail_price_cents,image_url,source_image_url,hosted_image_path"
    )
    .in("id", availableIds)
    .eq("is_active", true)
    .order("brand")
    .order("model");

  if (catalogError || !catalogItems) {
    return { error: "The selected catalog frames are unavailable or your catalog access is not active." };
  }

  const rows = catalogItems.map((catalogItem) => ({
    organization_id: ctx.organization.id,
    location_id: activeLocation.id,
    brand: catalogItem.brand,
    model: catalogItem.model,
    color: catalogItem.color_name ?? catalogItem.color_code ?? "",
    eye_size_mm: catalogItem.eye_size_mm,
    bridge_size_mm: catalogItem.bridge_size_mm,
    temple_length_mm: catalogItem.temple_length_mm,
    sku: catalogItem.sku,
    upc: catalogItem.upc,
    wholesale_cost_cents: catalogItem.wholesale_price_cents ?? 0,
    retail_price_cents: catalogItem.suggested_retail_price_cents ?? 0,
    quantity_on_hand: 1,
    reorder_level: 1,
    image_url:
      catalogItem.hosted_image_path ||
      catalogItem.source_image_url ||
      catalogItem.image_url
        ? frameCatalogImageUrl(catalogItem.id)
        : null,
    catalog_source: catalogItem.provider,
    catalog_item_id: catalogItem.provider_item_id,
    catalog_record_id: catalogItem.id,
    created_by: ctx.user.id,
    updated_by: ctx.user.id,
  }));

  if (rows.length === 0) {
    return { error: "None of the selected frames are currently available." };
  }

  const { error } = await supabase.from("frame_inventory").insert(rows);

  if (error?.code === "23505") {
    return { error: "One of those frames is already in this office's inventory. Refresh and try again." };
  }
  if (error) return { error: databaseMessage(error) };

  const skipped = parsed.data.catalogRecordIds.length - rows.length;
  revalidatePath("/inventory");
  return {
    ok: true,
    message: `${rows.length} ${rows.length === 1 ? "frame was" : "frames were"} added${
      skipped > 0 ? `; ${skipped} unavailable or existing ${skipped === 1 ? "frame was" : "frames were"} skipped` : ""
    }. Edit office pricing, quantity, and low-stock alerts below.`,
  };
}

export async function updateFrameInventoryAction(
  _previous: FrameInventoryActionState,
  formData: FormData
): Promise<FrameInventoryActionState> {
  const ctx = await requireArea("inventory_manage");
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: "Invalid frame record." };

  const parsed = frameInventoryValuesFromFormData(formData);
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  const activeLocation = await requireActiveOrganizationLocation(ctx.organization.id);
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("frame_inventory")
    .update({ ...parsed.data, updated_by: ctx.user.id })
    .eq("id", id.data)
    .eq("organization_id", ctx.organization.id)
    .eq("location_id", activeLocation.id);

  if (error) return { error: databaseMessage(error) };
  revalidatePath("/inventory");
  return { ok: true, message: "Frame details updated." };
}

export async function setFrameStockAction(
  _previous: FrameInventoryActionState,
  formData: FormData
): Promise<FrameInventoryActionState> {
  const ctx = await requireArea("inventory_manage");
  const id = idSchema.safeParse(formData.get("id"));
  const quantity = stockSchema.safeParse(formData.get("quantity"));
  if (!id.success || !quantity.success) return { error: "Invalid stock adjustment." };

  const activeLocation = await requireActiveOrganizationLocation(ctx.organization.id);
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("frame_inventory")
    .update({ quantity_on_hand: quantity.data, updated_by: ctx.user.id })
    .eq("id", id.data)
    .eq("organization_id", ctx.organization.id)
    .eq("location_id", activeLocation.id);

  if (error) return { error: "Stock could not be updated. Please try again." };
  revalidatePath("/inventory");
  return { ok: true };
}

export async function setFrameActiveAction(
  _previous: FrameInventoryActionState,
  formData: FormData
): Promise<FrameInventoryActionState> {
  const ctx = await requireArea("inventory_manage");
  const id = idSchema.safeParse(formData.get("id"));
  const isActive = z.enum(["true", "false"]).safeParse(formData.get("isActive"));
  if (!id.success || !isActive.success) return { error: "Invalid frame record." };

  const active = isActive.data === "true";
  const activeLocation = await requireActiveOrganizationLocation(ctx.organization.id);
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("frame_inventory")
    .update({ is_active: active, updated_by: ctx.user.id })
    .eq("id", id.data)
    .eq("organization_id", ctx.organization.id)
    .eq("location_id", activeLocation.id);

  if (error) return { error: "The frame status could not be changed. Please try again." };
  revalidatePath("/inventory");
  return { ok: true, message: active ? "Frame restored." : "Frame archived." };
}

export async function deleteFrameInventoryAction(
  _previous: FrameInventoryActionState,
  formData: FormData
): Promise<FrameInventoryActionState> {
  const ctx = await requireArea("inventory_manage");
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: "Invalid frame record." };

  const activeLocation = await requireActiveOrganizationLocation(ctx.organization.id);
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("frame_inventory")
    .delete()
    .eq("id", id.data)
    .eq("organization_id", ctx.organization.id)
    .eq("location_id", activeLocation.id)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23503") {
      return {
        error:
          "This frame has sales history and cannot be permanently deleted. Archive it instead.",
      };
    }
    return { error: "The frame could not be deleted. Please try again." };
  }
  if (!data) {
    return { error: "That frame is no longer in this office's inventory." };
  }

  revalidatePath("/inventory");
  return { ok: true, message: "Frame permanently deleted." };
}

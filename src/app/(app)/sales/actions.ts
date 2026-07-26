"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireArea, requireBilledOrg } from "@/lib/auth/guards";
import { requireActiveOrganizationLocation } from "@/lib/locations/context";
import type {
  CompletedSale,
  SaleCardBrand,
  SalePaymentMethod,
  SaleStatus,
} from "@/lib/sales/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface CompleteSaleActionState {
  sale?: CompletedSale;
  error?: string;
}

export interface ReverseSaleActionState {
  ok?: boolean;
  message?: string;
  error?: string;
}

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : ""),
    z.string().max(max)
  );

const optionalUuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  z.string().uuid().nullable()
);

const completeSaleSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    frameInventoryId: optionalUuid,
    orderType: z.enum(["complete_pair", "lens_only", "frame_only"]),
    patientResponsibilityCents: z.coerce.number().int().min(0).max(100000000),
    paymentMethod: z.enum(["cash", "card"]),
    cardBrand: z.preprocess(
      (value) => (typeof value === "string" && value ? value : null),
      z.enum(["visa", "mastercard", "amex", "discover"]).nullable()
    ),
    externalReference: optionalText(120),
    note: optionalText(1000),
    manualFrameName: optionalText(240),
    manualFrameColor: optionalText(160),
    manualFrameSize: optionalText(80),
    manualFrameSku: optionalText(120),
    manualFrameImageUrl: optionalText(2000),
    paymentConfirmed: z.literal("confirmed"),
  })
  .superRefine((value, context) => {
    if (value.paymentMethod === "card" && !value.cardBrand) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cardBrand"],
        message: "Choose the card brand.",
      });
    }
  });

const reverseSaleSchema = z.object({
  saleId: z.string().uuid(),
  outcome: z.enum(["voided", "returned"]),
  reason: z.string().trim().min(3, "Enter a short reason.").max(500),
});

function knownDatabaseMessage(message: string): string {
  const knownMessages = [
    "You must be signed in",
    "The active office location is unavailable",
    "The order type is invalid",
    "The sale total is invalid",
    "Choose Cash or Card",
    "Choose the card brand",
    "Cash payments cannot include",
    "That inventory frame is no longer available",
    "This frame is out of stock",
    "Only an owner or admin",
    "That sale could not be found",
    "This sale has already been reversed",
    "The linked inventory frame is unavailable",
  ];
  return knownMessages.some((known) => message.includes(known))
    ? message
    : "The sale could not be saved. Please try again.";
}

export async function completeSaleAction(
  _previous: CompleteSaleActionState,
  formData: FormData
): Promise<CompleteSaleActionState> {
  const ctx = await requireBilledOrg();
  const parsed = completeSaleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the payment details and try again." };
  }

  const activeLocation = await requireActiveOrganizationLocation(ctx.organization.id);
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("complete_external_sale", {
    p_location_id: activeLocation.id,
    p_frame_inventory_id: parsed.data.frameInventoryId,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_order_type: parsed.data.orderType,
    p_patient_responsibility_cents: parsed.data.patientResponsibilityCents,
    p_payment_method: parsed.data.paymentMethod,
    p_card_brand: parsed.data.paymentMethod === "card" ? parsed.data.cardBrand : null,
    p_external_reference: parsed.data.externalReference,
    p_note: parsed.data.note,
    p_manual_frame_name: parsed.data.manualFrameName,
    p_manual_frame_color: parsed.data.manualFrameColor,
    p_manual_frame_size: parsed.data.manualFrameSize,
    p_manual_frame_sku: parsed.data.manualFrameSku,
    p_manual_frame_image_url: parsed.data.manualFrameImageUrl,
  });

  if (error) return { error: knownDatabaseMessage(error.message) };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.sale_id) return { error: "The sale could not be confirmed. Please try again." };

  revalidatePath("/app");
  revalidatePath("/inventory");
  revalidatePath("/sales");

  return {
    sale: {
      id: row.sale_id,
      status: row.sale_status as SaleStatus,
      paymentMethod: parsed.data.paymentMethod as SalePaymentMethod,
      cardBrand:
        parsed.data.paymentMethod === "card"
          ? (parsed.data.cardBrand as SaleCardBrand)
          : null,
      externalReference: parsed.data.externalReference,
      note: parsed.data.note,
      completedAt: row.completed_at,
      quantityAfter: row.quantity_after ?? null,
      alreadyCompleted: Boolean(row.already_completed),
    },
  };
}

export async function reverseSaleAction(
  _previous: ReverseSaleActionState,
  formData: FormData
): Promise<ReverseSaleActionState> {
  const ctx = await requireArea("inventory_manage");
  const parsed = reverseSaleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the sale details and try again." };
  }

  const activeLocation = await requireActiveOrganizationLocation(ctx.organization.id);
  const supabase = createSupabaseServerClient();
  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .select("id")
    .eq("id", parsed.data.saleId)
    .eq("organization_id", ctx.organization.id)
    .eq("location_id", activeLocation.id)
    .maybeSingle();

  if (saleError || !sale) {
    return { error: "That sale is not available at the active location." };
  }

  const { error } = await supabase.rpc("reverse_external_sale", {
    p_sale_id: parsed.data.saleId,
    p_outcome: parsed.data.outcome,
    p_reason: parsed.data.reason,
  });
  if (error) return { error: knownDatabaseMessage(error.message) };

  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/app");
  return {
    ok: true,
    message:
      parsed.data.outcome === "voided"
        ? "Sale voided and frame stock restored."
        : "Return recorded and frame stock restored.",
  };
}


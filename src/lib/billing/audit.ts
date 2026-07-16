import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Billing audit actions recorded in the existing audit_log. We NEVER store card
 * numbers, payment-method details, Stripe secret keys, webhook signatures, or
 * raw webhook payloads — only high-level event metadata (ids, status).
 */
export type BillingAuditAction =
  | "billing.customer_created"
  | "billing.checkout_created"
  | "billing.subscription_activated"
  | "billing.subscription_updated"
  | "billing.subscription_canceled"
  | "billing.payment_failed";

/**
 * Write a billing audit entry via the SECURITY DEFINER write_audit function.
 * Requires a service-role client (granted execute in the billing migration).
 * Best-effort: an audit failure never blocks a billing operation.
 */
export async function writeBillingAudit(
  admin: SupabaseClient,
  params: {
    organizationId: string | null;
    actorId: string | null;
    action: BillingAuditAction;
    targetType: string;
    targetId: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await admin.rpc("write_audit", {
      p_org: params.organizationId,
      p_actor: params.actorId,
      p_action: params.action,
      p_target_type: params.targetType,
      p_target_id: params.targetId,
      p_metadata: params.metadata ?? {},
    });
  } catch {
    /* audit is best-effort; do not surface or block on failures. */
  }
}

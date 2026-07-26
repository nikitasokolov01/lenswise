import type { OrderType } from "@/lib/types";

export type SalePaymentMethod = "cash" | "card";
export type SaleCardBrand = "visa" | "mastercard" | "amex" | "discover";
export type SaleStatus = "completed" | "voided" | "returned";
export type SaleReversalOutcome = "voided" | "returned";

export interface CompletedSale {
  id: string;
  status: SaleStatus;
  paymentMethod: SalePaymentMethod;
  cardBrand: SaleCardBrand | null;
  externalReference: string;
  note: string;
  completedAt: string;
  quantityAfter: number | null;
  alreadyCompleted: boolean;
}

export interface SaleHistoryRow {
  id: string;
  organizationId: string;
  locationId: string;
  status: SaleStatus;
  orderType: OrderType;
  patientResponsibilityCents: number;
  paymentMethod: SalePaymentMethod;
  cardBrand: SaleCardBrand | null;
  externalReference: string | null;
  note: string | null;
  frameInventoryId: string | null;
  frameName: string | null;
  frameColor: string | null;
  frameSize: string | null;
  frameSku: string | null;
  frameImageUrl: string | null;
  soldBy: string | null;
  soldByName: string | null;
  soldAt: string;
  voidedAt: string | null;
  returnedAt: string | null;
  reversalReason: string | null;
}

export function formatCardBrand(cardBrand: SaleCardBrand | null): string {
  switch (cardBrand) {
    case "visa":
      return "Visa";
    case "mastercard":
      return "Mastercard";
    case "amex":
      return "American Express";
    case "discover":
      return "Discover";
    default:
      return "";
  }
}

export function formatSalePayment(
  paymentMethod: SalePaymentMethod,
  cardBrand: SaleCardBrand | null
): string {
  return paymentMethod === "cash" ? "Cash" : `${formatCardBrand(cardBrand)} card`;
}


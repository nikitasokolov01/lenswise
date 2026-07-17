/**
 * Single source of truth for the public-facing plan shown on the landing page.
 * Changing the plan name, displayed price, or feature list here updates every
 * marketing surface. (The billable Stripe price itself is configured separately
 * via STRIPE_PRICE_ID — this is display copy only.)
 */
export interface MarketingPlan {
  name: string;
  price: string;
  period: string;
  features: string[];
}

export const LENSWISE_PLAN: MarketingPlan = {
  name: "Professional",
  price: "$49",
  period: "/month",
  features: [
    "Unlimited Quotes",
    "Cloud Sync",
    "Office PIN",
    "Customer Display",
    "Automatic Updates",
    "Free Trial",
  ],
};

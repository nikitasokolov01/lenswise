/**
 * Pure builder for the Stripe onboarding metadata. No secrets / no Stripe SDK,
 * so it is unit-testable. These values ride along on the Checkout Session and
 * Stripe customer, and the webhook treats them as the source of truth for
 * creating the organization after Checkout completes.
 */

export interface OnboardingInput {
  userId: string;
  email: string;
  practiceName: string;
  ownerName: string;
}

export function buildOnboardingMetadata(input: OnboardingInput): Record<string, string> {
  return {
    owner_user_id: input.userId,
    organization_name: input.practiceName,
    owner_name: input.ownerName,
    owner_email: input.email,
  };
}

import { requireBilledOrg } from "@/lib/auth/guards";
import { QuoteBuilder } from "@/components/quote/QuoteBuilder";
import { PricingImportPrompt } from "@/components/pricing/PricingImportPrompt";

/**
 * The authenticated application home: the Quote Builder. The public marketing
 * landing page now lives at `/`; the app moved here to `/app`.
 */
export default async function AppHomePage() {
  const ctx = await requireBilledOrg();
  return (
    <>
      <PricingImportPrompt role={ctx.role} />
      <QuoteBuilder />
    </>
  );
}

import { requireBilledOrg } from "@/lib/auth/guards";
import { QuoteBuilder } from "@/components/quote/QuoteBuilder";
import { PricingImportPrompt } from "@/components/pricing/PricingImportPrompt";

export default async function HomePage() {
  const ctx = await requireBilledOrg();
  return (
    <>
      <PricingImportPrompt role={ctx.role} />
      <QuoteBuilder />
    </>
  );
}

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabasePricingRepository } from "@/lib/pricing/SupabasePricingRepository";
import { updateCustomerDisplayAction } from "@/app/(app)/organization/actions";
import { CheckboxField } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

/**
 * Settings → Customer Display. Presentation settings for customer-facing quotes,
 * including the exact-technology-name toggle. Persisted through the pricing
 * repository (so migrations + Zod validation always run), exactly as before.
 */
export async function CustomerDisplaySection({ orgId, userId }: { orgId: string; userId: string }) {
  const supabase = createSupabaseServerClient();
  const repo = new SupabasePricingRepository(supabase, orgId, userId);
  const config = await repo.getConfiguration().catch(() => null);
  const showExact = config?.showExactTechnologyNamesOnCustomerQuotes ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-navy-900">Customer Display</h2>
        <p className="mt-1 text-sm text-navy-500">
          Control what patients see on the customer-facing quote and printed estimate.
        </p>
      </div>

      <section className="rounded-lg border border-navy-100 bg-white p-5">
        <form action={updateCustomerDisplayAction} className="space-y-3">
          <CheckboxField
            name="showExact"
            defaultChecked={showExact}
            label="Show exact technology names on customer-facing quotes"
            description="When off (recommended), Patient View and the Customer Estimate show generalized product names and hide brands, materials, and progressive design names."
          />
          <Button type="submit" size="sm">
            Save display setting
          </Button>
        </form>
      </section>
    </div>
  );
}

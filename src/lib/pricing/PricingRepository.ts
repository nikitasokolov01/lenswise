import type { PricingConfiguration } from "@/lib/types";

/**
 * Storage-agnostic pricing repository interface.
 *
 * The first proof-of-concept implementation (LocalStoragePricingRepository)
 * persists configuration in the browser's LocalStorage. A future version can
 * implement this same interface against Supabase (or any other database)
 * without any changes to the Admin Pricing UI or the calculation engine,
 * because both only ever depend on this interface.
 */
export interface PricingRepository {
  getConfiguration(): Promise<PricingConfiguration>;
  saveConfiguration(config: PricingConfiguration): Promise<void>;
  resetConfiguration(): Promise<PricingConfiguration>;
}

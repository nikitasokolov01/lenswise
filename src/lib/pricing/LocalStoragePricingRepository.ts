import type { PricingConfiguration } from "@/lib/types";
import type { PricingRepository } from "@/lib/pricing/PricingRepository";
import { createDefaultConfiguration } from "@/lib/pricing/seedConfiguration";
import { migratePricingConfiguration } from "@/lib/pricing/migratePricingConfiguration";
import { pricingConfigurationSchema } from "@/lib/validation";
import { LOCAL_STORAGE_PRICING_KEY } from "@/lib/constants";

/**
 * LocalStorage-backed implementation of PricingRepository.
 *
 * This is intentionally the ONLY place in the app that talks to
 * window.localStorage for pricing data. Swapping to Supabase (or any other
 * backend) later means writing a new class that implements
 * PricingRepository and satisfies the same three async methods — nothing
 * else in the app (Admin Pricing UI, Quote Builder, calculation engine)
 * needs to change.
 */
export class LocalStoragePricingRepository implements PricingRepository {
  private readonly storageKey: string;

  constructor(storageKey: string = LOCAL_STORAGE_PRICING_KEY) {
    this.storageKey = storageKey;
  }

  async getConfiguration(): Promise<PricingConfiguration> {
    if (typeof window === "undefined") {
      return createDefaultConfiguration();
    }

    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) {
        const defaults = createDefaultConfiguration();
        await this.saveConfiguration(defaults);
        return defaults;
      }

      const parsedJson = JSON.parse(raw);
      const migratedJson = migratePricingConfiguration(parsedJson);
      const result = pricingConfigurationSchema.safeParse(migratedJson);
      if (!result.success) {
        console.warn(
          "Stored pricing configuration failed validation after migration. Falling back to demonstration defaults.",
          result.error.flatten()
        );
        return createDefaultConfiguration();
      }

      // Persist the migrated shape so future loads skip re-migrating.
      if (migratedJson !== parsedJson) {
        await this.saveConfiguration(result.data as PricingConfiguration);
      }

      return result.data as PricingConfiguration;
    } catch (error) {
      console.warn("Unable to read pricing configuration from LocalStorage.", error);
      return createDefaultConfiguration();
    }
  }

  async saveConfiguration(config: PricingConfiguration): Promise<void> {
    if (typeof window === "undefined") return;
    const withTimestamp: PricingConfiguration = {
      ...config,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(this.storageKey, JSON.stringify(withTimestamp));
  }

  async resetConfiguration(): Promise<PricingConfiguration> {
    const defaults = createDefaultConfiguration();
    await this.saveConfiguration(defaults);
    return defaults;
  }
}

export const pricingRepository: PricingRepository = new LocalStoragePricingRepository();

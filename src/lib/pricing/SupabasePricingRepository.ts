import type { SupabaseClient } from "@supabase/supabase-js";
import type { PricingConfiguration } from "@/lib/types";
import type { PricingRepository } from "@/lib/pricing/PricingRepository";
import { createDefaultConfiguration } from "@/lib/pricing/seedConfiguration";
import { migratePricingConfiguration } from "@/lib/pricing/migratePricingConfiguration";
import { pricingConfigurationSchema } from "@/lib/validation";

/**
 * Supabase-backed implementation of the SAME PricingRepository interface used
 * by the proof-of-concept LocalStorage repository. Because the Admin Pricing
 * UI, the calculation engine, and the quote builder only ever depend on this
 * interface, swapping persistence requires no changes to them.
 *
 * Pricing is stored per organization in `pricing_configurations.config`
 * (JSONB) using the exact PricingConfiguration schema and the same versioned
 * migrations as before: on read we run `migratePricingConfiguration` and then
 * validate, falling back to seeded defaults if a stored config is invalid.
 * Row Level Security guarantees a client can only read/write its own
 * organization's row — other organizations are completely isolated.
 */
export class SupabasePricingRepository implements PricingRepository {
  private readonly supabase: SupabaseClient;
  private readonly organizationId: string;
  private readonly userId: string | null;

  constructor(supabase: SupabaseClient, organizationId: string, userId: string | null = null) {
    this.supabase = supabase;
    this.organizationId = organizationId;
    this.userId = userId;
  }

  /** True when this organization already has a saved server-side pricing configuration. */
  async hasConfiguration(): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("pricing_configurations")
      .select("organization_id")
      .eq("organization_id", this.organizationId)
      .maybeSingle();
    if (error) throw new Error(`Failed to check pricing configuration: ${error.message}`);
    return Boolean(data);
  }

  async getConfiguration(): Promise<PricingConfiguration> {
    const { data, error } = await this.supabase
      .from("pricing_configurations")
      .select("config")
      .eq("organization_id", this.organizationId)
      .maybeSingle();

    if (error) throw new Error(`Failed to load pricing configuration: ${error.message}`);
    if (!data) {
      // No server pricing for this org yet — return seeded defaults. Persisting
      // is a deliberate action (registration copies defaults; the LocalStorage
      // import prompt or a save writes them), never an automatic overwrite.
      return createDefaultConfiguration();
    }

    const migrated = migratePricingConfiguration(data.config);
    const result = pricingConfigurationSchema.safeParse(migrated);
    if (!result.success) {
      console.warn(
        "Stored pricing configuration failed validation after migration. Falling back to demonstration defaults.",
        result.error.flatten()
      );
      return createDefaultConfiguration();
    }
    return result.data as PricingConfiguration;
  }

  async saveConfiguration(config: PricingConfiguration): Promise<void> {
    const withTimestamp: PricingConfiguration = { ...config, updatedAt: new Date().toISOString() };
    const { error } = await this.supabase.from("pricing_configurations").upsert(
      {
        organization_id: this.organizationId,
        config: withTimestamp,
        schema_version: withTimestamp.schemaVersion,
        updated_by: this.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id" }
    );
    if (error) throw new Error(`Failed to save pricing configuration: ${error.message}`);
  }

  async resetConfiguration(): Promise<PricingConfiguration> {
    const defaults = createDefaultConfiguration();
    await this.saveConfiguration(defaults);
    return defaults;
  }
}

/** Convenience factory mirroring the shape used elsewhere in the app. */
export function createSupabasePricingRepository(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string | null = null
): PricingRepository {
  return new SupabasePricingRepository(supabase, organizationId, userId);
}

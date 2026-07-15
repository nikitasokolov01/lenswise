"use client";

import { useCallback, useEffect, useState } from "react";
import type { PricingConfiguration } from "@/lib/types";
import { usePricingRepository } from "@/lib/pricing/repositoryContext";

interface UsePricingConfigurationResult {
  configuration: PricingConfiguration | null;
  isLoading: boolean;
  /** Set when the server request fails. The UI must surface this — never silently fall back to defaults. */
  error: string | null;
  save: (config: PricingConfiguration) => Promise<void>;
  resetToDefaults: () => Promise<PricingConfiguration>;
  reload: () => Promise<void>;
}

/**
 * Loads pricing configuration through the PricingRepository abstraction (now
 * the org-scoped Supabase repository) and exposes save/reset helpers. Both the
 * Quote Builder (read-only use) and Admin Pricing (read/write use) share this
 * hook so there is a single source of truth for how configuration is loaded.
 *
 * On a failed server request we set `error` and leave `configuration` null —
 * we never silently fall back to default pricing, which would hide a real
 * failure and risk quoting against the wrong prices.
 */
export function usePricingConfiguration(): UsePricingConfigurationResult {
  const { repository } = usePricingRepository();
  const [configuration, setConfiguration] = useState<PricingConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const config = await repository.getConfiguration();
      setConfiguration(config);
    } catch (e) {
      setConfiguration(null);
      setError(e instanceof Error ? e.message : "Failed to load pricing configuration.");
    } finally {
      setIsLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    reload();
  }, [reload]);

  const save = useCallback(
    async (config: PricingConfiguration) => {
      await repository.saveConfiguration(config);
      setConfiguration(config);
    },
    [repository]
  );

  const resetToDefaults = useCallback(async () => {
    const defaults = await repository.resetConfiguration();
    setConfiguration(defaults);
    return defaults;
  }, [repository]);

  return { configuration, isLoading, error, save, resetToDefaults, reload };
}

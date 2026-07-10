"use client";

import { useCallback, useEffect, useState } from "react";
import type { PricingConfiguration } from "@/lib/types";
import { pricingRepository } from "@/lib/pricing/LocalStoragePricingRepository";

interface UsePricingConfigurationResult {
  configuration: PricingConfiguration | null;
  isLoading: boolean;
  save: (config: PricingConfiguration) => Promise<void>;
  resetToDefaults: () => Promise<PricingConfiguration>;
  reload: () => Promise<void>;
}

/**
 * Loads pricing configuration through the PricingRepository abstraction and
 * exposes save/reset helpers. Both the Quote Builder (read-only use) and
 * Admin Pricing (read/write use) share this hook so there is a single
 * source of truth for how configuration is loaded into React state.
 */
export function usePricingConfiguration(): UsePricingConfigurationResult {
  const [configuration, setConfiguration] = useState<PricingConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    setIsLoading(true);
    const config = await pricingRepository.getConfiguration();
    setConfiguration(config);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const save = useCallback(async (config: PricingConfiguration) => {
    await pricingRepository.saveConfiguration(config);
    setConfiguration(config);
  }, []);

  const resetToDefaults = useCallback(async () => {
    const defaults = await pricingRepository.resetConfiguration();
    setConfiguration(defaults);
    return defaults;
  }, []);

  return { configuration, isLoading, save, resetToDefaults, reload };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import type { PricingConfiguration } from "@/lib/types";
import { pricingRepository } from "@/lib/pricing/LocalStoragePricingRepository";
import { LOCAL_STORAGE_PRICING_KEY } from "@/lib/constants";

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

  // Keep every open surface (e.g. the Quote Builder in one tab and Admin
  // Pricing in another) on the single active configuration: when Admin saves
  // new pricing, the browser fires a `storage` event in other tabs, so we
  // reload the active configuration immediately rather than waiting for a
  // navigation or refresh. (The `storage` event never fires in the same tab
  // that made the change; that tab already updated its own state via `save`.)
  useEffect(() => {
    if (typeof window === "undefined") return;
    function handleStorage(event: StorageEvent) {
      if (event.key === LOCAL_STORAGE_PRICING_KEY) {
        reload();
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
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

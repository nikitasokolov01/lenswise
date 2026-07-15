"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { SupabasePricingRepository } from "@/lib/pricing/SupabasePricingRepository";
import type { PricingRepository } from "@/lib/pricing/PricingRepository";

interface RepositoryContextValue {
  repository: PricingRepository;
  /** Whether this organization already has server pricing (drives the import prompt). */
  hasServerConfiguration: () => Promise<boolean>;
  organizationId: string;
}

const RepositoryContext = createContext<RepositoryContextValue | null>(null);

/**
 * Provides the org-scoped Supabase pricing repository to the client tree. This
 * is the single place the app is wired to persistence — swapping the
 * LocalStorage POC repository for the Supabase one requires no change to the
 * Admin Pricing UI, the reducer, or the calculation engine, because they only
 * ever depend on the PricingRepository interface.
 */
export function PricingRepositoryProvider({
  organizationId,
  userId,
  children,
}: {
  organizationId: string;
  userId: string | null;
  children: ReactNode;
}) {
  const value = useMemo<RepositoryContextValue>(() => {
    const supabase = createSupabaseBrowserClient();
    const repo = new SupabasePricingRepository(supabase, organizationId, userId);
    return {
      repository: repo,
      hasServerConfiguration: () => repo.hasConfiguration(),
      organizationId,
    };
  }, [organizationId, userId]);

  return <RepositoryContext.Provider value={value}>{children}</RepositoryContext.Provider>;
}

export function usePricingRepository(): RepositoryContextValue {
  const ctx = useContext(RepositoryContext);
  if (!ctx) {
    throw new Error("usePricingRepository must be used within a PricingRepositoryProvider.");
  }
  return ctx;
}

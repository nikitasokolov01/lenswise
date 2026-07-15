"use client";

import { useEffect, useState } from "react";
import { usePricingRepository } from "@/lib/pricing/repositoryContext";
import { shouldOfferLocalImport, type OrgRole } from "@/lib/auth/permissions";
import { LOCAL_STORAGE_PRICING_KEY } from "@/lib/constants";
import { migratePricingConfiguration } from "@/lib/pricing/migratePricingConfiguration";
import { pricingConfigurationSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import type { PricingConfiguration } from "@/lib/types";

const DECISION_KEY_PREFIX = "lenswise:import-decision:";

/**
 * One-time prompt: if this organization has NO server pricing yet and valid
 * LensWise pricing exists in this device's LocalStorage, offer to import it or
 * start from LensWise defaults. Only Owners/Admins may import; existing server
 * pricing is never overwritten; the decision is remembered per organization so
 * the prompt never nags after a choice is made. Only pricing is imported —
 * never quotes, prescriptions, or temporary quote state.
 */
export function PricingImportPrompt({ role }: { role: OrgRole | null }) {
  const { repository, hasServerConfiguration, organizationId } = usePricingRepository();
  const [phase, setPhase] = useState<"idle" | "offer" | "importing" | "imported" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [localConfig, setLocalConfig] = useState<PricingConfiguration | null>(null);
  const [localRemoved, setLocalRemoved] = useState(false);
  const decisionKey = `${DECISION_KEY_PREFIX}${organizationId}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let parsedLocal: PricingConfiguration | null = null;
      let decisionMade = false;
      try {
        decisionMade = localStorage.getItem(decisionKey) === "done";
        const raw = localStorage.getItem(LOCAL_STORAGE_PRICING_KEY);
        if (raw) {
          const migrated = migratePricingConfiguration(JSON.parse(raw));
          const parsed = pricingConfigurationSchema.safeParse(migrated);
          if (parsed.success) parsedLocal = parsed.data as PricingConfiguration;
        }
      } catch {
        parsedLocal = null;
      }

      let hasServer = true;
      try {
        hasServer = await hasServerConfiguration();
      } catch {
        // If we can't tell, don't risk prompting to overwrite anything.
        hasServer = true;
      }
      if (cancelled) return;

      setLocalConfig(parsedLocal);
      const offer = shouldOfferLocalImport({
        role,
        hasServerConfig: hasServer,
        hasLocalConfig: Boolean(parsedLocal),
        decisionAlreadyMade: decisionMade,
      });
      setPhase(offer ? "offer" : "idle");
    })();
    return () => {
      cancelled = true;
    };
  }, [decisionKey, hasServerConfiguration, role]);

  function markDecided() {
    try {
      localStorage.setItem(decisionKey, "done");
    } catch {
      /* ignore */
    }
  }

  async function onImport() {
    if (!localConfig) return;
    setPhase("importing");
    setError(null);
    try {
      await repository.saveConfiguration(localConfig);
      markDecided();
      setPhase("imported");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
      setPhase("error");
    }
  }

  function onUseDefaults() {
    markDecided();
    setPhase("idle");
  }

  function onRemoveLocal() {
    try {
      localStorage.removeItem(LOCAL_STORAGE_PRICING_KEY);
      setLocalRemoved(true);
    } catch {
      /* ignore */
    }
  }

  if (phase === "idle") return null;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6 lg:px-8">
      <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
        {phase === "imported" ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-teal-900">Local pricing imported into this organization.</p>
            {!localRemoved ? (
              <Button variant="secondary" size="sm" onClick={onRemoveLocal}>
                Remove the local copy from this device
              </Button>
            ) : (
              <span className="text-xs text-teal-700">Local copy removed.</span>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-navy-800">
              Local LensWise pricing was found on this device. Import it into this organization or start with LensWise
              defaults?
            </p>
            {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={onImport} disabled={phase === "importing"}>
                {phase === "importing" ? "Importing…" : "Import Local Pricing"}
              </Button>
              <Button variant="secondary" size="sm" onClick={onUseDefaults} disabled={phase === "importing"}>
                Use LensWise Defaults
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

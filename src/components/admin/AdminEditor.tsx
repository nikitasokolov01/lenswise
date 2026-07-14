"use client";

import { useEffect, useState } from "react";
import { usePricingConfiguration } from "@/lib/pricing/usePricingConfiguration";
import { DemoPricingBanner } from "@/components/layout/DemoPricingBanner";
import { OfficeSettingsSection } from "@/components/admin/OfficeSettingsSection";
import { LensTypesSection } from "@/components/admin/LensTypesSection";
import { ProgressiveDesignsSection } from "@/components/admin/ProgressiveDesignsSection";
import { MaterialsSection } from "@/components/admin/MaterialsSection";
import { CoatingsSection } from "@/components/admin/CoatingsSection";
import { PhotochromicSection } from "@/components/admin/PhotochromicSection";
import { TintsSection } from "@/components/admin/TintsSection";
import { FeesAndDefaultsSection } from "@/components/admin/FeesAndDefaultsSection";
import { Button } from "@/components/ui/button";
import { Save, RotateCcw, CheckCircle2 } from "lucide-react";
import type { PricingConfiguration } from "@/lib/types";

function AdminSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="h-8 w-56 animate-pulse rounded bg-navy-100" />
      <div className="mt-6 space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-lg bg-navy-100" />
        ))}
      </div>
    </div>
  );
}

export function AdminEditor() {
  const { configuration, isLoading, save, resetToDefaults } = usePricingConfiguration();
  const [draft, setDraft] = useState<PricingConfiguration | null>(null);
  const [savedMessageVisible, setSavedMessageVisible] = useState(false);

  useEffect(() => {
    if (configuration && !draft) {
      setDraft(configuration);
    }
  }, [configuration, draft]);

  if (isLoading || !draft) {
    return <AdminSkeleton />;
  }

  const isDirty = configuration ? JSON.stringify(configuration) !== JSON.stringify(draft) : false;

  async function handleSave() {
    if (!draft) return;
    await save(draft);
    setSavedMessageVisible(true);
    setTimeout(() => setSavedMessageVisible(false), 2500);
  }

  async function handleRestoreDefaults() {
    if (!window.confirm("Restore demonstration default pricing? This replaces all current pricing configuration.")) {
      return;
    }
    const defaults = await resetToDefaults();
    setDraft(defaults);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <DemoPricingBanner />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Admin Pricing</h1>
          <p className="mt-1 text-sm text-navy-500">
            Pricing changes are stored only in this browser for the proof of concept.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={handleRestoreDefaults}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Restore demonstration defaults
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!isDirty}>
            {savedMessageVisible ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            {savedMessageVisible ? "Saved" : "Save changes"}
          </Button>
        </div>
      </div>

      {isDirty ? (
        <p className="mb-4 text-sm text-amber-800" role="status">
          You have unsaved pricing changes.
        </p>
      ) : null}

      <div className="space-y-5">
        <OfficeSettingsSection
          officeName={draft.officeName}
          disclaimerText={draft.disclaimerText}
          showExactTechnologyNamesOnCustomerQuotes={draft.showExactTechnologyNamesOnCustomerQuotes}
          onChangeOfficeName={(value) => setDraft({ ...draft, officeName: value })}
          onChangeDisclaimerText={(value) => setDraft({ ...draft, disclaimerText: value })}
          onChangeShowExactTechnologyNames={(value) =>
            setDraft({ ...draft, showExactTechnologyNamesOnCustomerQuotes: value })
          }
        />

        <LensTypesSection lensTypes={draft.lensTypes} onChange={(items) => setDraft({ ...draft, lensTypes: items })} />

        <ProgressiveDesignsSection
          progressiveDesigns={draft.progressiveDesigns}
          onChange={(items) => setDraft({ ...draft, progressiveDesigns: items })}
        />

        <MaterialsSection
          materials={draft.materials}
          lensTypes={draft.lensTypes}
          progressiveDesigns={draft.progressiveDesigns}
          onChange={(items) => setDraft({ ...draft, materials: items })}
        />

        <CoatingsSection coatings={draft.coatings} onChange={(items) => setDraft({ ...draft, coatings: items })} />

        <PhotochromicSection
          products={draft.photochromicProducts}
          colors={draft.photochromicColors}
          transitionsSurfacingFeeCents={draft.transitionsSurfacingFeeCents}
          onChangeProducts={(items) => setDraft({ ...draft, photochromicProducts: items })}
          onChangeColors={(items) => setDraft({ ...draft, photochromicColors: items })}
          onChangeSurfacingFee={(cents) => setDraft({ ...draft, transitionsSurfacingFeeCents: cents })}
        />

        <TintsSection tints={draft.tints} onChange={(tints) => setDraft({ ...draft, tints })} />

        <FeesAndDefaultsSection
          defaultInsuranceCoverage={draft.defaultInsuranceCoverage}
          highCylinderSurfacingFeeCents={draft.highCylinderSurfacingFeeCents}
          highCylinderThresholdDiopters={draft.highCylinderThresholdDiopters}
          onChangeDefaultInsuranceCoverage={(value) => setDraft({ ...draft, defaultInsuranceCoverage: value })}
          onChangeHighCylinderSurfacingFeeCents={(cents) => setDraft({ ...draft, highCylinderSurfacingFeeCents: cents })}
          onChangeHighCylinderThresholdDiopters={(value) => setDraft({ ...draft, highCylinderThresholdDiopters: value })}
        />
      </div>

      <div className="mt-6 flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={!isDirty}>
          {savedMessageVisible ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          {savedMessageVisible ? "Saved" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

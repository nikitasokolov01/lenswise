"use client";

import { useEffect, useState } from "react";
import { usePricingConfiguration } from "@/lib/pricing/usePricingConfiguration";
import { OfficeSettingsSection } from "@/components/admin/OfficeSettingsSection";
import { LensTypesSection } from "@/components/admin/LensTypesSection";
import { ProgressiveDesignsSection } from "@/components/admin/ProgressiveDesignsSection";
import { MaterialsSection } from "@/components/admin/MaterialsSection";
import { CoatingsSection } from "@/components/admin/CoatingsSection";
import { PhotochromicSection } from "@/components/admin/PhotochromicSection";
import { TintsSection } from "@/components/admin/TintsSection";
import { BlueLightSection } from "@/components/admin/BlueLightSection";
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
  const { configuration, isLoading, error, save, resetToDefaults, reload } = usePricingConfiguration();
  const [draft, setDraft] = useState<PricingConfiguration | null>(null);
  const [savedMessageVisible, setSavedMessageVisible] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (configuration && !draft) {
      setDraft(configuration);
    }
  }, [configuration, draft]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-800">Couldn&apos;t load pricing</h2>
          <p className="mt-2 text-sm text-red-700">{error}</p>
          <Button className="mt-4" size="sm" onClick={() => reload()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || !draft) {
    return <AdminSkeleton />;
  }

  const isDirty = configuration ? JSON.stringify(configuration) !== JSON.stringify(draft) : false;

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      await save(draft);
      setSavedMessageVisible(true);
      setTimeout(() => setSavedMessageVisible(false), 2500);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRestoreDefaults() {
    if (!window.confirm("Restore default pricing? This replaces all current pricing configuration.")) {
      return;
    }
    setSaveError(null);
    try {
      const defaults = await resetToDefaults();
      setDraft(defaults);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not restore defaults.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-navy-900">Pricing</h2>
          <p className="mt-1 text-sm text-navy-500">
            Pricing is saved to your organization and shared with every employee, across devices.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={handleRestoreDefaults} disabled={saving}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Restore defaults
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!isDirty || saving}>
            {savedMessageVisible ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            {saving ? "Saving…" : savedMessageVisible ? "Saved" : "Save changes"}
          </Button>
        </div>
      </div>

      {saveError ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {saveError}
        </p>
      ) : null}

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

        <BlueLightSection
          options={draft.blueLightOptions}
          onChange={(blueLightOptions) => setDraft({ ...draft, blueLightOptions })}
        />

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

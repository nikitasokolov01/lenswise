"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MoneyField } from "@/components/ui/money-field";
import { CheckboxField } from "@/components/ui/checkbox";
import { EditableList } from "@/components/admin/EditableList";
import { CoverageOverrideField } from "@/components/admin/CoverageOverrideField";
import { findMaterialPrice, upsertMaterialPrice } from "@/lib/calculation/materialPricing";
import { generateId } from "@/lib/id";
import type { LensTypeConfig, MaterialConfig, ProgressiveDesignConfig } from "@/lib/types";

interface MaterialsSectionProps {
  materials: MaterialConfig[];
  lensTypes: LensTypeConfig[];
  progressiveDesigns: ProgressiveDesignConfig[];
  onChange: (items: MaterialConfig[]) => void;
}

/**
 * Toggle one id in a compatibility list. An empty stored list means "all" — so
 * unchecking one materializes the full set minus that id; an explicit full set
 * behaves identically to empty in the engine.
 */
function toggleCompat(list: string[], allIds: string[], id: string, checked: boolean): string[] {
  const effective = list.length === 0 ? [...allIds] : list;
  if (checked) return Array.from(new Set([...effective, id]));
  return effective.filter((x) => x !== id);
}

/** One row of the price matrix: a lens type, and (for Progressive) a design. */
interface PriceMatrixRow {
  key: string;
  lensType: LensTypeConfig;
  progressiveDesign: ProgressiveDesignConfig | undefined;
  rowLabel: string;
}

function buildPriceMatrixRows(
  lensTypes: LensTypeConfig[],
  progressiveDesigns: ProgressiveDesignConfig[]
): PriceMatrixRow[] {
  const activeLensTypes = lensTypes.filter((lt) => lt.active).sort((a, b) => a.sortOrder - b.sortOrder);
  const activeDesigns = progressiveDesigns
    .filter((d) => d.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const rows: PriceMatrixRow[] = [];
  for (const lensType of activeLensTypes) {
    if (lensType.key === "progressive") {
      if (activeDesigns.length === 0) {
        rows.push({ key: lensType.id, lensType, progressiveDesign: undefined, rowLabel: lensType.name });
        continue;
      }
      for (const design of activeDesigns) {
        rows.push({
          key: `${lensType.id}:${design.id}`,
          lensType,
          progressiveDesign: design,
          rowLabel: `${lensType.name} — ${design.name}`,
        });
      }
    } else {
      rows.push({ key: lensType.id, lensType, progressiveDesign: undefined, rowLabel: lensType.name });
    }
  }
  return rows;
}

export function MaterialsSection({ materials, lensTypes, progressiveDesigns, onChange }: MaterialsSectionProps) {
  const rows = buildPriceMatrixRows(lensTypes, progressiveDesigns);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lens Materials &amp; Pricing</CardTitle>
        <CardDescription>
          CR-39, Polycarbonate, High Index 1.67, and any additional materials. The price for each material is set
          per lens type (and, for Progressive, per progressive design) — there is no separate lens-type base price.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EditableList
          items={materials}
          onChange={onChange}
          addLabel="Add material"
          getName={(item) => item.name}
          getSubtitle={(item) => item.shortDescription}
          createNew={() => ({
            id: generateId("material"),
            name: "New Material",
            shortDescription: "",
            active: true,
            sortOrder: materials.length,
            prices: [],
            appliesToHighCylinderSurfacing: false,
            isHighIndex: false,
            compatibleLensTypeIds: [],
            compatibleProgressiveDesignIds: [],
          })}
          renderFields={(item, update) => (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`${item.id}-name`}>Name</Label>
                  <Input id={`${item.id}-name`} value={item.name} onChange={(e) => update({ name: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor={`${item.id}-description`}>Short description</Label>
                  <Input
                    id={`${item.id}-description`}
                    value={item.shortDescription}
                    onChange={(e) => update({ shortDescription: e.target.value })}
                  />
                </div>
              </div>

              <CheckboxField
                label="Applies to high-cylinder surfacing fee"
                description="When on, a quote using this material can trigger the configured high-cylinder surfacing fee if either eye's cylinder is at or beyond the configured threshold (Single Vision or Bifocal only — never Progressive, and never High Index materials)."
                checked={item.appliesToHighCylinderSurfacing}
                onChange={(e) => update({ appliesToHighCylinderSurfacing: e.target.checked })}
              />

              <CheckboxField
                label="High index material"
                description="High-index lenses are handled by a separate process and are always excluded from the prescription-based high-cylinder surfacing fee, even if the option above is on."
                checked={item.isHighIndex}
                onChange={(e) => update({ isHighIndex: e.target.checked })}
              />

              <div>
                <p className="mb-1 text-sm font-medium text-navy-700">Compatible lens types</p>
                <p className="mb-2 text-xs text-navy-400">
                  Uncheck a lens type this material cannot be made in. Only compatible options appear in the Quote
                  Builder.
                </p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                  {lensTypes
                    .filter((lt) => lt.active)
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((lt) => {
                      const allIds = lensTypes.filter((x) => x.active).map((x) => x.id);
                      const checked = item.compatibleLensTypeIds.length === 0 || item.compatibleLensTypeIds.includes(lt.id);
                      return (
                        <label key={lt.id} className="flex items-center gap-2 text-sm text-navy-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              update({ compatibleLensTypeIds: toggleCompat(item.compatibleLensTypeIds, allIds, lt.id, e.target.checked) })
                            }
                          />
                          {lt.name}
                        </label>
                      );
                    })}
                </div>
              </div>

              <div>
                <p className="mb-1 text-sm font-medium text-navy-700">Compatible progressive designs</p>
                <p className="mb-2 text-xs text-navy-400">Only used when this material is paired with a Progressive lens.</p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                  {progressiveDesigns
                    .filter((d) => d.active)
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((d) => {
                      const allIds = progressiveDesigns.filter((x) => x.active).map((x) => x.id);
                      const checked =
                        item.compatibleProgressiveDesignIds.length === 0 || item.compatibleProgressiveDesignIds.includes(d.id);
                      return (
                        <label key={d.id} className="flex items-center gap-2 text-sm text-navy-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              update({
                                compatibleProgressiveDesignIds: toggleCompat(
                                  item.compatibleProgressiveDesignIds,
                                  allIds,
                                  d.id,
                                  e.target.checked
                                ),
                              })
                            }
                          />
                          {d.name}
                        </label>
                      );
                    })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-navy-700">Price by lens type</p>
                {rows.length === 0 ? (
                  <p className="text-sm text-navy-400">
                    No active lens types are available to price yet. Add one above.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {rows.map((row) => {
                      const existing = findMaterialPrice(item, row.lensType, row.progressiveDesign?.id ?? null);
                      return (
                        <div
                          key={row.key}
                          className="grid grid-cols-1 items-start gap-2 rounded-md border border-navy-100 p-2.5 sm:grid-cols-[1fr_140px_220px]"
                        >
                          <p className="pt-1.5 text-sm text-navy-700">{row.rowLabel}</p>
                          <div>
                            <Label htmlFor={`${item.id}-${row.key}-price`} className="text-xs">
                              Price
                            </Label>
                            <MoneyField
                              id={`${item.id}-${row.key}-price`}
                              valueCents={existing?.priceCents ?? 0}
                              onChangeCents={(cents) =>
                                update({
                                  prices: upsertMaterialPrice(
                                    item,
                                    row.lensType.id,
                                    row.progressiveDesign?.id ?? null,
                                    { priceCents: cents }
                                  ),
                                } as Partial<MaterialConfig>)
                              }
                            />
                          </div>
                          <CoverageOverrideField
                            id={`${item.id}-${row.key}-coverage`}
                            label="Insurance coverage"
                            override={existing?.insuranceCoverage}
                            onChange={(insuranceCoverage) =>
                              update({
                                prices: upsertMaterialPrice(
                                  item,
                                  row.lensType.id,
                                  row.progressiveDesign?.id ?? null,
                                  { insuranceCoverage }
                                ),
                              } as Partial<MaterialConfig>)
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        />
      </CardContent>
    </Card>
  );
}

import type { LensTypeConfig, MaterialConfig, ProgressiveDesignConfig } from "@/lib/types";

/**
 * Per-material compatibility. A material may be restricted to specific lens
 * types and (for Progressive) specific progressive designs. An EMPTY list
 * means "compatible with all" (back-compat for configs created before this
 * feature and for materials an office hasn't restricted).
 */

export function materialSupportsLensType(material: MaterialConfig, lensTypeId: string): boolean {
  const list = material.compatibleLensTypeIds ?? [];
  return list.length === 0 || list.includes(lensTypeId);
}

export function materialSupportsProgressiveDesign(material: MaterialConfig, designId: string): boolean {
  const list = material.compatibleProgressiveDesignIds ?? [];
  return list.length === 0 || list.includes(designId);
}

/**
 * Full compatibility check for a lens-type (+ progressive design) combination.
 * The design is only considered when the lens type is Progressive.
 */
export function materialSupportsCombo(
  material: MaterialConfig,
  lensType: LensTypeConfig,
  progressiveDesign: ProgressiveDesignConfig | undefined
): boolean {
  if (!materialSupportsLensType(material, lensType.id)) return false;
  if (lensType.key === "progressive" && progressiveDesign) {
    return materialSupportsProgressiveDesign(material, progressiveDesign.id);
  }
  return true;
}

/** Materials (active) that are compatible with the given lens type + design, for the Quote Builder. */
export function compatibleMaterials(
  materials: MaterialConfig[],
  lensType: LensTypeConfig | undefined,
  progressiveDesign: ProgressiveDesignConfig | undefined
): MaterialConfig[] {
  const active = materials.filter((m) => m.active).sort((a, b) => a.sortOrder - b.sortOrder);
  if (!lensType) return active;
  return active.filter((m) => materialSupportsCombo(m, lensType, progressiveDesign));
}

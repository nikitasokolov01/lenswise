import { generateId } from "@/lib/id";
import type { CoverageMethod, LensTypeConfig, MaterialConfig, MaterialPrice } from "@/lib/types";

/**
 * Looks up the priced combination for a material given a lens type (and,
 * for Progressive, a specific progressive design). This is the single
 * source of truth for "what does this material cost for this lens type" —
 * used by both the calculation engine and the Quote Builder / Admin UI so
 * the lookup logic never has to be duplicated or drift out of sync.
 */
export function findMaterialPrice(
  material: MaterialConfig,
  lensType: LensTypeConfig,
  progressiveDesignId: string | null | undefined
): MaterialPrice | undefined {
  const isProgressive = lensType.key === "progressive";
  return material.prices.find(
    (price) =>
      price.lensTypeId === lensType.id &&
      (isProgressive ? price.progressiveDesignId === progressiveDesignId : !price.progressiveDesignId)
  );
}

/**
 * Admin Pricing helper: creates or updates the MaterialPrice entry for a
 * given lens type (+ progressive design, when applicable) on a material,
 * returning a new `prices` array. Used so the Admin price-matrix editor can
 * always render a complete grid (one row per active lens type / design)
 * even for combinations that don't have a stored price entry yet — editing
 * such a row creates the entry on first edit.
 */
export function upsertMaterialPrice(
  material: MaterialConfig,
  lensTypeId: string,
  progressiveDesignId: string | null,
  patch: Partial<Pick<MaterialPrice, "priceCents">> & { insuranceCoverage?: CoverageMethod | undefined }
): MaterialPrice[] {
  const existingIndex = material.prices.findIndex(
    (price) =>
      price.lensTypeId === lensTypeId &&
      (progressiveDesignId ? price.progressiveDesignId === progressiveDesignId : !price.progressiveDesignId)
  );

  if (existingIndex >= 0) {
    return material.prices.map((price, index) => (index === existingIndex ? { ...price, ...patch } : price));
  }

  const newEntry: MaterialPrice = {
    id: generateId("price"),
    lensTypeId,
    progressiveDesignId: progressiveDesignId ?? undefined,
    priceCents: 0,
    ...patch,
  };
  return [...material.prices, newEntry];
}

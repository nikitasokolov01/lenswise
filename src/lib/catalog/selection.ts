export function toggleCatalogVariantSelection(
  selectedIds: readonly string[],
  variantId: string
): string[] {
  return selectedIds.includes(variantId)
    ? selectedIds.filter((id) => id !== variantId)
    : [...selectedIds, variantId];
}

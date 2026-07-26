export const FRAME_CATALOG_IMAGE_BUCKET = "frame-catalog-images";
export const FRAME_CATALOG_IMAGE_ROUTE_PREFIX = "/api/catalog/frame-images/";

export function frameCatalogImageUrl(catalogRecordId: string): string {
  return `${FRAME_CATALOG_IMAGE_ROUTE_PREFIX}${encodeURIComponent(catalogRecordId)}`;
}

export function isHostedFrameCatalogImageUrl(value: string | null): boolean {
  return Boolean(value?.startsWith(FRAME_CATALOG_IMAGE_ROUTE_PREFIX));
}

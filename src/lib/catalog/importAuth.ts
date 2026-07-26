import "server-only";
import { timingSafeEqual } from "node:crypto";
import { getFramesDataImportSecret } from "@/lib/env";

export function isAuthorizedFramesDataImport(authorizationHeader: string | null): boolean {
  if (!authorizationHeader?.startsWith("Bearer ")) return false;

  const supplied = Buffer.from(authorizationHeader.slice("Bearer ".length), "utf8");
  const expected = Buffer.from(getFramesDataImportSecret(), "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

import { SCHEMA_VERSION } from "@/lib/pricing/seedConfiguration";

/**
 * Migrates a raw, previously-persisted pricing configuration object forward
 * to the current schema shape, filling in fields introduced by later
 * schema versions with safe defaults rather than discarding the whole
 * configuration. Returns the input unchanged (structurally) if it is not a
 * plain object, or if it is already at/above the current schema version.
 *
 * v1 -> v2 changes:
 *  - `defaultAllowances` + `defaultCopays` merged into `defaultInsuranceCoverage`
 *    (see the "Combine insurance allowances and copays" quote builder change).
 *  - Added `highCylinderSurfacingFeeCents` (top-level fee amount).
 *  - Added `MaterialConfig.appliesToHighCylinderSurfacing` per material
 *    (defaults to false — an office must explicitly opt a material in).
 *
 * v2 -> v3 changes:
 *  - "Lens Only" and "Frame Only" are no longer LensTypeConfig entries (lens
 *    type is now purely the optical design — Single Vision / Progressive /
 *    Bifocal). Whether a frame and/or lenses are on the order is now the
 *    separate, required `orderType` field on QuoteInput (never persisted).
 *    Any stored "lens_only"/"frame_only" lens types, and any MaterialPrice
 *    rows that priced them, are removed; every office's real material
 *    prices (Single Vision/Progressive/Bifocal) are untouched.
 *
 * v3 -> v4 changes:
 *  - Added `highCylinderThresholdDiopters`: the high-cylinder surfacing fee's
 *    qualifying threshold is now office-configurable (Admin Pricing) instead
 *    of a hardcoded constant. Existing stored configurations default to -2,
 *    which matches the previously hardcoded behavior exactly, so no office's
 *    quotes change as a result of this migration alone.
 *
 * v4 -> v5 changes:
 *  - Every insurable category (frame / base lens / material / coating /
 *    photochromic) now uses an explicit CoverageMethod
 *    (`{type:"retail"}` | `{type:"copay",amountCents}` | `{type:"covered"}`)
 *    instead of a bare copay number, so a $0 copay and "fully covered" can
 *    never be confused. Old flat `xCopayCents` fields on
 *    `defaultInsuranceCoverage` become `{type:"copay",amountCents:X}` for
 *    the matching `xCoverage` field. Old optional `insuranceCopayCents` on
 *    MaterialPrice/CoatingConfig/PhotochromicProductConfig becomes an
 *    optional `insuranceCoverage` override in the same shape. No office's
 *    existing numbers change — every migrated value is still exactly the
 *    same copay amount, just wrapped in the explicit method.
 *
 * v5 -> v6 changes:
 *  - A per-category copay now REPLACES that category's retail cost (patient
 *    owes the copay, insurance covers retail − copay) instead of being added
 *    on top of retail, and a copay category no longer draws from the shared
 *    allowance pool. The old seed default billed the frame as a $0 copay
 *    while also granting a frame allowance — under the new model that would
 *    leave the frame fully insurance-covered and the allowance unused. So a
 *    stored default `frameCoverage` of `{type:"copay",amountCents:0}` paired
 *    with a positive frame allowance is converted to `{type:"retail"}`, which
 *    reproduces the intended behavior (the allowance offsets the frame retail
 *    and the patient pays any overage). Any office that set a non-zero frame
 *    copay is left untouched.
 *
 * The result is NOT guaranteed to pass `pricingConfigurationSchema` — the
 * caller (LocalStoragePricingRepository) still validates after migrating
 * and falls back to seeded defaults if the migrated shape is still invalid.
 */
export function migratePricingConfiguration(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const obj = raw as Record<string, unknown>;
  const version = typeof obj.schemaVersion === "number" ? obj.schemaVersion : 0;
  if (version >= SCHEMA_VERSION) return raw;

  let migrated: Record<string, unknown> = { ...obj };

  if (version < 2) {
    migrated = migrateV1ToV2(migrated);
  }
  if (version < 3) {
    migrated = migrateV2ToV3(migrated);
  }
  if (version < 4) {
    migrated = migrateV3ToV4(migrated);
  }
  if (version < 5) {
    migrated = migrateV4ToV5(migrated);
  }
  if (version < 6) {
    migrated = migrateV5ToV6(migrated);
  }
  if (version < 7) {
    migrated = migrateV6ToV7(migrated);
  }
  if (version < 8) {
    migrated = migrateV7ToV8(migrated);
  }

  return migrated;
}

function migrateV1ToV2(obj: Record<string, unknown>): Record<string, unknown> {
  const migrated: Record<string, unknown> = { ...obj };

  const oldAllowances = asRecord(migrated.defaultAllowances);
  const oldCopays = asRecord(migrated.defaultCopays);

  migrated.defaultInsuranceCoverage = {
    frameCopayCents: numberOr(oldCopays.frameCopayCents, 0),
    frameAllowanceCents: numberOr(oldAllowances.frameAllowanceCents, 0),
    lensCopayCents: numberOr(oldCopays.lensCopayCents, 0),
    lensAllowanceCents: numberOr(oldAllowances.lensAllowanceCents, 0),
    materialCopayCents: 0,
    coatingCopayCents: numberOr(oldCopays.coatingCopayCents, 0),
    photochromicCopayCents: numberOr(oldCopays.photochromicCopayCents, 0),
    otherCopayCents: numberOr(oldCopays.otherCopayCents, 0),
    additionalAllowanceCents: numberOr(oldAllowances.additionalCreditCents, 0),
    otherChargeCents: 0,
  };
  delete migrated.defaultAllowances;
  delete migrated.defaultCopays;

  migrated.highCylinderSurfacingFeeCents = numberOr(migrated.highCylinderSurfacingFeeCents, 4500);

  if (Array.isArray(migrated.materials)) {
    migrated.materials = migrated.materials.map((entry) => {
      const material = asRecord(entry);
      return {
        ...material,
        appliesToHighCylinderSurfacing:
          typeof material.appliesToHighCylinderSurfacing === "boolean"
            ? material.appliesToHighCylinderSurfacing
            : false,
      };
    });
  }

  migrated.schemaVersion = 2;
  return migrated;
}

function migrateV2ToV3(obj: Record<string, unknown>): Record<string, unknown> {
  const migrated: Record<string, unknown> = { ...obj };

  const removedLensTypeIds = new Set<string>();
  if (Array.isArray(migrated.lensTypes)) {
    migrated.lensTypes = migrated.lensTypes.filter((entry) => {
      const lensType = asRecord(entry);
      const isObsolete = lensType.key === "lens_only" || lensType.key === "frame_only";
      if (isObsolete && typeof lensType.id === "string") {
        removedLensTypeIds.add(lensType.id);
      }
      return !isObsolete;
    });
  }

  if (removedLensTypeIds.size > 0 && Array.isArray(migrated.materials)) {
    migrated.materials = migrated.materials.map((entry) => {
      const material = asRecord(entry);
      const prices = Array.isArray(material.prices) ? material.prices : [];
      return {
        ...material,
        prices: prices.filter((priceEntry) => {
          const price = asRecord(priceEntry);
          return typeof price.lensTypeId !== "string" || !removedLensTypeIds.has(price.lensTypeId);
        }),
      };
    });
  }

  migrated.schemaVersion = 3;
  return migrated;
}

function migrateV3ToV4(obj: Record<string, unknown>): Record<string, unknown> {
  const migrated: Record<string, unknown> = { ...obj };
  migrated.highCylinderThresholdDiopters = numberOr(migrated.highCylinderThresholdDiopters, -2);
  migrated.schemaVersion = 4;
  return migrated;
}

/** Converts a legacy bare copay number into the explicit CoverageMethod shape. */
function copayMethod(amountCents: unknown): Record<string, unknown> {
  return { type: "copay", amountCents: numberOr(amountCents, 0) };
}

/** Converts an optional legacy per-item `insuranceCopayCents` override into an optional `insuranceCoverage` override. */
function migrateOptionalCoverageOverride(record: Record<string, unknown>): Record<string, unknown> {
  const next = { ...record };
  if ("insuranceCopayCents" in next) {
    const legacyValue = next.insuranceCopayCents;
    delete next.insuranceCopayCents;
    if (typeof legacyValue === "number") {
      next.insuranceCoverage = copayMethod(legacyValue);
    }
  }
  return next;
}

function migrateV4ToV5(obj: Record<string, unknown>): Record<string, unknown> {
  const migrated: Record<string, unknown> = { ...obj };

  const oldCoverage = asRecord(migrated.defaultInsuranceCoverage);
  migrated.defaultInsuranceCoverage = {
    ...oldCoverage,
    frameCoverage: copayMethod(oldCoverage.frameCopayCents),
    lensCoverage: copayMethod(oldCoverage.lensCopayCents),
    materialCoverage: copayMethod(oldCoverage.materialCopayCents),
    coatingCoverage: copayMethod(oldCoverage.coatingCopayCents),
    photochromicCoverage: copayMethod(oldCoverage.photochromicCopayCents),
    otherCopayCents: numberOr(oldCoverage.otherCopayCents, 0),
    additionalAllowanceCents: numberOr(oldCoverage.additionalAllowanceCents, 0),
    frameAllowanceCents: numberOr(oldCoverage.frameAllowanceCents, 0),
    lensAllowanceCents: numberOr(oldCoverage.lensAllowanceCents, 0),
    otherChargeCents: numberOr(oldCoverage.otherChargeCents, 0),
  };
  delete (migrated.defaultInsuranceCoverage as Record<string, unknown>).frameCopayCents;
  delete (migrated.defaultInsuranceCoverage as Record<string, unknown>).lensCopayCents;
  delete (migrated.defaultInsuranceCoverage as Record<string, unknown>).materialCopayCents;
  delete (migrated.defaultInsuranceCoverage as Record<string, unknown>).coatingCopayCents;
  delete (migrated.defaultInsuranceCoverage as Record<string, unknown>).photochromicCopayCents;

  if (Array.isArray(migrated.materials)) {
    migrated.materials = migrated.materials.map((entry) => {
      const material = asRecord(entry);
      const prices = Array.isArray(material.prices) ? material.prices : [];
      return {
        ...material,
        prices: prices.map((priceEntry) => migrateOptionalCoverageOverride(asRecord(priceEntry))),
      };
    });
  }

  if (Array.isArray(migrated.coatings)) {
    migrated.coatings = migrated.coatings.map((entry) => migrateOptionalCoverageOverride(asRecord(entry)));
  }

  if (Array.isArray(migrated.photochromicProducts)) {
    migrated.photochromicProducts = migrated.photochromicProducts.map((entry) =>
      migrateOptionalCoverageOverride(asRecord(entry))
    );
  }

  migrated.schemaVersion = 5;
  return migrated;
}

function migrateV5ToV6(obj: Record<string, unknown>): Record<string, unknown> {
  const migrated: Record<string, unknown> = { ...obj };

  const coverage = asRecord(migrated.defaultInsuranceCoverage);
  const frameCoverage = asRecord(coverage.frameCoverage);
  const frameAllowance = numberOr(coverage.frameAllowanceCents, 0);
  const isZeroCopay =
    frameCoverage.type === "copay" && numberOr(frameCoverage.amountCents, 0) === 0;

  if (isZeroCopay && frameAllowance > 0) {
    migrated.defaultInsuranceCoverage = {
      ...coverage,
      frameCoverage: { type: "retail" },
    };
  }

  migrated.schemaVersion = 6;
  return migrated;
}

/** True when a stored CoverageMethod is a copay of exactly `amountCents`. */
function isCopayOf(method: unknown, amountCents: number): boolean {
  const m = asRecord(method);
  return m.type === "copay" && numberOr(m.amountCents, NaN) === amountCents;
}

/**
 * v6 -> v7:
 *  - Adds `isHighIndex` to every material (default false; inferred true for a
 *    material named "High Index" / the demo high-index id). High-index
 *    materials are excluded from the prescription-based surfacing fee.
 *  - Normalizes the demonstration Polycarbonate material (only the untouched
 *    demo id, only when the old seed value `false` is present) to require
 *    high-cylinder surfacing, so the standard demo flow charges the fee.
 *  - Repairs the accidental all-copay default coverage from earlier seeds:
 *    when the stored defaults still match the exact seeded copay pattern
 *    (lens $10, material/coating/photochromic $0), every category default is
 *    reset to Retail (Bug 2). A deliberately customized office config does
 *    not match this precise pattern and is left untouched.
 */
function migrateV6ToV7(obj: Record<string, unknown>): Record<string, unknown> {
  const migrated: Record<string, unknown> = { ...obj };

  if (Array.isArray(migrated.materials)) {
    migrated.materials = migrated.materials.map((entry) => {
      const material = asRecord(entry);
      const name = typeof material.name === "string" ? material.name : "";
      const isHighIndex =
        typeof material.isHighIndex === "boolean"
          ? material.isHighIndex
          : /high\s*index/i.test(name) || material.id === "material-hi-167";
      const next: Record<string, unknown> = { ...material, isHighIndex };
      if (material.id === "material-polycarbonate" && material.appliesToHighCylinderSurfacing === false) {
        next.appliesToHighCylinderSurfacing = true;
      }
      return next;
    });
  }

  const coverage = asRecord(migrated.defaultInsuranceCoverage);
  const looksLikeSeededCopayDefault =
    isCopayOf(coverage.lensCoverage, 1000) &&
    isCopayOf(coverage.materialCoverage, 0) &&
    isCopayOf(coverage.coatingCoverage, 0) &&
    isCopayOf(coverage.photochromicCoverage, 0);
  if (looksLikeSeededCopayDefault) {
    migrated.defaultInsuranceCoverage = {
      ...coverage,
      frameCoverage: { type: "retail" },
      lensCoverage: { type: "retail" },
      materialCoverage: { type: "retail" },
      coatingCoverage: { type: "retail" },
      photochromicCoverage: { type: "retail" },
    };
  }

  migrated.schemaVersion = 7;
  return migrated;
}

/**
 * v7 -> v8:
 *  - Adds `showExactTechnologyNamesOnCustomerQuotes` (default false) so
 *    customer-facing quotes hide exact brands/technologies and progressive
 *    design names unless an office explicitly opts in. A stored boolean (if
 *    one somehow already exists) is preserved.
 */
function migrateV7ToV8(obj: Record<string, unknown>): Record<string, unknown> {
  const migrated: Record<string, unknown> = { ...obj };
  if (typeof migrated.showExactTechnologyNamesOnCustomerQuotes !== "boolean") {
    migrated.showExactTechnologyNamesOnCustomerQuotes = false;
  }
  migrated.schemaVersion = 8;
  return migrated;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

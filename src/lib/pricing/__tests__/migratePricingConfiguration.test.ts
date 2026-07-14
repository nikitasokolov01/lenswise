import { describe, expect, it } from "vitest";
import { migratePricingConfiguration } from "@/lib/pricing/migratePricingConfiguration";
import { pricingConfigurationSchema } from "@/lib/validation";
import { SCHEMA_VERSION } from "@/lib/pricing/seedConfiguration";

function v1Fixture() {
  return {
    schemaVersion: 1,
    officeName: "Old Office",
    disclaimerText: "Estimate only.",
    lensTypes: [
      { id: "lt-1", key: "single_vision", name: "Single Vision", description: "", active: true, sortOrder: 0 },
    ],
    progressiveDesigns: [],
    materials: [
      {
        id: "mat-1",
        name: "CR-39",
        shortDescription: "",
        active: true,
        sortOrder: 0,
        prices: [{ id: "price-1", lensTypeId: "lt-1", priceCents: 6500 }],
        // no appliesToHighCylinderSurfacing field — this is the v1 shape
      },
    ],
    coatings: [],
    photochromicProducts: [],
    photochromicColors: [],
    transitionsSurfacingFeeCents: 3000,
    defaultAllowances: {
      frameAllowanceCents: 13000,
      lensAllowanceCents: 500,
      additionalCreditCents: 100,
    },
    defaultCopays: {
      frameCopayCents: 25,
      lensCopayCents: 1000,
      coatingCopayCents: 200,
      photochromicCopayCents: 300,
      otherCopayCents: 50,
    },
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
}

describe("migratePricingConfiguration", () => {
  it("merges v1 defaultAllowances/defaultCopays into a unified defaultInsuranceCoverage, with each copay wrapped as an explicit CoverageMethod", () => {
    const migrated = migratePricingConfiguration(v1Fixture()) as Record<string, unknown>;

    expect(migrated.defaultAllowances).toBeUndefined();
    expect(migrated.defaultCopays).toBeUndefined();
    expect(migrated.defaultInsuranceCoverage).toEqual({
      frameCoverage: { type: "copay", amountCents: 25 },
      frameAllowanceCents: 13000,
      lensCoverage: { type: "copay", amountCents: 1000 },
      lensAllowanceCents: 500,
      materialCoverage: { type: "copay", amountCents: 0 },
      coatingCoverage: { type: "copay", amountCents: 200 },
      photochromicCoverage: { type: "copay", amountCents: 300 },
      otherCopayCents: 50,
      additionalAllowanceCents: 100,
      otherChargeCents: 0,
    });
  });

  it("adds highCylinderSurfacingFeeCents and a per-material appliesToHighCylinderSurfacing flag", () => {
    const migrated = migratePricingConfiguration(v1Fixture()) as Record<string, unknown>;

    expect(migrated.highCylinderSurfacingFeeCents).toBe(4500);
    const materials = migrated.materials as Array<Record<string, unknown>>;
    expect(materials[0].appliesToHighCylinderSurfacing).toBe(false);
  });

  it("bumps schemaVersion to the current version", () => {
    // migratePricingConfiguration cascades a v1 fixture all the way to the
    // current schema version in one call — it does not stop partway.
    const migrated = migratePricingConfiguration(v1Fixture()) as Record<string, unknown>;
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("adds highCylinderThresholdDiopters defaulting to -2 for a pre-v4 configuration", () => {
    const migrated = migratePricingConfiguration(v1Fixture()) as Record<string, unknown>;
    expect(migrated.highCylinderThresholdDiopters).toBe(-2);
  });

  it("produces a shape that passes the current pricingConfigurationSchema", () => {
    const migrated = migratePricingConfiguration(v1Fixture());
    const result = pricingConfigurationSchema.safeParse(migrated);
    expect(result.success).toBe(true);
  });

  it("leaves an already-current configuration unchanged", () => {
    const current = { schemaVersion: SCHEMA_VERSION, foo: "bar" };
    const migrated = migratePricingConfiguration(current);
    expect(migrated).toBe(current);
  });

  it("returns non-object input unchanged", () => {
    expect(migratePricingConfiguration(null)).toBeNull();
    expect(migratePricingConfiguration("not an object")).toBe("not an object");
  });
});

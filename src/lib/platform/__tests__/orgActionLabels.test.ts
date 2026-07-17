import { describe, expect, it } from "vitest";
import { ORG_ACTION_LABELS } from "@/lib/platform/orgActionLabels";

describe("Platform Admin org action labels", () => {
  it("provides the four expected actions with clear short text", () => {
    expect(ORG_ACTION_LABELS.disableOrg).toBe("Disable Organization");
    expect(ORG_ACTION_LABELS.enableOrg).toBe("Enable Organization");
    expect(ORG_ACTION_LABELS.grantComplimentary).toBe("Grant Complimentary");
    expect(ORG_ACTION_LABELS.revokeComplimentary).toBe("Revoke Complimentary");
  });

  it("labels are single-line and short enough not to rely on multiline overflow", () => {
    for (const label of Object.values(ORG_ACTION_LABELS)) {
      expect(label).not.toMatch(/\n/); // single line
      expect(label.trim()).toBe(label);
      expect(label.length).toBeLessThanOrEqual(20); // fits comfortably on one line
    }
  });
});

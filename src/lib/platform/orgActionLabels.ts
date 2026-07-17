/**
 * Short, single-line button labels for the Platform Admin Organizations table
 * actions. Kept centralized (and pure) so the labels stay concise enough to fit
 * on one line inside their buttons — they must never rely on multi-line overflow.
 * The confirmation dialogs may still use the full "Lifetime Complimentary
 * Access" phrasing.
 */
export const ORG_ACTION_LABELS = {
  disableOrg: "Disable Organization",
  enableOrg: "Enable Organization",
  grantComplimentary: "Grant Complimentary",
  revokeComplimentary: "Revoke Complimentary",
} as const;

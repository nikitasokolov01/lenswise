/**
 * Lightweight, dependency-free id generator. Not cryptographically sensitive
 * (used only for React keys / line item ids / localStorage record ids) so a
 * simple random string is sufficient and works in every environment
 * (browser, Node, and older Safari without crypto.randomUUID).
 */
export function generateId(prefix = "id"): string {
  const random = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}_${time}_${random}`;
}

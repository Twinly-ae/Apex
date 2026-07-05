import type { HealthResponse } from "@apex/shared";

/** Composite 0–100 health score: sleep + recovery + inverted strain. */
export function healthScore(h: HealthResponse): number | null {
  const parts: number[] = [];
  if (h.scores.sleep != null) parts.push(h.scores.sleep);
  if (h.scores.recovery != null) parts.push(h.scores.recovery);
  if (h.scores.stress != null) parts.push(100 - h.scores.stress);
  if (parts.length === 0) return null;
  return Math.round(parts.reduce((s, n) => s + n, 0) / parts.length);
}

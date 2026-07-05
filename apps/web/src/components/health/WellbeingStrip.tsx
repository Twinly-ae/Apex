import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useHealth } from "../../lib/queries";
import { healthScore } from "../../lib/score";
import { MetricRing, ORDER, type Metric } from "./MetricRing";

/** Compact morning widget for Today: the three gauges + composite score. */
export function WellbeingStrip() {
  const { data: h } = useHealth();
  if (!h?.hasData) return null;

  const score = healthScore(h);
  const scoreOf = (m: Metric) =>
    m === "sleep"
      ? h.scores.sleep
      : m === "recovery"
        ? h.scores.recovery
        : h.scores.stress;

  return (
    <Link
      to="/health"
      className="block rounded-3xl border border-line bg-gradient-to-br from-surface to-surface-2 p-4 shadow-card active:opacity-90"
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Wellbeing
        </span>
        <span className="flex items-center gap-1.5">
          {score != null && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 font-display text-[11px] font-bold text-accent">
              Score {score}
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-muted" strokeWidth={2} />
        </span>
      </div>
      <div className="grid grid-cols-3">
        {ORDER.map((m) => (
          <MetricRing key={m} metric={m} value={scoreOf(m)} size={86} />
        ))}
      </div>
    </Link>
  );
}

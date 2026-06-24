import { useState } from "react";
import type { HealthResponse } from "@apex/shared";
import { type Metric, ORDER, RING, MetricRing } from "./MetricRing";

/** Plain-language coaching from the scores — works with no AI credits. */
function summaryCoaching(h: HealthResponse): string {
  const rec = h.scores.recovery;
  const hr = h.restingHr;
  const base = h.hrBaseline;
  const hrBit =
    hr != null && base != null
      ? ` Your resting HR (${hr} bpm) is ${
          hr > base ? "above" : hr < base ? "below" : "right at"
        } your ${base} bpm baseline.`
      : "";
  if (rec != null) {
    if (rec < 34)
      return `You're under-recovered — keep today light and prioritise sleep.${hrBit}`;
    if (rec < 67)
      return `Moderately recovered. Train as planned, but don't redline it.${hrBit}`;
    return `Well recovered — a good day to push hard.${hrBit}`;
  }
  const sl = h.scores.sleep;
  if (sl != null) {
    if (sl < 67)
      return `You ran light on sleep (${h.sleepHours ?? "?"}h). Ease into the day and aim for an early night.`;
    return `Solid sleep (${h.sleepHours ?? "?"}h) — carry that into a strong day.`;
  }
  return "Sync your watch to get recovery, sleep, and stress coaching.";
}

function band(value: number | null, goodHigh: boolean): "good" | "mid" | "bad" {
  if (value == null) return "mid";
  if (goodHigh ? value >= 67 : value <= 33) return "good";
  if (goodHigh ? value >= 34 : value <= 66) return "mid";
  return "bad";
}

function detailFor(
  metric: Metric,
  h: HealthResponse,
): { cards: [string, string][]; coaching: string; avg: string } {
  if (metric === "sleep") {
    const b = band(h.scores.sleep, true);
    return {
      cards: [
        ["Time asleep", h.sleepHours != null ? `${h.sleepHours}h` : "—"],
        ["Target", "8h"],
      ],
      coaching:
        b === "good"
          ? "You slept well last night. Keep your sleep and wake times consistent to lock it in."
          : b === "mid"
            ? "Fair sleep last night. Improve it tonight by avoiding food, caffeine, and screens before bed."
            : "Short on sleep. Protect tonight — wind down early and keep the room cool and dark.",
      avg:
        h.weekly.avgSleepHours != null
          ? `7-day avg ${h.weekly.avgSleepHours}h over ${h.weekly.nights} nights`
          : "Not enough nights yet",
    };
  }
  if (metric === "recovery") {
    const b = band(h.scores.recovery, true);
    const cmp =
      h.restingHr != null && h.hrBaseline != null
        ? h.restingHr > h.hrBaseline
          ? ` Your resting HR (${h.restingHr}) is higher than your ${h.hrBaseline} bpm baseline.`
          : ` Your resting HR (${h.restingHr}) is at or below your ${h.hrBaseline} bpm baseline — a good sign.`
        : "";
    return {
      cards: [
        ["Resting HR", h.restingHr != null ? `${h.restingHr} bpm` : "—"],
        ["Baseline", h.hrBaseline != null ? `${h.hrBaseline} bpm` : "—"],
      ],
      coaching:
        (b === "good"
          ? "You're well recovered — green light to train hard today."
          : b === "mid"
            ? "Moderately recovered. Train, but keep an eye on how you feel."
            : "You're poorly recovered, so take it easy today.") + cmp,
      avg:
        h.weekly.avgRecovery != null
          ? `7-day avg recovery ${h.weekly.avgRecovery}`
          : "Not enough data yet",
    };
  }
  const b = band(h.scores.stress, false);
  return {
    cards: [
      ["Resting HR", h.restingHr != null ? `${h.restingHr} bpm` : "—"],
      ["Slept", h.sleepHours != null ? `${h.sleepHours}h` : "—"],
    ],
    coaching:
      b === "good"
        ? "Stress is low — your body is in a good place. Keep the routine going."
        : b === "mid"
          ? "Moderate stress, usually from an elevated resting HR or a little sleep debt. A walk or breathing helps."
          : "Stress is high — driven by elevated resting HR and sleep debt. Prioritise recovery and an early night.",
    avg:
      h.weekly.avgRestingHr != null
        ? `7-day avg resting HR ${h.weekly.avgRestingHr} bpm`
        : "Not enough data yet",
  };
}

/** Whoop-style wellbeing card: 3 gradient rings + coaching, tap for detail. */
export function Wellbeing({ health }: { health?: HealthResponse }) {
  const [open, setOpen] = useState<Metric | null>(null);

  if (!health?.hasData) {
    return (
      <section className="rounded-3xl border border-line bg-gradient-to-br from-surface to-surface-2 p-5 shadow-card">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Wellbeing today
        </h2>
        <p className="mt-2 text-sm text-muted">
          Connect Apple Health (Settings → Apple Health) to see your sleep,
          recovery, and stress rings.
        </p>
      </section>
    );
  }

  const scoreOf = (m: Metric) =>
    m === "sleep"
      ? health.scores.sleep
      : m === "recovery"
        ? health.scores.recovery
        : health.scores.stress;

  const detail = open ? detailFor(open, health) : null;

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-line bg-gradient-to-br from-surface to-surface-2 p-5 shadow-card">
        <div className="grid grid-cols-3 gap-1">
          {ORDER.map((m) => (
            <MetricRing
              key={m}
              metric={m}
              value={scoreOf(m)}
              size={96}
              onClick={() => setOpen((o) => (o === m ? null : m))}
              active={open === m}
            />
          ))}
        </div>
        <div className="mt-4 border-t border-line pt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Coaching
          </div>
          <p className="mt-1 text-sm leading-relaxed text-text">
            {summaryCoaching(health)}
          </p>
        </div>
      </section>

      {/* Tap-through detail for the selected ring */}
      {open && detail && (
        <section className="rounded-3xl border border-line bg-surface p-5 shadow-card">
          <h3 className="text-center text-lg font-semibold text-text">
            {RING[open].label}
          </h3>
          <div className="mt-3 grid place-items-center">
            <MetricRing metric={open} value={scoreOf(open)} size={150} showCenterLabel />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {detail.cards.map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-line bg-surface-2 p-4"
              >
                <div className="text-xs text-muted">{label}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-text">
                  {value}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-2xl bg-surface-2 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Coaching
            </div>
            <p className="mt-1 text-sm leading-relaxed text-text">
              {detail.coaching}
            </p>
          </div>
          <p className="mt-3 text-center text-xs text-muted">{detail.avg}</p>
        </section>
      )}
    </div>
  );
}

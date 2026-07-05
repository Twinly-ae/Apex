import { Activity, Flame, Heart, Leaf, MoonStar } from "lucide-react";
import type { ReactNode } from "react";
import type { HealthResponse } from "@apex/shared";

const COLORS = {
  sleep: "#a5b4fc",
  hrv: "#34d399",
  recovery: "#a3e635",
  kcal: "#fb923c",
  score: "#4f8cff",
} as const;

function Chunk({
  color,
  children,
}: {
  color: string;
  children: ReactNode;
}) {
  return (
    <span className="font-bold" style={{ color }}>
      {children}
    </span>
  );
}

function InlineIcon({
  icon: Icon,
  color,
}: {
  icon: typeof MoonStar;
  color: string;
}) {
  return (
    <Icon
      className="mx-0.5 -mt-1 inline-block h-[18px] w-[18px] align-middle"
      style={{ color }}
      strokeWidth={2.4}
    />
  );
}

/** Composite 0–100 health score from whatever wellbeing signals exist. */
export function healthScore(h: HealthResponse): number | null {
  const parts: number[] = [];
  if (h.scores.sleep != null) parts.push(h.scores.sleep);
  if (h.scores.recovery != null) parts.push(h.scores.recovery);
  if (h.scores.stress != null) parts.push(100 - h.scores.stress);
  if (parts.length === 0) return null;
  return Math.round(parts.reduce((s, n) => s + n, 0) / parts.length);
}

/** Apple-Health-widget-style sentence: the morning story in one line. */
export function WakeSummary({ health: h }: { health: HealthResponse }) {
  const sleep = h.scores.sleep;
  const recovery = h.scores.recovery;
  const score = healthScore(h);
  const kcal = h.activeEnergyKcal;

  const woke: ReactNode[] = [];
  if (sleep != null) {
    woke.push(
      <span key="sleep">
        sleep <Chunk color={COLORS.sleep}>{sleep}</Chunk>
        <InlineIcon icon={MoonStar} color={COLORS.sleep} />
      </span>,
    );
  }
  if (h.hrv != null) {
    woke.push(
      <span key="hrv">
        HRV
        <InlineIcon icon={Activity} color={COLORS.hrv} /> of{" "}
        <Chunk color={COLORS.hrv}>{h.hrv}ms</Chunk>
      </span>,
    );
  }
  if (woke.length === 0 && recovery == null && kcal == null && score == null) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-line bg-gradient-to-br from-surface to-surface-2 p-5 shadow-card">
      <p className="text-center font-display text-[19px] font-semibold leading-relaxed tracking-tight text-text">
        {woke.length > 0 ? (
          <>
            You woke up with{" "}
            {woke.map((w, i) => (
              <span key={i}>
                {i > 0 && " and "}
                {w}
              </span>
            ))}
          </>
        ) : (
          <>Today so far</>
        )}
        {recovery != null && (
          <>
            , leading to <Chunk color={COLORS.recovery}>{recovery}</Chunk>{" "}
            recovery
            <InlineIcon icon={Leaf} color={COLORS.recovery} />
          </>
        )}
        {kcal != null && (
          <>
            , and <Chunk color={COLORS.kcal}>{kcal} kcal</Chunk>
            <InlineIcon icon={Flame} color={COLORS.kcal} />
          </>
        )}
        {score != null && (
          <>
            , resulting in health score
            <InlineIcon icon={Heart} color={COLORS.score} />{" "}
            <Chunk color={COLORS.score}>{score}</Chunk>
          </>
        )}
        .
      </p>
    </section>
  );
}

import { Flame, Leaf, type LucideIcon, MoonStar } from "lucide-react";

export type Metric = "stress" | "recovery" | "sleep";

export const RING: Record<
  Metric,
  { label: string; center: string; from: string; to: string; glow: string; icon: LucideIcon }
> = {
  stress: {
    label: "Strain",
    center: "Strain",
    from: "#f59e0b",
    to: "#fb7185",
    glow: "rgba(251,113,133,0.45)",
    icon: Flame,
  },
  recovery: {
    label: "Recovery",
    center: "Recovered",
    from: "#22c55e",
    to: "#a3e635",
    glow: "rgba(52,211,153,0.45)",
    icon: Leaf,
  },
  sleep: {
    label: "Sleep",
    center: "Quality",
    from: "#6366f1",
    to: "#a5b4fc",
    glow: "rgba(129,140,248,0.5)",
    icon: MoonStar,
  },
};

export const ORDER: Metric[] = ["stress", "recovery", "sleep"];

// Gauge geometry: a 270° dial that opens at the bottom (speedometer style).
const SWEEP = 270;
const START = -135;

function polar(c: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [c + r * Math.cos(rad), c + r * Math.sin(rad)];
}

function arcPath(c: number, r: number, startDeg: number, endDeg: number): string {
  const [sx, sy] = polar(c, r, startDeg);
  const [ex, ey] = polar(c, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}

/** Apple-Health-widget-style gauge: ticked 270° dial, value + metric icon. */
export function MetricRing({
  metric,
  value,
  size,
  showCenterLabel,
  onClick,
  active,
}: {
  metric: Metric;
  value: number | null;
  size: number;
  showCenterLabel?: boolean;
  onClick?: () => void;
  active?: boolean;
}) {
  const cfg = RING[metric];
  const Icon = cfg.icon;
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));
  const big = size >= 120;
  const sw = big ? 11 : 8;
  const c = size / 2;
  const r = c - sw / 2 - 1;
  const gid = `gauge-${metric}-${size}`;
  const dim = value == null;
  const end = START + (SWEEP * v) / 100;

  // Tick ring just inside the arc.
  const tickOuter = r - sw / 2 - 2.5;
  const tickInner = tickOuter - (big ? 6 : 4.5);
  const ticks = big ? 28 : 22;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-2xl py-1 transition-colors ${
        onClick ? "active:opacity-80" : "cursor-default"
      } ${active ? "bg-surface-2" : ""}`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <defs>
            <linearGradient id={gid} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor={cfg.from} />
              <stop offset="100%" stopColor={cfg.to} />
            </linearGradient>
          </defs>

          {/* Dial ticks */}
          {Array.from({ length: ticks }).map((_, i) => {
            const deg = START + (SWEEP * i) / (ticks - 1);
            const [x1, y1] = polar(c, tickOuter, deg);
            const [x2, y2] = polar(c, tickInner, deg);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#3a3a4a"
                strokeWidth={big ? 1.8 : 1.4}
                strokeLinecap="round"
              />
            );
          })}

          {/* Track + progress arcs */}
          <path
            d={arcPath(c, r, START, START + SWEEP)}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={sw}
            strokeLinecap="round"
          />
          {!dim && v > 0.5 && (
            <path
              d={arcPath(c, r, START, end)}
              fill="none"
              stroke={`url(#${gid})`}
              strokeWidth={sw}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 5px ${cfg.glow})` }}
            />
          )}
        </svg>

        {/* Value + metric icon, dial-centered */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-display font-bold leading-none tabular-nums text-text ${
              big ? "text-[2.6rem]" : "text-[1.55rem]"
            }`}
          >
            {dim ? "—" : v}
          </span>
          <Icon
            className={big ? "mt-1.5 h-6 w-6" : "mt-1 h-4 w-4"}
            style={{ color: cfg.to }}
            strokeWidth={2.2}
          />
          {big && showCenterLabel && (
            <span className="mt-1 text-xs text-muted">{cfg.center}</span>
          )}
        </div>
      </div>
      {!big && (
        <span className="text-[13px] font-medium text-text">{cfg.label}</span>
      )}
    </button>
  );
}

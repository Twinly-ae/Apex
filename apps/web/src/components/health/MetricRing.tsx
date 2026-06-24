export type Metric = "stress" | "recovery" | "sleep";

export const RING: Record<
  Metric,
  { label: string; center: string; from: string; to: string; glow: string }
> = {
  stress: {
    label: "Stress",
    center: "Stress",
    from: "#f59e0b",
    to: "#fb7185",
    glow: "rgba(251,113,133,0.45)",
  },
  recovery: {
    label: "Recovery",
    center: "Recovered",
    from: "#22c55e",
    to: "#a3e635",
    glow: "rgba(52,211,153,0.45)",
  },
  sleep: {
    label: "Sleep",
    center: "Quality",
    from: "#6366f1",
    to: "#a5b4fc",
    glow: "rgba(129,140,248,0.5)",
  },
};

export const ORDER: Metric[] = ["stress", "recovery", "sleep"];

/** A gradient 0–100 progress ring with a big centred value. */
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
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));
  const sw = size >= 120 ? 11 : 9;
  const c = size / 2;
  const r = c - sw / 2 - 2;
  const circ = 2 * Math.PI * r;
  const dash = (v / 100) * circ;
  const gid = `wgr-${metric}-${size}`;
  const dim = value == null;
  const big = size >= 120;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-2xl py-1 transition-colors ${
        onClick ? "active:opacity-80" : "cursor-default"
      } ${active ? "bg-surface-2" : ""}`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke="#23232e"
            strokeWidth={sw}
          />
          {!dim && (
            <>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={cfg.from} />
                  <stop offset="100%" stopColor={cfg.to} />
                </linearGradient>
              </defs>
              <circle
                cx={c}
                cy={c}
                r={r}
                fill="none"
                stroke={`url(#${gid})`}
                strokeWidth={sw}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circ}`}
                transform={`rotate(-90 ${c} ${c})`}
                style={{ filter: `drop-shadow(0 0 5px ${cfg.glow})` }}
              />
            </>
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="flex items-start leading-none">
            <span
              className={`font-bold tabular-nums text-text ${big ? "text-4xl" : "text-2xl"}`}
            >
              {dim ? "—" : v}
            </span>
            {!dim && (
              <span
                className={`font-semibold text-muted ${big ? "mt-1 text-base" : "mt-0.5 text-xs"}`}
              >
                %
              </span>
            )}
          </div>
          {big && showCenterLabel && (
            <span className="mt-0.5 text-xs text-muted">{cfg.center}</span>
          )}
        </div>
      </div>
      {!big && (
        <span className="text-sm font-medium text-text">{cfg.label}</span>
      )}
    </button>
  );
}

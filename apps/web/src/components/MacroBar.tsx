import { pct, round } from "../lib/format";

interface MacroBarProps {
  label: string;
  consumed: number;
  target: number;
  unit?: string;
  /** When true, exceeding the target is good (e.g. protein); else neutral. */
  highlightWhenMet?: boolean;
}

export function MacroBar({
  label,
  consumed,
  target,
  unit = "g",
  highlightWhenMet,
}: MacroBarProps) {
  const percent = pct(consumed, target);
  const met = consumed >= target && target > 0;
  const barColor = met && highlightWhenMet ? "bg-good" : "bg-accent";

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums text-text">
          {round(consumed)}
          <span className="text-muted">
            {" / "}
            {target}
            {unit}
          </span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full ${barColor} transition-all`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Dim the card and mark it as a future integration. */
  soon?: boolean;
}

export function StatCard({ label, value, sub, soon }: StatCardProps) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface p-4 ${
        soon ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted">
          {label}
        </span>
        {soon && (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted">
            soon
          </span>
        )}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tabular-nums text-text">
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

import type { BusinessPnl } from "@apex/shared";
import { useBusinessPnl } from "../../lib/queries";

// Validated pair for the dark surface (CVD-safe, in lightness band, ≥3:1).
const REVENUE = "#7c6bff";
const COSTS = "#f43f5e";

const aed = (n: number) => `${Math.round(n).toLocaleString()}`;

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short" });
}

function BusinessPnlBlock({ pnl }: { pnl: BusinessPnl }) {
  const rows = pnl.months.map((m) => ({
    ...m,
    outAed: m.costAed + m.expensesAed,
  }));
  const max = Math.max(1, ...rows.flatMap((r) => [r.revenueAed, r.outAed]));
  const hasData = rows.some((r) => r.revenueAed > 0 || r.outAed > 0);
  if (!hasData) return null;

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-text">{pnl.name}</h3>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.month} className="flex items-center gap-3">
            <span className="w-8 shrink-0 text-xs text-muted">
              {monthLabel(r.month)}
            </span>
            <div className="flex-1 space-y-0.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(r.revenueAed / max) * 100}%`,
                    backgroundColor: REVENUE,
                  }}
                />
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(r.outAed / max) * 100}%`,
                    backgroundColor: COSTS,
                  }}
                />
              </div>
            </div>
            <span
              className={`w-20 shrink-0 text-right text-xs font-semibold tabular-nums ${
                r.profitAed >= 0 ? "text-good" : "text-bad"
              }`}
            >
              {r.profitAed >= 0 ? "+" : "−"}
              {aed(Math.abs(r.profitAed))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Monthly P&L per business: revenue vs costs bars + signed profit. */
export function PnlCard() {
  const { data } = useBusinessPnl(6);
  const list = (data ?? []).filter((b) =>
    b.months.some((m) => m.revenueAed > 0 || m.costAed + m.expensesAed > 0),
  );
  if (list.length === 0) return null;

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          P&amp;L · last 6 months
        </h2>
        <div className="flex items-center gap-3 text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: REVENUE }}
            />
            Revenue
          </span>
          <span className="flex items-center gap-1">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: COSTS }}
            />
            Costs
          </span>
        </div>
      </div>
      <div className="space-y-5">
        {list.map((b) => (
          <BusinessPnlBlock key={b.id} pnl={b} />
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        Costs = cost of goods + Notion expenses. The signed number is profit.
      </p>
    </section>
  );
}

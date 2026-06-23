import { TwinlySales } from "../components/money/TwinlySales";
import { TwinlyExpenses } from "../components/twinly/TwinlyExpenses";
import {
  useGenerateReview,
  useReview,
  useTwinlySales,
  useTwinlySummary,
} from "../lib/queries";

const aed = (n: number) => `AED ${Math.round(n).toLocaleString()}`;

function Overview() {
  const { data: sales } = useTwinlySales();
  const { data: expenses } = useTwinlySummary();
  const revenue = sales?.monthRevenueAed ?? 0;
  const exp = expenses?.connected ? expenses.monthToDateAed : 0;
  const net = revenue - exp;

  return (
    <section className="rounded-2xl border border-line bg-gradient-to-br from-surface to-surface-2 p-4">
      <div className="text-xs uppercase tracking-wide text-muted">This month</div>
      <div className="mt-2 grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-xs text-muted">Revenue</div>
          <div className="mt-0.5 text-lg font-semibold tabular-nums text-text">
            {aed(revenue)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">Expenses</div>
          <div className="mt-0.5 text-lg font-semibold tabular-nums text-text">
            {aed(exp)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">Net</div>
          <div
            className={`mt-0.5 text-lg font-semibold tabular-nums ${
              net >= 0 ? "text-good" : "text-bad"
            }`}
          >
            {aed(net)}
          </div>
        </div>
      </div>
    </section>
  );
}

function TwinlyReview() {
  const review = useReview("twinly");
  const gen = useGenerateReview();
  const configured = review.data?.configured ?? false;

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          Weekly review
        </h2>
        {configured && (
          <button
            onClick={() => gen.mutate("twinly")}
            disabled={gen.isPending}
            className="text-xs text-accent active:opacity-70 disabled:opacity-50"
          >
            {gen.isPending
              ? "Reviewing…"
              : review.data?.text
                ? "Regenerate"
                : "Generate"}
          </button>
        )}
      </div>
      {!configured ? (
        <p className="text-sm text-muted">
          Set <code className="text-text">ANTHROPIC_API_KEY</code> on the API to
          get Claude's weekly Twinly review.
        </p>
      ) : review.data?.text ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
          {review.data.text}
        </p>
      ) : (
        <p className="text-sm text-muted">
          A concise weekly read on Twinly — momentum, margins, and what to do
          next.
        </p>
      )}
    </section>
  );
}

export function Twinly() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-text">Twinly</h1>
      <Overview />
      <TwinlySales />
      <TwinlyExpenses />
      <TwinlyReview />
    </div>
  );
}

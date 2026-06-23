import { RefreshCw } from "lucide-react";
import { useSyncTwinly, useTwinlySummary } from "../../lib/queries";

const aed = (n: number) => `AED ${Math.round(n).toLocaleString()}`;

/** Twinly business expenses, pulled from the Notion "Business Expenses" DB. */
export function TwinlyExpenses() {
  const { data: twinly } = useTwinlySummary();
  const syncTwinly = useSyncTwinly();

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          Expenses
        </h2>
        <button
          onClick={() => syncTwinly.mutate()}
          disabled={syncTwinly.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 text-sm text-text active:opacity-80 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${syncTwinly.isPending ? "animate-spin" : ""}`}
            strokeWidth={2}
          />
          {syncTwinly.isPending ? "Syncing…" : "Sync Notion"}
        </button>
      </div>

      {syncTwinly.data && (
        <p className="mb-3 text-xs text-muted">
          {syncTwinly.data.connected
            ? `Synced ${syncTwinly.data.imported} expenses.`
            : syncTwinly.data.message}
        </p>
      )}

      {twinly && twinly.connected ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-surface-2 p-3">
              <div className="text-xs text-muted">This month</div>
              <div className="text-lg font-semibold tabular-nums text-text">
                {aed(twinly.monthToDateAed)}
              </div>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <div className="text-xs text-muted">Last month</div>
              <div className="text-lg font-semibold tabular-nums text-text">
                {aed(twinly.lastMonthAed)}
              </div>
            </div>
          </div>

          {twinly.byCategory.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-xs uppercase tracking-wide text-muted">
                By category
              </div>
              <ul className="space-y-1 text-sm">
                {twinly.byCategory.slice(0, 8).map((c) => (
                  <li key={c.category} className="flex justify-between text-muted">
                    <span>{c.category}</span>
                    <span className="tabular-nums text-text">
                      {aed(c.amountAed)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {twinly.recent.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-xs uppercase tracking-wide text-muted">
                Recent
              </div>
              <ul className="divide-y divide-line">
                {twinly.recent.slice(0, 8).map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-text">{e.title ?? "—"}</div>
                      <div className="text-xs text-muted">
                        {e.category ?? "Uncategorized"}
                        {e.date ? ` · ${e.date.slice(0, 10)}` : ""}
                      </div>
                    </div>
                    <span className="shrink-0 tabular-nums text-text">
                      {aed(e.amountAed)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">
          Set <code className="text-text">NOTION_TOKEN</code> on the API to pull
          your Business Expenses database, then tap Sync.
        </p>
      )}
    </section>
  );
}

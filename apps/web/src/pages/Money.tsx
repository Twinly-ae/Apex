import { useState } from "react";
import { NetWorthChart } from "../components/Charts";
import { AccountCard } from "../components/money/AccountCard";
import { AccountSheet, BillSheet } from "../components/money/MoneySheets";
import {
  useBills,
  useDeleteBill,
  useMoney,
  useSyncTwinly,
  useTwinlySummary,
} from "../lib/queries";

const aed = (n: number) => `AED ${Math.round(n).toLocaleString()}`;

export function Money() {
  const { data: money, isLoading } = useMoney();
  const { data: bills } = useBills();
  const { data: twinly } = useTwinlySummary();
  const deleteBill = useDeleteBill();
  const syncTwinly = useSyncTwinly();
  const [acctOpen, setAcctOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-text">Money</h1>

      {/* Net worth */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="text-xs uppercase tracking-wide text-muted">
          Net worth
        </div>
        <div className="mt-1 text-3xl font-semibold tabular-nums text-text">
          {isLoading ? "…" : aed(money?.totalAed ?? 0)}
        </div>
        <div className="mt-3">
          <NetWorthChart data={money?.history ?? []} />
        </div>
      </section>

      {/* Accounts */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Accounts
          </h2>
          <button
            onClick={() => setAcctOpen(true)}
            className="text-sm text-accent"
          >
            + Add
          </button>
        </div>
        {(money?.accounts ?? []).length === 0 ? (
          <p className="py-3 text-sm text-muted">
            Add your accounts (xCube, StashAway, cash) to track net worth.
          </p>
        ) : (
          <div className="space-y-3">
            {(money?.accounts ?? []).map((a) => (
              <AccountCard key={a.id} account={a} />
            ))}
          </div>
        )}
      </section>

      {/* Bills */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Bills & subscriptions
          </h2>
          <button
            onClick={() => setBillOpen(true)}
            className="text-sm text-accent"
          >
            + Add
          </button>
        </div>
        {(bills ?? []).length === 0 ? (
          <p className="py-3 text-sm text-muted">No bills tracked yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface px-4">
            {(bills ?? []).map((b) => (
              <li key={b.id} className="flex items-center gap-3 py-3">
                <div className="flex-1">
                  <div className="text-text">{b.name}</div>
                  <div className="text-xs text-muted">
                    {aed(b.amountAed)} · {b.cadence} ·{" "}
                    {b.daysUntilDue < 0
                      ? `${Math.abs(b.daysUntilDue)}d overdue`
                      : `due in ${b.daysUntilDue}d`}
                  </div>
                </div>
                <button
                  onClick={() => deleteBill.mutate(b.id)}
                  className="-m-2 p-2 text-muted hover:text-bad"
                  aria-label="Delete bill"
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Twinly expenses (Notion) */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Twinly expenses
          </h2>
          <button
            onClick={() => syncTwinly.mutate()}
            disabled={syncTwinly.isPending}
            className="rounded-lg bg-surface-2 px-3 py-1.5 text-sm text-text active:opacity-80"
          >
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
                <div className="text-lg font-semibold text-text">
                  {aed(twinly.monthToDateAed)}
                </div>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <div className="text-xs text-muted">Last month</div>
                <div className="text-lg font-semibold text-text">
                  {aed(twinly.lastMonthAed)}
                </div>
              </div>
            </div>
            {twinly.byCategory.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {twinly.byCategory.slice(0, 6).map((c) => (
                  <li
                    key={c.category}
                    className="flex justify-between text-muted"
                  >
                    <span>{c.category}</span>
                    <span className="tabular-nums text-text">
                      {aed(c.amountAed)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">
            Set <code className="text-text">NOTION_TOKEN</code> on the API to pull
            your Business Expenses database, then tap Sync.
          </p>
        )}
      </section>

      <AccountSheet open={acctOpen} onClose={() => setAcctOpen(false)} />
      <BillSheet open={billOpen} onClose={() => setBillOpen(false)} />
    </div>
  );
}

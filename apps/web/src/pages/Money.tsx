import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { NetWorthChart } from "../components/Charts";
import { AccountCard } from "../components/money/AccountCard";
import { AccountSheet, BillSheet } from "../components/money/MoneySheets";
import { Statements } from "../components/money/Statements";
import { WeeklyReview } from "../components/money/WeeklyReview";
import { useBills, useDeleteBill, useMoney } from "../lib/queries";

const aed = (n: number) => `AED ${Math.round(n).toLocaleString()}`;

export function Money() {
  const { data: money, isLoading } = useMoney();
  const { data: bills } = useBills();
  const deleteBill = useDeleteBill();
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
            className="flex items-center gap-1 text-sm font-medium text-accent active:opacity-70"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Add
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
            className="flex items-center gap-1 text-sm font-medium text-accent active:opacity-70"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Add
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
                  <Trash2 className="h-[18px] w-[18px]" strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Bank statements (Claude-parsed, encrypted at rest) */}
      <Statements />

      {/* AI weekly reviews */}
      <WeeklyReview />

      <AccountSheet open={acctOpen} onClose={() => setAcctOpen(false)} />
      <BillSheet open={billOpen} onClose={() => setBillOpen(false)} />
    </div>
  );
}

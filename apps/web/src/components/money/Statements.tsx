import { useState } from "react";
import type { StatementSummary } from "@apex/shared";
import {
  useDeleteStatement,
  useImportStatement,
  useStatement,
  useStatements,
} from "../../lib/queries";

const aed = (n: number) => `AED ${Math.round(n).toLocaleString()}`;

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result);
      resolve(res.slice(res.indexOf(",") + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function SummaryView({ s }: { s: StatementSummary }) {
  return (
    <div className="mt-3 space-y-3 rounded-xl bg-surface-2 p-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-xs text-muted">Spent</div>
          <div className="font-semibold text-text">{aed(s.totalSpentAed)}</div>
        </div>
        <div>
          <div className="text-xs text-muted">Income</div>
          <div className="font-semibold text-text">{aed(s.totalIncomeAed)}</div>
        </div>
        <div>
          <div className="text-xs text-muted">Saved</div>
          <div className="font-semibold text-text">
            {s.savingsRate != null ? `${Math.round(s.savingsRate * 100)}%` : "—"}
          </div>
        </div>
      </div>

      {s.vsLastMonthAed != null && (
        <p className="text-center text-xs text-muted">
          {s.vsLastMonthAed > 0
            ? `${aed(s.vsLastMonthAed)} more than last month`
            : s.vsLastMonthAed < 0
              ? `${aed(-s.vsLastMonthAed)} less than last month`
              : "Same as last month"}
        </p>
      )}

      {s.byCategory.length > 0 && (
        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-muted">
            By category
          </div>
          <ul className="space-y-1 text-sm">
            {s.byCategory.slice(0, 8).map((c) => (
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

      {s.subscriptions.length > 0 && (
        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-muted">
            Subscriptions
          </div>
          <ul className="space-y-1 text-sm">
            {s.subscriptions.map((c, i) => (
              <li key={i} className="flex justify-between text-muted">
                <span className="truncate pr-2">{c.description}</span>
                <span className="tabular-nums text-text">
                  {aed(c.amountAed)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {s.tips.length > 0 && (
        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-muted">
            Claude's tips
          </div>
          <ul className="list-disc space-y-1 pl-4 text-sm text-text">
            {s.tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Upload a bank statement (PDF/CSV) → Claude parses, categorizes, advises. */
export function Statements() {
  const { data: list } = useStatements();
  const importStatement = useImportStatement();
  const remove = useDeleteStatement();
  const [month, setMonth] = useState(thisMonth());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = useStatement(selectedId);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    try {
      const dataBase64 = await readBase64(file);
      const detail = await importStatement.mutateAsync({
        month,
        filename: file.name,
        kind: isPdf ? "pdf" : "csv",
        dataBase64,
      });
      setSelectedId(detail.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't import that statement.",
      );
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
        Bank statements
      </h2>

      <div className="flex items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Month</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-text outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-1 cursor-pointer items-center justify-center rounded-xl border border-dashed border-line bg-surface-2 px-3 py-2.5 text-center text-sm text-muted active:opacity-80">
          {importStatement.isPending ? "Reading…" : "Upload PDF / CSV"}
          <input
            type="file"
            accept=".pdf,.csv,application/pdf,text/csv"
            className="hidden"
            disabled={importStatement.isPending}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-muted">
        Parsed and categorized by Claude. The file and line items are encrypted
        at rest — only the summary is shown.
      </p>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}

      {(list?.length ?? 0) > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {list?.map((s) => (
            <li key={s.id} className="flex items-center gap-2 py-2.5">
              <button
                onClick={() =>
                  setSelectedId(selectedId === s.id ? null : s.id)
                }
                className="flex-1 text-left"
              >
                <div className="text-sm text-text">{s.month}</div>
                <div className="text-xs text-muted">
                  {aed(s.totalSpentAed)} spent · {s.transactionCount} txns
                </div>
              </button>
              <button
                onClick={() => {
                  if (selectedId === s.id) setSelectedId(null);
                  remove.mutate(s.id);
                }}
                className="-m-2 p-2 text-muted hover:text-bad"
                aria-label="Delete statement"
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedId && selected.data && <SummaryView s={selected.data.summary} />}
    </section>
  );
}

import { useState } from "react";
import { useSaveTwinlySale, useTwinlySales } from "../../lib/queries";

const aed = (n: number) => `AED ${Math.round(n).toLocaleString()}`;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums text-text">
        {value}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-text outline-none focus:border-accent"
      />
    </label>
  );
}

/** Manual daily Twinly sales entry + month-to-date summary. */
export function TwinlySales() {
  const { data } = useTwinlySales();
  const save = useSaveTwinlySale();
  const today = data?.today ?? null;

  const [open, setOpen] = useState(false);
  const [revenue, setRevenue] = useState("");
  const [orders, setOrders] = useState("");
  const [cost, setCost] = useState("");

  function startEdit() {
    setRevenue(today ? String(today.revenueAed) : "");
    setOrders(today ? String(today.orders) : "");
    setCost(today ? String(today.costAed) : "");
    setOpen(true);
  }

  async function submit() {
    await save.mutateAsync({
      revenueAed: Number(revenue) || 0,
      orders: Math.round(Number(orders) || 0),
      costAed: Number(cost) || 0,
    });
    setOpen(false);
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          Twinly sales
        </h2>
        <button onClick={startEdit} className="text-sm text-accent">
          {today ? "Edit today" : "+ Log today"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Revenue (mo)" value={aed(data?.monthRevenueAed ?? 0)} />
        <Stat label="Profit (mo)" value={aed(data?.monthProfitAed ?? 0)} />
        <Stat label="Orders (mo)" value={String(data?.monthOrders ?? 0)} />
      </div>

      {today && !open && (
        <p className="mt-3 text-xs text-muted">
          Today: {aed(today.revenueAed)} · {today.orders} orders ·{" "}
          {aed(today.profitAed)} profit
        </p>
      )}

      {open && (
        <div className="mt-3 space-y-2 rounded-xl bg-surface-2 p-3">
          <Field label="Revenue (AED)" value={revenue} onChange={setRevenue} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Orders" value={orders} onChange={setOrders} />
            <Field label="Cost (AED)" value={cost} onChange={setCost} />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 rounded-xl bg-surface px-4 py-2.5 text-sm text-text active:opacity-80"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={save.isPending}
              className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white active:opacity-80 disabled:opacity-50"
            >
              {save.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {(data?.recent.length ?? 0) > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {data?.recent.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span className="text-muted">{s.day}</span>
              <span className="tabular-nums text-text">
                {aed(s.revenueAed)}{" "}
                <span className="text-muted">· {s.orders} orders</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

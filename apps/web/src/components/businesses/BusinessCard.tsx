import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import type { BusinessSummary } from "@apex/shared";
import {
  useDeleteBusiness,
  useSaveBusinessSale,
  useUpdateBusiness,
} from "../../lib/queries";

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

export function BusinessCard({ b }: { b: BusinessSummary }) {
  const save = useSaveBusinessSale();
  const update = useUpdateBusiness();
  const del = useDeleteBusiness();
  const today = b.today;

  const [open, setOpen] = useState(false);
  const [revenue, setRevenue] = useState("");
  const [orders, setOrders] = useState("");
  const [cost, setCost] = useState("");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(b.name);

  function startEdit() {
    setRevenue(today ? String(today.revenueAed) : "");
    setOrders(today ? String(today.orders) : "");
    setCost(today ? String(today.costAed) : "");
    setOpen(true);
  }

  async function submit() {
    await save.mutateAsync({
      id: b.id,
      input: {
        revenueAed: Number(revenue) || 0,
        orders: Math.round(Number(orders) || 0),
        costAed: Number(cost) || 0,
      },
    });
    setOpen(false);
  }

  function commitName() {
    setEditing(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== b.name) {
      update.mutate({ id: b.id, input: { name: trimmed } });
    } else {
      setName(b.name);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        {editing ? (
          <input
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === "Enter" && commitName()}
            className="flex-1 rounded-lg border border-line bg-surface-2 px-2 py-1 text-text outline-none focus:border-accent"
          />
        ) : (
          <h2 className="flex-1 truncate text-base font-semibold text-text">
            {b.name}
          </h2>
        )}
        <button
          onClick={() => setEditing(true)}
          className="-m-1 p-1 text-muted hover:text-text"
          aria-label="Rename"
        >
          <Pencil className="h-4 w-4" strokeWidth={2} />
        </button>
        <button
          onClick={() => {
            if (window.confirm(`Delete ${b.name}? Its sales will be removed.`)) {
              del.mutate(b.id);
            }
          }}
          className="-m-1 p-1 text-muted hover:text-bad"
          aria-label="Delete business"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Revenue (mo)" value={aed(b.monthRevenueAed)} />
        <Stat label="Profit (mo)" value={aed(b.monthProfitAed)} />
        <Stat label="Orders (mo)" value={String(b.monthOrders)} />
      </div>

      {today && !open && (
        <p className="mt-3 text-xs text-muted">
          Today: {aed(today.revenueAed)} · {today.orders} orders ·{" "}
          {aed(today.profitAed)} profit
        </p>
      )}

      <button
        onClick={startEdit}
        className="mt-3 w-full rounded-xl bg-surface-2 px-4 py-2 text-sm font-medium text-accent active:opacity-80"
      >
        {today ? "Edit today's sales" : "Log today's sales"}
      </button>

      {open && (
        <div className="mt-2 space-y-2 rounded-xl bg-surface-2 p-3">
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

      {b.recent.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {b.recent.map((s) => (
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

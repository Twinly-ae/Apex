import { Plus } from "lucide-react";
import { useState } from "react";
import { BusinessCard } from "../components/businesses/BusinessCard";
import { PnlCard } from "../components/businesses/PnlCard";
import { TwinlyExpenses } from "../components/twinly/TwinlyExpenses";
import {
  useAddBusiness,
  useBusinesses,
  useGenerateReview,
  useReview,
  useTwinlySummary,
} from "../lib/queries";

const aed = (n: number) => `AED ${Math.round(n).toLocaleString()}`;

function Overview() {
  const { data: businesses } = useBusinesses();
  const { data: expenses } = useTwinlySummary();
  const list = businesses ?? [];
  const revenue = list.reduce((s, b) => s + b.monthRevenueAed, 0);
  const profit = list.reduce((s, b) => s + b.monthProfitAed, 0);
  const exp = expenses?.connected ? expenses.monthToDateAed : 0;
  const net = profit - exp;

  return (
    <section className="rounded-2xl border border-line bg-gradient-to-br from-surface to-surface-2 p-4">
      <div className="text-xs uppercase tracking-wide text-muted">
        All businesses · this month
      </div>
      <div className="mt-2 grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-xs text-muted">Revenue</div>
          <div className="mt-0.5 text-lg font-semibold tabular-nums text-text">
            {aed(revenue)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">Profit</div>
          <div className="mt-0.5 text-lg font-semibold tabular-nums text-text">
            {aed(profit)}
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
      {exp > 0 && (
        <p className="mt-2 text-center text-xs text-muted">
          Net is profit minus {aed(exp)} of Notion expenses this month.
        </p>
      )}
    </section>
  );
}

function AddBusiness() {
  const add = useAddBusiness();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  async function submit() {
    if (!name.trim()) return;
    await add.mutateAsync({ name: name.trim() });
    setName("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-sm font-medium text-accent active:opacity-70"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        Add
      </button>
    );
  }
  return (
    <div className="flex gap-2">
      <input
        value={name}
        autoFocus
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Business name"
        className="w-40 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm text-text outline-none focus:border-accent"
      />
      <button
        onClick={submit}
        disabled={add.isPending || !name.trim()}
        className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white active:opacity-80 disabled:opacity-50"
      >
        Add
      </button>
    </div>
  );
}

function BusinessReview() {
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
          get Claude's weekly business review.
        </p>
      ) : review.data?.text ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
          {review.data.text}
        </p>
      ) : (
        <p className="text-sm text-muted">
          A concise weekly read on your businesses — momentum, margins, and what
          to do next.
        </p>
      )}
    </section>
  );
}

export function Businesses() {
  const { data: businesses, isLoading } = useBusinesses();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text">Businesses</h1>
        <AddBusiness />
      </div>

      <Overview />

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-surface" />
      ) : (
        (businesses ?? []).map((b) => <BusinessCard key={b.id} b={b} />)
      )}

      {/* Monthly P&L per business */}
      <PnlCard />

      {/* Notion business expenses (still a single Notion database) */}
      <TwinlyExpenses />

      <BusinessReview />
    </div>
  );
}

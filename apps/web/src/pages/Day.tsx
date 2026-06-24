import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { StatCard } from "../components/StatCard";
import { kg, liters } from "../lib/format";
import { useDay } from "../lib/queries";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate(),
  ).padStart(2, "0")}`;
}
function dayLabel(dateStr: string): string {
  const t = todayStr();
  if (dateStr === t) return "Today";
  if (dateStr === addDays(t, -1)) return "Yesterday";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
function time(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Day() {
  const [date, setDate] = useState(todayStr());
  const { data, isLoading } = useDay(date);
  const atToday = date >= todayStr();

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-2">
        <Link
          to="/"
          className="-m-1 p-1 text-muted hover:text-text"
          aria-label="Back to Today"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="text-2xl font-semibold text-text">History</h1>
      </header>

      {/* Date selector */}
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-surface p-2">
        <button
          onClick={() => setDate(addDays(date, -1))}
          className="rounded-xl p-2 text-muted active:bg-surface-2"
          aria-label="Previous day"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2} />
        </button>
        <label className="relative flex-1 cursor-pointer text-center">
          <span className="text-sm font-medium text-text">{dayLabel(date)}</span>
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <button
          onClick={() => setDate(addDays(date, 1))}
          disabled={atToday}
          className="rounded-xl p-2 text-muted active:bg-surface-2 disabled:opacity-30"
          aria-label="Next day"
        >
          <ChevronRight className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>

      {isLoading || !data ? (
        <div className="h-40 animate-pulse rounded-2xl bg-surface" />
      ) : (
        <>
          {/* Food */}
          <Section title="Food">
            <div className="grid grid-cols-4 gap-2 text-center">
              {(
                [
                  ["Cal", data.nutrition.calories],
                  ["Protein", `${data.nutrition.protein}g`],
                  ["Carbs", `${data.nutrition.carbs}g`],
                  ["Fat", `${data.nutrition.fat}g`],
                ] as const
              ).map(([label, val]) => (
                <div key={label} className="rounded-xl bg-surface-2 p-2">
                  <div className="text-[10px] text-muted">{label}</div>
                  <div className="text-sm font-semibold tabular-nums text-text">
                    {val}
                  </div>
                </div>
              ))}
            </div>
            {data.meals.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No meals logged.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {data.meals.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-text">{m.description}</div>
                      <div className="text-xs text-muted">{time(m.eatenAt)}</div>
                    </div>
                    <span className="shrink-0 tabular-nums text-text">
                      {m.calories} kcal
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Training */}
          <Section title="Training">
            {data.workouts.length === 0 ? (
              <p className="text-sm text-muted">No workout that day.</p>
            ) : (
              <ul className="space-y-2">
                {data.workouts.map((w) => (
                  <li key={w.id} className="flex items-center gap-3">
                    <Dumbbell className="h-4 w-4 shrink-0 text-accent" strokeWidth={2} />
                    <span className="flex-1 text-text">{w.title}</span>
                    <span className="text-xs text-muted">{w.sets.length} sets</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* At a glance */}
          <section className="grid grid-cols-2 gap-3">
            <StatCard label="Water" value={liters(data.waterMl)} sub="logged" />
            <StatCard label="Weight" value={kg(data.weightKg)} sub="that day" />
            <StatCard
              label="Steps"
              value={data.steps != null ? data.steps.toLocaleString() : "—"}
              sub="total"
              soon={data.steps == null}
            />
            <StatCard
              label="Active energy"
              value={
                data.activeEnergyKcal != null
                  ? `${data.activeEnergyKcal}`
                  : "—"
              }
              sub="kcal"
              soon={data.activeEnergyKcal == null}
            />
          </section>

          {/* Completed tasks */}
          <Section title={`Completed tasks · ${data.tasksCompleted.length}`}>
            {data.tasksCompleted.length === 0 ? (
              <p className="text-sm text-muted">Nothing marked done.</p>
            ) : (
              <ul className="space-y-2">
                {data.tasksCompleted.map((t) => (
                  <li key={t.id} className="flex items-center gap-2.5 text-sm">
                    <Check className="h-4 w-4 shrink-0 text-good" strokeWidth={2.5} />
                    <span className="text-text">{t.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

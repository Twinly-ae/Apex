import { ArrowLeft, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { Meal } from "@apex/shared";
import { MealSheet } from "../components/logging/MealSheet";
import {
  useAddMeal,
  useDeleteMeal,
  useMealHistory,
  useSettings,
} from "../lib/queries";

const SOURCE_LABEL: Record<string, string> = {
  text: "AI",
  photo: "Photo",
  barcode: "Barcode",
};

function dayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - date.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, {
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

function MealRow({ m }: { m: Meal }) {
  const del = useDeleteMeal();
  const add = useAddMeal();
  return (
    <li className="flex items-start gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-text">{m.description}</div>
        <div className="text-xs text-muted">
          {time(m.eatenAt)} · {m.protein}p {m.carbs}c {m.fat}f
          {SOURCE_LABEL[m.source] ? ` · ${SOURCE_LABEL[m.source]}` : ""}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="tabular-nums text-text">{m.calories}</div>
        <div className="text-[10px] text-muted">kcal</div>
      </div>
      <button
        onClick={() =>
          add.mutate({
            description: m.description,
            calories: m.calories,
            protein: m.protein,
            carbs: m.carbs,
            fat: m.fat,
            source: "manual",
          })
        }
        disabled={add.isPending}
        className="-m-1 p-1 text-muted hover:text-accent disabled:opacity-50"
        aria-label="Log this meal again now"
      >
        <RotateCcw className="h-4 w-4" strokeWidth={2} />
      </button>
      <button
        onClick={() => del.mutate(m.id)}
        className="-m-1 p-1 text-muted hover:text-bad"
        aria-label="Delete meal"
      >
        <Trash2 className="h-4 w-4" strokeWidth={2} />
      </button>
    </li>
  );
}

const RANGES: { label: string; days: number }[] = [
  { label: "2 wks", days: 14 },
  { label: "1 mo", days: 31 },
  { label: "3 mo", days: 93 },
  { label: "6 mo", days: 186 },
];

export function Meals() {
  const [days, setDays] = useState(14);
  const { data, isLoading } = useMealHistory(days);
  const { data: settings } = useSettings();
  const [open, setOpen] = useState(false);
  const target = settings?.calorieTarget ?? null;

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="-m-1 p-1 text-muted hover:text-text"
            aria-label="Back to Today"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          </Link>
          <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight text-text">Food log</h1>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-accent to-accent-strong px-3.5 py-2 text-sm font-semibold text-white shadow-glow active:scale-[0.99]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Log
        </button>
      </header>

      {/* Range selector */}
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-surface-2 p-1">
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => setDays(r.days)}
            className={`rounded-lg py-2 text-xs font-medium ${
              days === r.days ? "bg-accent text-white" : "text-muted"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-surface" />
      ) : (
        (data ?? []).map((d) => (
          <section
            key={d.day}
            className="rounded-2xl border border-line bg-surface p-4"
          >
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-text">
                {dayLabel(d.day)}
              </h2>
              <span className="text-sm tabular-nums text-muted">
                <span className="text-text">{d.totals.calories}</span>
                {target ? ` / ${target}` : ""} kcal
              </span>
            </div>
            {d.meals.length === 0 ? (
              <p className="py-2 text-sm text-muted">Nothing logged.</p>
            ) : (
              <>
                <ul className="divide-y divide-line">
                  {d.meals.map((m) => (
                    <MealRow key={m.id} m={m} />
                  ))}
                </ul>
                <div className="mt-2 flex gap-4 border-t border-line pt-2 text-xs text-muted">
                  <span>{d.totals.protein}g protein</span>
                  <span>{d.totals.carbs}g carbs</span>
                  <span>{d.totals.fat}g fat</span>
                </div>
              </>
            )}
          </section>
        ))
      )}

      <MealSheet open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

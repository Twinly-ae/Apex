import { Plus } from "lucide-react";
import { useState } from "react";
import { HabitsRow } from "../components/HabitsRow";
import { GoalCard } from "../components/goals/GoalCard";
import { GoalSheet } from "../components/goals/GoalSheet";
import { HabitSheet } from "../components/logging/HabitSheet";
import { useGenerateReview, useGoals, useHabits, useReview } from "../lib/queries";

export function Goals() {
  const { data: goals, isLoading } = useGoals();
  const { data: habits } = useHabits();
  const weeklyReview = useReview("goals");
  const generateReview = useGenerateReview();
  const [goalSheet, setGoalSheet] = useState(false);
  const [habitSheet, setHabitSheet] = useState(false);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight text-text">Goals</h1>
        <button
          onClick={() => setGoalSheet(true)}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-accent to-accent-strong px-3.5 py-2 text-sm font-semibold text-white shadow-glow active:scale-[0.99]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Goal
        </button>
      </header>

      {isLoading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-surface" />
      ) : (goals ?? []).length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          No goals yet. Set one with a deadline and Apex paces it into a daily
          next step.
        </p>
      ) : (
        <div className="space-y-6">
          {(["year", "other"] as const).map((horizon) => {
            const items = (goals ?? []).filter((g) => g.horizon === horizon);
            return items.length ? (
              <section key={horizon} className="space-y-3">
                <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
                  {horizon === "year" ? "Yearly goals" : "Other goals"}
                </h2>
                {items.map((g) => <GoalCard key={g.id} goal={g} />)}
              </section>
            ) : null;
          })}
        </div>
      )}

      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Weekly goals review</h2>
          <button
            onClick={() => generateReview.mutate("goals")}
            disabled={!weeklyReview.data?.configured || generateReview.isPending}
            className="text-sm text-accent disabled:opacity-50"
          >
            {generateReview.isPending ? "Reviewing…" : weeklyReview.data?.text ? "Refresh" : "Generate"}
          </button>
        </div>
        {weeklyReview.data?.text ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{weeklyReview.data.text}</p>
        ) : (
          <p className="text-sm text-muted">
            {weeklyReview.data?.configured === false
              ? "Configure AI in Settings to generate your weekly review."
              : "See what you finished, which goals need attention, and what to do next."}
          </p>
        )}
        {generateReview.isError && <p className="mt-2 text-xs text-bad">{generateReview.error.message}</p>}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Habits
          </h2>
          <button
            onClick={() => setHabitSheet(true)}
            className="text-sm text-accent"
          >
            + Add
          </button>
        </div>
        <HabitsRow habits={habits ?? []} editable />
      </section>

      <GoalSheet open={goalSheet} onClose={() => setGoalSheet(false)} />
      <HabitSheet open={habitSheet} onClose={() => setHabitSheet(false)} />
    </div>
  );
}

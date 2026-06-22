import { useState } from "react";
import type { Task } from "@apex/shared";
import { HabitsRow } from "../components/HabitsRow";
import { MacroBar } from "../components/MacroBar";
import { QuickLogRow } from "../components/QuickLogRow";
import { StatCard } from "../components/StatCard";
import { WorkoutSheet } from "../components/logging/WorkoutSheet";
import { formatDate, kg, liters, round } from "../lib/format";
import { useToday, useUpdateTask } from "../lib/queries";

function PriorityItem({ task }: { task: Task }) {
  const update = useUpdateTask();
  return (
    <li className="flex items-center gap-3 py-2.5">
      <button
        aria-label="Complete"
        onClick={() => update.mutate({ id: task.id, input: { done: true } })}
        className="h-6 w-6 shrink-0 rounded-full border-2 border-line active:border-good"
      />
      <span className="flex-1 text-text">{task.title}</span>
      {task.priority === 1 && (
        <span className="rounded-full bg-bad/15 px-2 py-0.5 text-[10px] text-bad">
          high
        </span>
      )}
    </li>
  );
}

export function Today() {
  const { data, isLoading } = useToday();
  const [workoutOpen, setWorkoutOpen] = useState(false);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-surface" />
        <div className="h-24 animate-pulse rounded-2xl bg-surface" />
        <div className="h-20 animate-pulse rounded-2xl bg-surface" />
      </div>
    );
  }

  const { nutrition: n } = data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-text">{data.greeting}</h1>
        <p className="text-sm text-muted">{formatDate(`${data.date}T00:00:00`)}</p>
      </header>

      {/* Morning briefing (rules-based now; Claude-written in Phase 4) */}
      <div className="rounded-2xl border border-line bg-gradient-to-br from-surface to-surface-2 p-4">
        <p className="text-sm leading-relaxed text-text">{data.briefing}</p>
      </div>

      {/* Today's focus — next step from the most urgent goal */}
      {data.todaysFocus && (
        <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4">
          <div className="text-xs uppercase tracking-wide text-accent">
            Today's focus
          </div>
          <p className="mt-1 text-text">{data.todaysFocus}</p>
        </div>
      )}

      <QuickLogRow defaultKg={data.latestBodyweightKg} />

      {/* Top priorities */}
      <section>
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Top priorities
          </h2>
          <span className="text-xs text-muted">{data.openTaskCount} open</span>
        </div>
        {data.topPriorities.length === 0 ? (
          <p className="py-3 text-sm text-muted">
            Nothing queued — tap “Task” above to add one.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {data.topPriorities.map((t) => (
              <PriorityItem key={t.id} task={t} />
            ))}
          </ul>
        )}
      </section>

      {/* Training today */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">
              Training today
            </div>
            <div className="mt-1 text-lg font-semibold text-text">
              {data.plannedWorkout ?? "Rest day"}
            </div>
          </div>
          {data.plannedWorkout ? (
            data.plannedWorkoutDone ? (
              <span className="rounded-full bg-good/15 px-3 py-1 text-sm text-good">
                Done ✓
              </span>
            ) : (
              <button
                onClick={() => setWorkoutOpen(true)}
                className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white active:opacity-80"
              >
                Log session
              </button>
            )
          ) : (
            <span className="text-sm text-muted">Recover well</span>
          )}
        </div>
      </section>

      {/* Habits */}
      {data.habits.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">
            Habits
          </h2>
          <HabitsRow habits={data.habits} />
        </section>
      )}

      {/* Today's targets */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
          Today's targets
        </h2>
        <div className="space-y-3">
          <MacroBar
            label="Protein"
            consumed={n.protein.consumed}
            target={n.protein.target}
            highlightWhenMet
          />
          <MacroBar
            label="Calories"
            consumed={n.calories.consumed}
            target={n.calories.target}
            unit=" kcal"
          />
          <MacroBar label="Carbs" consumed={n.carbs.consumed} target={n.carbs.target} />
          <MacroBar label="Fat" consumed={n.fat.consumed} target={n.fat.target} />
        </div>
      </section>

      {/* At a glance */}
      <section className="grid grid-cols-2 gap-3">
        <StatCard
          label="Calories in"
          value={round(n.calories.consumed)}
          sub={`${round(n.calories.remaining)} kcal left`}
        />
        <StatCard
          label="Protein"
          value={`${round(n.protein.consumed)}g`}
          sub={`${round(n.protein.remaining)}g to target`}
        />
        <StatCard
          label="Water"
          value={liters(n.waterMl.consumed)}
          sub={`of ${liters(n.waterMl.target)}`}
        />
        <StatCard
          label="Bodyweight"
          value={kg(data.latestBodyweightKg)}
          sub="latest"
        />
        <StatCard label="Calories out" value="—" sub="Apple Health" soon />
        <StatCard label="Net worth" value="—" sub="Phase 3" soon />
        <StatCard label="Twinly today" value="—" sub="Phase 4" soon />
        <StatCard label="Training streak" value="—" sub="see Trends" soon />
      </section>

      <WorkoutSheet
        open={workoutOpen}
        onClose={() => setWorkoutOpen(false)}
        defaultTitle={data.plannedWorkout ?? undefined}
      />
    </div>
  );
}

import { Check, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { Task } from "@apex/shared";
import { HabitsRow } from "../components/HabitsRow";
import { MacroBar } from "../components/MacroBar";
import { QuickLogRow } from "../components/QuickLogRow";
import { StatCard } from "../components/StatCard";
import { WorkoutSheet } from "../components/logging/WorkoutSheet";
import { formatDate, kg, liters, round } from "../lib/format";
import {
  useBriefing,
  useGenerateBriefing,
  useGeneratePlan,
  usePlan,
  useSyncHevy,
  useToday,
  useUpdateTask,
} from "../lib/queries";

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
  const briefing = useBriefing();
  const genBriefing = useGenerateBriefing();
  const plan = usePlan();
  const genPlan = useGeneratePlan();
  const syncHevy = useSyncHevy();
  const [workoutOpen, setWorkoutOpen] = useState(false);
  const aiOn = briefing.data?.configured ?? false;

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
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">{data.greeting}</h1>
          <p className="text-sm text-muted">
            {formatDate(`${data.date}T00:00:00`)}
          </p>
        </div>
        <Link
          to="/coach"
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent active:opacity-80"
        >
          <Sparkles className="h-4 w-4" strokeWidth={2} />
          Coach
        </Link>
      </header>

      {/* Morning briefing — Claude-written when configured, else rules-based */}
      <div className="rounded-2xl border border-line bg-gradient-to-br from-surface to-surface-2 p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted">
              Briefing
            </span>
            {data.briefingByAI && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
                <Sparkles className="h-3 w-3" strokeWidth={2.5} />
                Claude
              </span>
            )}
          </div>
          {aiOn && (
            <button
              onClick={() => genBriefing.mutate()}
              disabled={genBriefing.isPending}
              className="text-xs text-accent active:opacity-70 disabled:opacity-50"
            >
              {genBriefing.isPending
                ? "Writing…"
                : data.briefingByAI
                  ? "Refresh"
                  : "Ask Claude"}
            </button>
          )}
        </div>
        <p className="text-sm leading-relaxed text-text">{data.briefing}</p>
      </div>

      {/* Day plan — Claude time-blocks the day around tasks, training, goals */}
      {aiOn && (
        <section className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
              Day plan
            </h2>
            <button
              onClick={() => genPlan.mutate(undefined)}
              disabled={genPlan.isPending}
              className="text-xs text-accent active:opacity-70 disabled:opacity-50"
            >
              {genPlan.isPending
                ? "Planning…"
                : plan.data?.text
                  ? "Re-plan"
                  : "Plan my day"}
            </button>
          </div>
          {plan.data?.text ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
              {plan.data.text}
            </p>
          ) : (
            <p className="text-sm text-muted">
              Let Claude block out your day around your tasks, training, and
              goals.
            </p>
          )}
        </section>
      )}

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
        <div className="flex items-center justify-between gap-3">
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
              <span className="inline-flex items-center gap-1 rounded-full bg-good/15 px-3 py-1 text-sm text-good">
                <Check className="h-4 w-4" strokeWidth={2.5} />
                Done
              </span>
            ) : (
              <button
                onClick={() => syncHevy.mutate()}
                disabled={syncHevy.isPending}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-br from-accent to-accent-strong px-3.5 py-2 text-sm font-semibold text-white shadow-glow active:scale-[0.99] disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${syncHevy.isPending ? "animate-spin" : ""}`}
                  strokeWidth={2.5}
                />
                {syncHevy.isPending ? "Syncing…" : "Sync Hevy"}
              </button>
            )
          ) : (
            <span className="text-sm text-muted">Recover well</span>
          )}
        </div>

        {/* Sync feedback + manual fallback */}
        {data.plannedWorkout && !data.plannedWorkoutDone && (
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
            <p className="text-xs text-muted">
              {syncHevy.isError
                ? "Couldn't reach Hevy — try again."
                : syncHevy.data
                  ? syncHevy.data.message
                    ? syncHevy.data.message
                    : syncHevy.data.imported > 0
                      ? `Synced ${syncHevy.data.imported} workout${
                          syncHevy.data.imported > 1 ? "s" : ""
                        } from Hevy.`
                      : "No new Hevy workout yet today."
                  : "Pulls today's session straight from Hevy."}
            </p>
            <button
              onClick={() => setWorkoutOpen(true)}
              className="shrink-0 text-xs font-medium text-accent active:opacity-70"
            >
              Log manually
            </button>
          </div>
        )}
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
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Today's targets
          </h2>
          <Link
            to="/meals"
            className="text-xs font-medium text-accent active:opacity-70"
          >
            Food log →
          </Link>
        </div>
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

      {/* Energy balance — activity-aware "how much can I still eat" */}
      <section className="rounded-2xl border border-line bg-gradient-to-br from-surface to-surface-2 p-4">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
          Energy balance
        </h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-muted">Eaten</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums text-text">
              {data.energy.eaten.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">Burned</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums text-text">
              {data.energy.burned.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">Net</div>
            <div
              className={`mt-0.5 text-lg font-semibold tabular-nums ${
                data.energy.net <= 0 ? "text-good" : "text-warn"
              }`}
            >
              {data.energy.net > 0 ? "+" : ""}
              {data.energy.net.toLocaleString()}
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-sm text-text">
          {data.energy.remaining > 0 ? (
            <>
              You can still eat{" "}
              <span className="font-semibold text-accent">
                {data.energy.remaining.toLocaleString()}
              </span>{" "}
              kcal
            </>
          ) : data.energy.remaining < 0 ? (
            <>
              You're{" "}
              <span className="font-semibold text-warn">
                {Math.abs(data.energy.remaining).toLocaleString()}
              </span>{" "}
              kcal over budget
            </>
          ) : (
            <>You've hit your budget exactly</>
          )}
        </p>
        <p className="mt-1 text-center text-xs text-muted">
          Budget {data.energy.budget.toLocaleString()} kcal
          {data.energy.activeKcal != null &&
            ` · +${data.energy.activeKcal.toLocaleString()} earned from activity`}
        </p>
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
        <StatCard
          label="Burned"
          value={
            data.caloriesOut != null ? data.caloriesOut.toLocaleString() : "—"
          }
          sub="maintenance + activity"
        />
        <StatCard
          label="Steps"
          value={data.steps != null ? data.steps.toLocaleString() : "—"}
          sub="today"
          soon={data.steps == null}
        />
        <StatCard
          label="Net worth"
          value={
            data.netWorthAed != null
              ? `AED ${Math.round(data.netWorthAed).toLocaleString()}`
              : "—"
          }
          sub="total"
          soon={data.netWorthAed == null}
        />
        <StatCard
          label="Twinly today"
          value={
            data.twinlyRevenueToday != null
              ? `AED ${Math.round(data.twinlyRevenueToday).toLocaleString()}`
              : "—"
          }
          sub="revenue"
          soon={data.twinlyRevenueToday == null}
        />
      </section>

      <WorkoutSheet
        open={workoutOpen}
        onClose={() => setWorkoutOpen(false)}
        defaultTitle={data.plannedWorkout ?? undefined}
      />
    </div>
  );
}

import {
  Check,
  ChevronDown,
  History,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { Task } from "@apex/shared";
import { DayPlanBlocks } from "../components/DayPlanBlocks";
import { HabitsRow } from "../components/HabitsRow";
import { MacroBar } from "../components/MacroBar";
import { QuickLogRow } from "../components/QuickLogRow";
import { StatCard } from "../components/StatCard";
import { WeeklyReview } from "../components/money/WeeklyReview";
import { WorkoutSheet } from "../components/logging/WorkoutSheet";
import { formatDate, kg, liters } from "../lib/format";
import { colorHex, estLabel } from "../lib/taskColors";
import {
  useBriefing,
  useGenerateBriefing,
  useGeneratePlan,
  usePlan,
  useSyncHevy,
  useToday,
  useUpdateTask,
} from "../lib/queries";

const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-muted";

function PriorityItem({ task }: { task: Task }) {
  const update = useUpdateTask();
  const est = estLabel(task.estMinutes);
  return (
    <li className="flex items-center gap-3 py-2.5">
      <button
        aria-label="Complete"
        onClick={() => update.mutate({ id: task.id, input: { done: true } })}
        className="h-6 w-6 shrink-0 rounded-full border-2 active:scale-90"
        style={{ borderColor: colorHex(task.color) }}
      />
      <div className="min-w-0 flex-1">
        <span className="block truncate text-text">{task.title}</span>
        {est && <span className="text-xs text-muted">{est}</span>}
      </div>
      {task.priority === 1 && (
        <span className="shrink-0 rounded-full bg-bad/15 px-2 py-0.5 text-[10px] font-medium text-bad">
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
  const [showMore, setShowMore] = useState(false);
  const aiOn = briefing.data?.configured ?? false;

  if (isLoading || !data) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-surface" />
        <div className="h-40 animate-pulse rounded-3xl bg-surface" />
        <div className="h-24 animate-pulse rounded-2xl bg-surface" />
        <div className="h-20 animate-pulse rounded-2xl bg-surface" />
      </div>
    );
  }

  const { nutrition: n, energy: e } = data;
  const over = e.remaining < 0;
  const eatenPct = e.budget > 0 ? Math.min(100, (e.eaten / e.budget) * 100) : 0;
  const barColor = over ? "bg-bad" : eatenPct >= 90 ? "bg-warn" : "bg-accent";

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-text">
            {data.greeting}
          </h1>
          <p className="text-sm text-muted">
            {formatDate(`${data.date}T00:00:00`)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/day"
            aria-label="History"
            className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-muted active:opacity-80"
          >
            <History className="h-[18px] w-[18px]" strokeWidth={2} />
          </Link>
          <Link
            to="/coach"
            className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent active:opacity-80"
          >
            <Sparkles className="h-4 w-4" strokeWidth={2} />
            Coach
          </Link>
        </div>
      </header>

      {/* HERO — the one number that matters: how much can I still eat, + protein */}
      <section className="rounded-3xl border border-line bg-gradient-to-br from-surface to-surface-2 p-5 shadow-card">
        <div className="flex items-center justify-between">
          <span className={LABEL}>Energy left</span>
          {e.activeKcal != null && e.activeKcal > 0 && (
            <span className="rounded-full bg-good/15 px-2 py-0.5 text-[10px] font-medium text-good">
              +{e.activeKcal.toLocaleString()} from activity
            </span>
          )}
        </div>
        <div className="mt-1 flex items-end gap-2">
          <span
            className={`font-display text-[2.75rem] font-bold leading-none tabular-nums ${
              over ? "text-warn" : "text-text"
            }`}
          >
            {over ? "−" : ""}
            {Math.abs(e.remaining).toLocaleString()}
          </span>
          <span className="mb-1 text-sm text-muted">
            kcal {over ? "over" : "left"}
          </span>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full rounded-full ${barColor} transition-all`}
            style={{ width: `${eatenPct}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-xs tabular-nums text-muted">
          <span>Eaten {e.eaten.toLocaleString()}</span>
          <span>Burned {e.burned.toLocaleString()}</span>
          <span>Budget {e.budget.toLocaleString()}</span>
        </div>

        {/* Protein is his #1 lever on a recomp — keep it in the hero */}
        <div className="mt-4 border-t border-line pt-4">
          <MacroBar
            label="Protein"
            consumed={n.protein.consumed}
            target={n.protein.target}
            highlightWhenMet
          />
        </div>
      </section>

      {/* Morning briefing — Claude-written when configured, else rules-based */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={LABEL}>Briefing</span>
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
        {genBriefing.isError && (
          <p className="mt-2 text-xs text-bad">
            {(genBriefing.error as Error).message}
          </p>
        )}
      </section>

      {/* Today's plan — focus (the "why") sits atop Claude's time-blocks (the "when") */}
      {(aiOn || data.todaysFocus) && (
        <section className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className={LABEL}>{aiOn ? "Day plan" : "Today's focus"}</span>
            {aiOn && (
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
            )}
          </div>

          {data.todaysFocus && (
            <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-accent/40 bg-accent/10 p-3">
              <Target
                className="mt-0.5 h-4 w-4 shrink-0 text-accent"
                strokeWidth={2.5}
              />
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                  Today's focus
                </div>
                <p className="mt-0.5 text-sm leading-relaxed text-text">
                  {data.todaysFocus}
                </p>
              </div>
            </div>
          )}

          {aiOn &&
            (plan.data?.text ? (
              <DayPlanBlocks text={plan.data.text} />
            ) : (
              <p className="text-sm text-muted">
                Let Claude block out your day around your focus, tasks, training,
                and goals.
              </p>
            ))}
          {genPlan.isError && (
            <p className="mt-2 text-xs text-bad">
              {(genPlan.error as Error).message}
            </p>
          )}
        </section>
      )}

      <QuickLogRow defaultKg={data.latestBodyweightKg} />

      {/* Top priorities */}
      <section>
        <div className="mb-1 flex items-baseline justify-between">
          <span className={LABEL}>Top priorities</span>
          <Link to="/tasks" className="text-xs text-accent active:opacity-70">
            {data.openTaskCount} open →
          </Link>
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
            <div className={LABEL}>Training today</div>
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
          <h2 className={`mb-2 ${LABEL}`}>Habits</h2>
          <HabitsRow habits={data.habits} />
        </section>
      )}

      {/* Show more — secondary macros, stats, and the weekly review */}
      <div>
        <button
          onClick={() => setShowMore((o) => !o)}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-line bg-surface py-3 text-sm font-medium text-muted active:bg-surface-2"
        >
          {showMore ? "Show less" : "Show more"}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${showMore ? "rotate-180" : ""}`}
            strokeWidth={2}
          />
        </button>

        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            showMore ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="space-y-5 pt-5">
              {/* Macro breakdown */}
              <section className="rounded-2xl border border-line bg-surface p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className={LABEL}>Macros</span>
                  <Link
                    to="/meals"
                    className="text-xs font-medium text-accent active:opacity-70"
                  >
                    Food log →
                  </Link>
                </div>
                <div className="space-y-3">
                  <MacroBar
                    label="Calories"
                    consumed={n.calories.consumed}
                    target={n.calories.target}
                    unit=" kcal"
                  />
                  <MacroBar
                    label="Carbs"
                    consumed={n.carbs.consumed}
                    target={n.carbs.target}
                  />
                  <MacroBar
                    label="Fat"
                    consumed={n.fat.consumed}
                    target={n.fat.target}
                  />
                </div>
              </section>

              {/* At a glance */}
              <section className="grid grid-cols-2 gap-3">
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
                  label="Steps"
                  value={data.steps != null ? data.steps.toLocaleString() : "—"}
                  sub="today"
                  soon={data.steps == null}
                />
                <StatCard
                  label="Burned"
                  value={
                    data.caloriesOut != null
                      ? data.caloriesOut.toLocaleString()
                      : "—"
                  }
                  sub="so far today"
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

              {/* AI weekly review (moved here from Money) */}
              <WeeklyReview />
            </div>
          </div>
        </div>
      </div>

      <WorkoutSheet
        open={workoutOpen}
        onClose={() => setWorkoutOpen(false)}
        defaultTitle={data.plannedWorkout ?? undefined}
      />
    </div>
  );
}

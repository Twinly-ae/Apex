import { ChevronRight, Trash2, Trophy } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { Workout, WorkoutSet } from "@apex/shared";
import {
  AdherenceChart,
  BodyweightChart,
  E1rmChart,
  EnergyChart,
  HrvChart,
  RestingHrChart,
  SleepChart,
  SleepStagesChart,
  TrainingChart,
} from "../components/Charts";
import { selectClass } from "../components/ui/Sheet";
import { StatCard } from "../components/StatCard";
import { TrainingPlanEditor } from "../components/TrainingPlanEditor";
import { HealthSyncCard } from "../components/health/HealthSyncCard";
import { Wellbeing } from "../components/health/Wellbeing";
import { WorkoutSheet } from "../components/logging/WorkoutSheet";
import { kg } from "../lib/format";
import {
  useDeleteWorkout,
  useExerciseProgression,
  useGenerateHealthTips,
  useHealth,
  useHealthTips,
  usePrs,
  useSyncHevy,
  useTrends,
  useWorkouts,
} from "../lib/queries";

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function workoutVolume(w: Workout): number {
  return w.sets.reduce((s, set) => s + (set.weightKg ?? 0) * (set.reps ?? 0), 0);
}

/** Group flat sets back into their exercises, preserving order. */
function groupByExercise(sets: WorkoutSet[]): [string, WorkoutSet[]][] {
  const map = new Map<string, WorkoutSet[]>();
  for (const s of [...sets].sort((a, b) => a.order - b.order)) {
    const list = map.get(s.exercise);
    if (list) list.push(s);
    else map.set(s.exercise, [s]);
  }
  return [...map.entries()];
}

/** A workout row that expands to show its exercises, weights, and reps. */
function WorkoutRow({ w, onDelete }: { w: Workout; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const hasDetail = w.sets.length > 0;
  return (
    <li className="py-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => hasDetail && setOpen((o) => !o)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {hasDetail ? (
            <ChevronRight
              className={`h-4 w-4 shrink-0 text-muted transition-transform ${
                open ? "rotate-90" : ""
              }`}
              strokeWidth={2}
            />
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <span className="flex-1">
            <span className="flex items-center gap-2">
              <span className="text-text">{w.title}</span>
              {w.source === "hevy" && (
                <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                  Hevy
                </span>
              )}
            </span>
            <span className="block text-xs text-muted">
              {new Date(w.performedAt).toLocaleDateString()} · {w.sets.length} sets
              · {Math.round(workoutVolume(w))} kg volume
            </span>
          </span>
        </button>
        <button
          onClick={onDelete}
          className="-m-2 p-2 text-muted hover:text-bad"
          aria-label="Delete workout"
        >
          <Trash2 className="h-[18px] w-[18px]" strokeWidth={2} />
        </button>
      </div>

      {open && (
        <div className="ml-6 mt-2 space-y-2 rounded-xl bg-surface-2 p-3">
          {groupByExercise(w.sets).map(([exercise, sets]) => (
            <div key={exercise}>
              <div className="text-sm font-medium text-text">{exercise}</div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums text-muted">
                {sets.map((s, i) => (
                  <span key={s.id}>
                    {i + 1}. {s.weightKg != null ? `${s.weightKg} kg` : "BW"}
                    {s.reps != null ? ` × ${s.reps}` : ""}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

function StrengthHistory() {
  const { data: prs } = usePrs();
  const [exercise, setExercise] = useState<string | null>(null);
  const active = exercise ?? prs?.[0]?.exercise ?? null;
  const { data: points } = useExerciseProgression(active);
  if (!prs || prs.length === 0) return null;

  return (
    <ChartCard title="Strength history">
      <select
        value={active ?? ""}
        onChange={(e) => setExercise(e.target.value)}
        className={`${selectClass} mb-3`}
      >
        {prs.map((p) => (
          <option key={p.exercise} value={p.exercise}>
            {p.exercise}
          </option>
        ))}
      </select>
      <E1rmChart data={points ?? []} />
      <p className="mt-2 text-xs text-muted">
        Best set per day as estimated 1RM — an upward line means you're getting
        stronger.
      </p>
    </ChartCard>
  );
}

function PersonalRecords() {
  const { data: prs } = usePrs();
  const [showAll, setShowAll] = useState(false);
  const list = prs ?? [];
  if (list.length === 0) return null;
  const shown = showAll ? list : list.slice(0, 6);

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
          <Trophy className="h-3.5 w-3.5 text-warn" strokeWidth={2} />
          Personal records
        </h2>
        {list.length > 6 && (
          <button
            onClick={() => setShowAll((o) => !o)}
            className="text-xs text-accent active:opacity-70"
          >
            {showAll ? "Show less" : `All ${list.length}`}
          </button>
        )}
      </div>
      <ul className="divide-y divide-line">
        {shown.map((p) => (
          <li key={p.exercise} className="flex items-center gap-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-text">
              {p.exercise}
            </span>
            <span className="shrink-0 tabular-nums text-text">
              {p.weightKg}kg × {p.reps}
            </span>
            <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted">
              1RM ~{Math.round(p.e1rmKg)}kg
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-muted">
        Beating any of these sends you a “New PR” push.
      </p>
    </section>
  );
}

function HealthTips() {
  const tips = useHealthTips();
  const gen = useGenerateHealthTips();
  const configured = tips.data?.configured ?? false;
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          Coach tips
        </h2>
        {configured && (
          <button
            onClick={() => gen.mutate()}
            disabled={gen.isPending}
            className="text-xs text-accent active:opacity-70 disabled:opacity-50"
          >
            {gen.isPending
              ? "Thinking…"
              : tips.data?.text
                ? "Refresh"
                : "Get tips"}
          </button>
        )}
      </div>
      {!configured ? (
        <p className="text-sm text-muted">
          Set <code className="text-text">ANTHROPIC_API_KEY</code> on the API for
          AI recovery, sleep, and stress tips.
        </p>
      ) : tips.data?.text ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
          {tips.data.text}
        </p>
      ) : (
        <p className="text-sm text-muted">
          Get 3 specific tips to improve your recovery, sleep, and strain from
          your real data.
        </p>
      )}
      {gen.isError && (
        <p className="mt-2 text-xs text-bad">{(gen.error as Error).message}</p>
      )}
    </section>
  );
}

export function Health() {
  const { data: trends, isLoading } = useTrends();
  const { data: workouts } = useWorkouts();
  const { data: health } = useHealth();
  const delWorkout = useDeleteWorkout();
  const syncHevy = useSyncHevy();
  const [logOpen, setLogOpen] = useState(false);
  const [view, setView] = useState<"overview" | "charts">("overview");

  const latestBw = trends?.bodyweight.at(-1)?.kg ?? null;
  const firstBw = trends?.bodyweight[0]?.kg ?? null;
  const bwChange =
    latestBw != null && firstBw != null
      ? Math.round((latestBw - firstBw) * 10) / 10
      : null;
  const thisWeek = trends?.training.at(-1);

  if (isLoading || !trends) {
    return (
      <div className="space-y-4">
        <div className="h-20 animate-pulse rounded-2xl bg-surface" />
        <div className="h-48 animate-pulse rounded-2xl bg-surface" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight text-text">Health</h1>
        <div className="flex rounded-full border border-line bg-surface p-0.5 text-sm">
          <button
            onClick={() => setView("overview")}
            className={`rounded-full px-3.5 py-1.5 font-medium transition-colors ${
              view === "overview" ? "bg-accent text-white" : "text-muted"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setView("charts")}
            className={`rounded-full px-3.5 py-1.5 font-medium transition-colors ${
              view === "charts" ? "bg-accent text-white" : "text-muted"
            }`}
          >
            Charts
          </button>
        </div>
      </header>

      {view === "overview" && (
        <>
      {/* Wellbeing rings — sleep / recovery / stress, tap for detail */}
      <Wellbeing health={health} />

      {/* Apple Health bridge diagnostic — shows why scores may be blank */}
      <HealthSyncCard />

      <HealthTips />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Streak" value={`${trends.trainingStreak}d`} sub="on plan" />
        <StatCard label="This week" value={thisWeek?.sessions ?? 0} sub="sessions" />
        <StatCard
          label="Weight"
          value={kg(latestBw)}
          sub={bwChange == null ? "—" : `${bwChange > 0 ? "+" : ""}${bwChange} kg`}
        />
      </div>

      <ChartCard title="Apple Health · today">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Steps"
            value={health?.steps != null ? health.steps.toLocaleString() : "—"}
          />
          <StatCard
            label="Active energy"
            value={
              health?.activeEnergyKcal != null
                ? `${health.activeEnergyKcal} kcal`
                : "—"
            }
          />
          <StatCard
            label="Resting HR"
            value={health?.restingHr != null ? `${health.restingHr} bpm` : "—"}
          />
          <StatCard
            label="Sleep"
            value={health?.sleepHours != null ? `${health.sleepHours} h` : "—"}
          />
        </div>
        {!health?.updatedAt && (
          <p className="mt-3 text-xs text-muted">
            Connect Apple Health in Settings → Apple Health to pull steps, sleep,
            and heart rate.
          </p>
        )}
      </ChartCard>

      <PersonalRecords />

      <ChartCard title="Weekly split">
        <TrainingPlanEditor />
      </ChartCard>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Recent workouts
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => syncHevy.mutate()}
              disabled={syncHevy.isPending}
              className="rounded-xl bg-surface-2 px-3 py-1.5 text-sm text-text active:opacity-80"
            >
              {syncHevy.isPending ? "Syncing…" : "Sync Hevy"}
            </button>
            <button
              onClick={() => setLogOpen(true)}
              className="rounded-xl bg-accent px-3 py-1.5 text-sm font-semibold text-white active:opacity-80"
            >
              + Log
            </button>
          </div>
        </div>
        {syncHevy.data && (
          <p className="mb-2 text-xs text-muted">
            {syncHevy.data.message
              ? syncHevy.data.message
              : `Imported ${syncHevy.data.imported} new workout${
                  syncHevy.data.imported === 1 ? "" : "s"
                } (${syncHevy.data.total} found in Hevy).`}
          </p>
        )}
        {(workouts ?? []).length === 0 ? (
          <p className="py-3 text-sm text-muted">No workouts logged yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {(workouts ?? []).map((w) => (
              <WorkoutRow key={w.id} w={w} onDelete={() => delWorkout.mutate(w.id)} />
            ))}
          </ul>
        )}
      </section>
        </>
      )}

      {view === "charts" && (
        <>
          <ChartCard title="Bodyweight">
            <BodyweightChart data={trends.bodyweight} />
          </ChartCard>

          {(health?.sleepStages.length ?? 0) > 1 ? (
            <ChartCard title="Sleep stages (14d)">
              <SleepStagesChart data={health?.sleepStages ?? []} />
            </ChartCard>
          ) : (
            (health?.sleepSeries.length ?? 0) > 1 && (
              <ChartCard title="Sleep (14d)">
                <SleepChart data={health?.sleepSeries ?? []} />
              </ChartCard>
            )
          )}

          {(health?.hrvSeries.length ?? 0) > 1 && (
            <ChartCard title="HRV (14d)">
              <HrvChart
                data={health?.hrvSeries ?? []}
                baseline={health?.hrvBaseline ?? null}
              />
            </ChartCard>
          )}

          {(health?.rhrSeries.length ?? 0) > 1 && (
            <ChartCard title="Resting heart rate (14d)">
              <RestingHrChart data={health?.rhrSeries ?? []} />
            </ChartCard>
          )}

          <ChartCard title="Calories vs target (14d)">
            <AdherenceChart data={trends.adherence} />
          </ChartCard>

          <ChartCard title="Calories in vs out (14d)">
            <EnergyChart data={health?.energySeries ?? []} />
          </ChartCard>

          <StrengthHistory />

          <ChartCard title="Training volume / week">
            <TrainingChart data={trends.training} />
          </ChartCard>

          {(health?.sleepSeries.length ?? 0) <= 1 &&
            (health?.rhrSeries.length ?? 0) <= 1 && (
              <p className="px-1 text-xs text-muted">
                Sleep and resting-HR charts appear once Apple Health has a few
                days of data.
              </p>
            )}
        </>
      )}

      <WorkoutSheet open={logOpen} onClose={() => setLogOpen(false)} />
    </div>
  );
}

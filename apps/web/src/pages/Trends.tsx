import { type ReactNode, useState } from "react";
import type { Workout } from "@apex/shared";
import {
  AdherenceChart,
  BodyweightChart,
  TrainingChart,
} from "../components/Charts";
import { StatCard } from "../components/StatCard";
import { TrainingPlanEditor } from "../components/TrainingPlanEditor";
import { WorkoutSheet } from "../components/logging/WorkoutSheet";
import { kg } from "../lib/format";
import {
  useDeleteWorkout,
  useMetricsSummary,
  useSyncHevy,
  useTrends,
  useWorkouts,
} from "../lib/queries";

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
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

function workoutVolume(w: Workout): number {
  return w.sets.reduce((s, set) => s + (set.weightKg ?? 0) * (set.reps ?? 0), 0);
}

export function Trends() {
  const { data: trends, isLoading } = useTrends();
  const { data: workouts } = useWorkouts();
  const { data: metrics } = useMetricsSummary();
  const delWorkout = useDeleteWorkout();
  const syncHevy = useSyncHevy();
  const [logOpen, setLogOpen] = useState(false);

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
      <h1 className="text-2xl font-semibold text-text">Trends</h1>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Streak" value={`${trends.trainingStreak}d`} sub="on plan" />
        <StatCard label="This week" value={thisWeek?.sessions ?? 0} sub="sessions" />
        <StatCard
          label="Weight"
          value={kg(latestBw)}
          sub={
            bwChange == null
              ? "—"
              : `${bwChange > 0 ? "+" : ""}${bwChange} kg`
          }
        />
      </div>

      <ChartCard title="Apple Health · today">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Steps"
            value={metrics?.steps != null ? metrics.steps.toLocaleString() : "—"}
          />
          <StatCard
            label="Active energy"
            value={
              metrics?.activeEnergyKcal != null
                ? `${metrics.activeEnergyKcal} kcal`
                : "—"
            }
          />
          <StatCard
            label="Resting HR"
            value={metrics?.restingHr != null ? `${metrics.restingHr} bpm` : "—"}
          />
          <StatCard
            label="Sleep"
            value={metrics?.sleepHours != null ? `${metrics.sleepHours} h` : "—"}
          />
        </div>
        {!metrics?.updatedAt && (
          <p className="mt-3 text-xs text-muted">
            Connect Apple Health: point Health Auto Export at{" "}
            <code className="text-text">/api/ingest/health</code> with your token.
          </p>
        )}
      </ChartCard>

      <ChartCard title="Bodyweight">
        <BodyweightChart data={trends.bodyweight} />
      </ChartCard>

      <ChartCard title="Calories vs target (14d)">
        <AdherenceChart data={trends.adherence} />
      </ChartCard>

      <ChartCard title="Training volume / week">
        <TrainingChart data={trends.training} />
      </ChartCard>

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
            {syncHevy.data.connected
              ? `Imported ${syncHevy.data.imported} new workouts.`
              : syncHevy.data.message}
          </p>
        )}
        {(workouts ?? []).length === 0 ? (
          <p className="py-3 text-sm text-muted">No workouts logged yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {(workouts ?? []).map((w) => (
              <li key={w.id} className="flex items-center gap-3 py-3">
                <div className="flex-1">
                  <div className="text-text">{w.title}</div>
                  <div className="text-xs text-muted">
                    {new Date(w.performedAt).toLocaleDateString()} · {w.sets.length}{" "}
                    sets · {Math.round(workoutVolume(w))} kg volume
                  </div>
                </div>
                <button
                  onClick={() => delWorkout.mutate(w.id)}
                  className="-m-2 p-2 text-muted hover:text-bad"
                  aria-label="Delete workout"
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <WorkoutSheet open={logOpen} onClose={() => setLogOpen(false)} />
    </div>
  );
}

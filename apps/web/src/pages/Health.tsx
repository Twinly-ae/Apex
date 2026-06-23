import { ChevronRight, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { Workout, WorkoutSet } from "@apex/shared";
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
  useHealth,
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

/** A circular 0–100 gauge. Stress is inverted (high = bad). */
function ScoreRing({
  label,
  value,
  invert,
}: {
  label: string;
  value: number | null;
  invert?: boolean;
}) {
  const v = value ?? 0;
  const r = 30;
  const circ = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, v)) / 100) * circ;
  const good = invert ? v <= 33 : v >= 75;
  const bad = invert ? v >= 67 : v < 50;
  const color =
    value == null ? "#3a3a48" : good ? "#34d399" : bad ? "#fb7185" : "#fbbf24";
  return (
    <div className="flex flex-col items-center">
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={r} fill="none" stroke="#2a2a3a" strokeWidth="7" />
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform="rotate(-90 42 42)"
        />
        <text
          x="42"
          y="48"
          textAnchor="middle"
          fontSize="20"
          fontWeight="600"
          fill="#ececf1"
        >
          {value == null ? "—" : v}
        </text>
      </svg>
      <span className="mt-1 text-xs text-muted">{label}</span>
    </div>
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

export function Health() {
  const { data: trends, isLoading } = useTrends();
  const { data: workouts } = useWorkouts();
  const { data: health } = useHealth();
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
      <h1 className="text-2xl font-semibold text-text">Health</h1>

      {/* Recovery scores */}
      <section className="rounded-2xl border border-line bg-gradient-to-br from-surface to-surface-2 p-4">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
          Recovery today
        </h2>
        {health?.hasData ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <ScoreRing label="Sleep" value={health.scores.sleep} />
              <ScoreRing label="Recovery" value={health.scores.recovery} />
              <ScoreRing label="Stress" value={health.scores.stress} invert />
            </div>
            <p className="mt-3 text-center text-xs text-muted">
              {health.sleepHours != null
                ? `Slept ${health.sleepHours}h`
                : "No sleep data"}
              {health.restingHr != null &&
                ` · Resting HR ${health.restingHr}${
                  health.hrBaseline != null ? ` (avg ${health.hrBaseline})` : ""
                } bpm`}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">
            Connect Apple Health (Settings → Apple Health) to see sleep, recovery,
            and stress scores.
          </p>
        )}
      </section>

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

      <WorkoutSheet open={logOpen} onClose={() => setLogOpen(false)} />
    </div>
  );
}

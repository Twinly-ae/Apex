import type {
  EnergyPoint,
  HealthPoint,
  HealthResponse,
  HealthSummary,
} from "@apex/shared";
import { prisma } from "../db";
import { dayBefore, dayString } from "./time";

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

const sleepScoreOf = (hours: number | null): number | null =>
  hours == null ? null : Math.round(clamp((hours / 8) * 100, 0, 100));

/** Recovery 0–100: blends sleep with resting HR vs a baseline. */
function recoveryOf(
  hours: number | null,
  rhr: number | null,
  baseline: number | null,
): number | null {
  const sleep = sleepScoreOf(hours);
  const hrComp =
    rhr != null && baseline != null
      ? clamp(100 - (rhr - baseline) * 5, 0, 100)
      : null;
  if (sleep != null && hrComp != null) return Math.round(0.5 * sleep + 0.5 * hrComp);
  if (sleep != null) return sleep;
  if (hrComp != null) return Math.round(hrComp);
  return null;
}

/**
 * Derive 0–100 sleep / recovery / stress scores from ingested Apple Health
 * data, plus 14-day sleep & resting-HR series. Heuristic but principled:
 * - Sleep: hours vs an 8h target.
 * - Recovery: blends sleep with resting HR relative to a 30-day baseline
 *   (a lower-than-usual resting HR means you're well recovered).
 * - Stress: rises with an elevated resting HR and sleep debt.
 */
export async function computeHealth(
  userId: string,
  day: string = dayString(),
): Promise<HealthResponse> {
  const since = dayString(dayBefore(29));
  const since14 = dayString(dayBefore(13));
  const [rows, settings, meals, workouts] = await Promise.all([
    prisma.healthMetric.findMany({
      where: {
        userId,
        day: { gte: since },
        type: { in: ["resting_hr", "sleep_hours", "steps", "active_energy"] },
      },
    }),
    prisma.settings.findUnique({ where: { userId } }),
    prisma.meal.findMany({
      where: { userId, eatenAt: { gte: new Date(`${since14}T00:00:00.000Z`) } },
      select: { eatenAt: true, calories: true },
    }),
    prisma.workout.findMany({
      where: {
        userId,
        performedAt: { gte: new Date(`${since14}T00:00:00.000Z`) },
      },
      select: { performedAt: true },
    }),
  ]);

  // Per-day rollups: resting HR = latest reading, sleep = sum, active = sum.
  const rhrByDay = new Map<string, number>();
  const rhrAtByDay = new Map<string, Date>();
  const sleepByDay = new Map<string, number>();
  const activeByDay = new Map<string, number>();
  for (const m of rows) {
    if (m.type === "resting_hr") {
      const prev = rhrAtByDay.get(m.day);
      if (!prev || m.startAt > prev) {
        rhrAtByDay.set(m.day, m.startAt);
        rhrByDay.set(m.day, m.value);
      }
    } else if (m.type === "sleep_hours") {
      sleepByDay.set(m.day, (sleepByDay.get(m.day) ?? 0) + m.value);
    } else if (m.type === "active_energy") {
      activeByDay.set(m.day, (activeByDay.get(m.day) ?? 0) + m.value);
    }
  }

  const caloriesByDay = new Map<string, number>();
  for (const m of meals) {
    const d = dayString(m.eatenAt);
    caloriesByDay.set(d, (caloriesByDay.get(d) ?? 0) + m.calories);
  }
  const workoutsByDay = new Map<string, number>();
  for (const w of workouts) {
    const d = dayString(w.performedAt);
    workoutsByDay.set(d, (workoutsByDay.get(d) ?? 0) + 1);
  }

  // 30-day resting-HR baseline (exclude today so a bad night stands out).
  const baseValues = [...rhrByDay.entries()]
    .filter(([d]) => d !== day)
    .map(([, v]) => v);
  const hrBaseline = baseValues.length
    ? Math.round(baseValues.reduce((s, v) => s + v, 0) / baseValues.length)
    : null;

  const restingHr = rhrByDay.has(day) ? Math.round(rhrByDay.get(day) as number) : null;
  const sleepHours = sleepByDay.has(day)
    ? Math.round((sleepByDay.get(day) as number) * 10) / 10
    : null;

  // ---- Scores -------------------------------------------------------------
  const sleepScore =
    sleepHours == null ? null : Math.round(clamp((sleepHours / 8) * 100, 0, 100));

  const hrComponent =
    restingHr != null && hrBaseline != null
      ? clamp(100 - (restingHr - hrBaseline) * 5, 0, 100)
      : null;

  let recovery: number | null = null;
  if (sleepScore != null && hrComponent != null) {
    recovery = Math.round(0.5 * sleepScore + 0.5 * hrComponent);
  } else if (sleepScore != null) {
    recovery = sleepScore;
  } else if (hrComponent != null) {
    recovery = Math.round(hrComponent);
  }

  let stress: number | null = null;
  if (restingHr != null || sleepHours != null) {
    const hrPart =
      restingHr != null && hrBaseline != null
        ? Math.max(0, restingHr - hrBaseline) * 6
        : 0;
    const sleepPart = sleepHours != null ? Math.max(0, 7.5 - sleepHours) * 8 : 0;
    stress = Math.round(clamp(hrPart + sleepPart, 0, 100));
  }

  // ---- 14-day series ------------------------------------------------------
  const sleepSeries: HealthPoint[] = [];
  const rhrSeries: HealthPoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = dayString(dayBefore(i));
    if (sleepByDay.has(d)) {
      sleepSeries.push({ date: d, value: Math.round((sleepByDay.get(d) as number) * 10) / 10 });
    }
    if (rhrByDay.has(d)) {
      rhrSeries.push({ date: d, value: Math.round(rhrByDay.get(d) as number) });
    }
  }

  // ---- 7-day wellbeing averages ------------------------------------------
  let sleepSum = 0;
  let sleepN = 0;
  let rhrSum = 0;
  let rhrN = 0;
  let recSum = 0;
  let recN = 0;
  for (let i = 0; i < 7; i++) {
    const d = dayString(dayBefore(i));
    const sh = sleepByDay.get(d) ?? null;
    const hr = rhrByDay.get(d) ?? null;
    if (sh != null) {
      sleepSum += sh;
      sleepN += 1;
    }
    if (hr != null) {
      rhrSum += hr;
      rhrN += 1;
    }
    const rec = recoveryOf(sh, hr, hrBaseline);
    if (rec != null) {
      recSum += rec;
      recN += 1;
    }
  }
  const weekly = {
    avgSleepHours: sleepN ? Math.round((sleepSum / sleepN) * 10) / 10 : null,
    avgRecovery: recN ? Math.round(recSum / recN) : null,
    avgRestingHr: rhrN ? Math.round(rhrSum / rhrN) : null,
    nights: sleepN,
  };

  // ---- 14-day energy in (food) vs out (maintenance + activity) -----------
  const maintenance = settings?.maintenanceCalories ?? 2600;
  const energySeries: EnergyPoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = dayString(dayBefore(i));
    const kcalIn = Math.round(caloriesByDay.get(d) ?? 0);
    if (kcalIn <= 0) continue; // only days you actually logged food
    const active = activeByDay.get(d) ?? 0;
    const workoutEst = active > 0 ? 0 : (workoutsByDay.get(d) ?? 0) * 250;
    energySeries.push({
      date: d,
      kcalIn,
      kcalOut: Math.round(maintenance + active + workoutEst),
    });
  }

  const summary = await healthSummary(userId, day);

  return {
    day,
    scores: { sleep: sleepScore, recovery, stress },
    steps: summary.steps,
    activeEnergyKcal: summary.activeEnergyKcal,
    restingHr,
    hrBaseline,
    sleepHours,
    sleepSeries,
    rhrSeries,
    weekly,
    energySeries,
    updatedAt: summary.updatedAt,
    hasData: restingHr != null || sleepHours != null || summary.steps != null,
  };
}

/** Roll up a day's ingested Apple Health metrics into the Today/summary shape. */
export async function healthSummary(
  userId: string,
  day: string = dayString(),
): Promise<HealthSummary> {
  const metrics = await prisma.healthMetric.findMany({
    where: { userId, day },
  });

  const sum = (type: string): number | null => {
    const rows = metrics.filter((m) => m.type === type);
    return rows.length ? Math.round(rows.reduce((s, m) => s + m.value, 0)) : null;
  };
  const latest = (type: string): number | null => {
    const rows = metrics
      .filter((m) => m.type === type)
      .sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
    return rows[0] ? Math.round(rows[0].value) : null;
  };

  let updatedAt: Date | null = null;
  for (const m of metrics) {
    if (!updatedAt || m.createdAt > updatedAt) updatedAt = m.createdAt;
  }

  const sleep = metrics.filter((m) => m.type === "sleep_hours");
  return {
    day,
    steps: sum("steps"),
    activeEnergyKcal: sum("active_energy"),
    restingHr: latest("resting_hr"),
    sleepHours: sleep.length
      ? Math.round(sleep.reduce((s, m) => s + m.value, 0) * 10) / 10
      : null,
    updatedAt: updatedAt ? updatedAt.toISOString() : null,
  };
}

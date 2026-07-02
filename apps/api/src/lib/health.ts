import type {
  EnergyPoint,
  HealthPoint,
  HealthResponse,
  HealthSummary,
  SleepStagePoint,
} from "@apex/shared";
import { prisma } from "../db";
import { dayBefore, dayString } from "./time";

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

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
        type: {
          in: [
            "resting_hr",
            "sleep_hours",
            "steps",
            "active_energy",
            "hrv",
            "respiratory_rate",
            "sleep_rem",
            "sleep_deep",
            "sleep_core",
            "sleep_awake",
            "sleep_in_bed",
          ],
        },
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
      select: { performedAt: true, _count: { select: { sets: true } } },
    }),
  ]);

  // Per-day rollups: resting HR = latest reading, sleep = sum, active = sum.
  const rhrByDay = new Map<string, number>();
  const rhrAtByDay = new Map<string, Date>();
  const sleepByDay = new Map<string, number>();
  const activeByDay = new Map<string, number>();
  const stepsByDay = new Map<string, number>();
  const remByDay = new Map<string, number>();
  const deepByDay = new Map<string, number>();
  const coreByDay = new Map<string, number>();
  const awakeByDay = new Map<string, number>();
  const inBedByDay = new Map<string, number>();
  // HRV & respiratory rate are averaged per day (sum + count).
  const hrvSum = new Map<string, number>();
  const hrvCnt = new Map<string, number>();
  const respSum = new Map<string, number>();
  const respCnt = new Map<string, number>();
  const addAvg = (
    sum: Map<string, number>,
    cnt: Map<string, number>,
    day: string,
    v: number,
  ) => {
    sum.set(day, (sum.get(day) ?? 0) + v);
    cnt.set(day, (cnt.get(day) ?? 0) + 1);
  };
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
    } else if (m.type === "steps") {
      stepsByDay.set(m.day, (stepsByDay.get(m.day) ?? 0) + m.value);
    } else if (m.type === "sleep_rem") {
      remByDay.set(m.day, (remByDay.get(m.day) ?? 0) + m.value);
    } else if (m.type === "sleep_deep") {
      deepByDay.set(m.day, (deepByDay.get(m.day) ?? 0) + m.value);
    } else if (m.type === "sleep_core") {
      coreByDay.set(m.day, (coreByDay.get(m.day) ?? 0) + m.value);
    } else if (m.type === "sleep_awake") {
      awakeByDay.set(m.day, (awakeByDay.get(m.day) ?? 0) + m.value);
    } else if (m.type === "sleep_in_bed") {
      inBedByDay.set(m.day, (inBedByDay.get(m.day) ?? 0) + m.value);
    } else if (m.type === "hrv") {
      addAvg(hrvSum, hrvCnt, m.day, m.value);
    } else if (m.type === "respiratory_rate") {
      addAvg(respSum, respCnt, m.day, m.value);
    }
  }
  const hrvByDay = new Map<string, number>();
  for (const [d, sum] of hrvSum) hrvByDay.set(d, sum / (hrvCnt.get(d) ?? 1));
  const respByDay = new Map<string, number>();
  for (const [d, sum] of respSum) respByDay.set(d, sum / (respCnt.get(d) ?? 1));

  const caloriesByDay = new Map<string, number>();
  for (const m of meals) {
    const d = dayString(m.eatenAt);
    caloriesByDay.set(d, (caloriesByDay.get(d) ?? 0) + m.calories);
  }
  const workoutsByDay = new Map<string, number>();
  const setsByDay = new Map<string, number>();
  for (const w of workouts) {
    const d = dayString(w.performedAt);
    workoutsByDay.set(d, (workoutsByDay.get(d) ?? 0) + 1);
    setsByDay.set(d, (setsByDay.get(d) ?? 0) + w._count.sets);
  }

  // 30-day resting-HR baseline (exclude today so a bad night stands out).
  const baseValues = [...rhrByDay.entries()]
    .filter(([d]) => d !== day)
    .map(([, v]) => v);
  const hrBaseline = baseValues.length
    ? Math.round(baseValues.reduce((s, v) => s + v, 0) / baseValues.length)
    : null;

  const restingHr = rhrByDay.has(day) ? Math.round(rhrByDay.get(day) as number) : null;
  const sleepHours = sleepByDay.has(day) ? round1(sleepByDay.get(day) as number) : null;
  const daySteps = stepsByDay.has(day) ? Math.round(stepsByDay.get(day) as number) : null;
  const dayActive = activeByDay.has(day) ? Math.round(activeByDay.get(day) as number) : null;
  const daySets = setsByDay.get(day) ?? 0;
  const dayWorkouts = workoutsByDay.get(day) ?? 0;

  // Sleep architecture (hours) + efficiency, when the watch reports stages.
  const remHours = remByDay.has(day) ? round1(remByDay.get(day) as number) : null;
  const deepHours = deepByDay.has(day) ? round1(deepByDay.get(day) as number) : null;
  const awakeHours = awakeByDay.has(day) ? round1(awakeByDay.get(day) as number) : null;
  const inBedHours = inBedByDay.has(day) ? round1(inBedByDay.get(day) as number) : null;
  const sleepEfficiency =
    sleepHours != null && inBedHours != null && inBedHours > 0
      ? Math.round(clamp((sleepHours / inBedHours) * 100, 0, 100))
      : null;

  // HRV (autonomic recovery) + its 30-day baseline, and respiratory rate.
  const hrv = hrvByDay.has(day) ? Math.round(hrvByDay.get(day) as number) : null;
  const hrvBase = [...hrvByDay.entries()].filter(([d]) => d !== day).map(([, v]) => v);
  const hrvBaseline = hrvBase.length
    ? Math.round(hrvBase.reduce((s, v) => s + v, 0) / hrvBase.length)
    : null;
  const respiratoryRate = respByDay.has(day) ? round1(respByDay.get(day) as number) : null;
  const respBase = [...respByDay.entries()].filter(([d]) => d !== day).map(([, v]) => v);
  const respBaseline = respBase.length
    ? respBase.reduce((s, v) => s + v, 0) / respBase.length
    : null;

  // ---- Daily load components (feed strain, and dampen recovery) -----------
  const trainingLoad =
    daySets > 0 ? Math.min(45, daySets * 2.5) : Math.min(45, dayWorkouts * 30);
  const activityLoad = Math.min(
    30,
    (daySteps != null ? (daySteps / 10_000) * 20 : 0) +
      (dayActive != null ? (dayActive / 500) * 10 : 0),
  );
  const hrStrain =
    restingHr != null && hrBaseline != null
      ? Math.min(25, Math.max(0, restingHr - hrBaseline) * 5)
      : 0;
  const sleepDebt =
    sleepHours != null ? Math.min(25, Math.max(0, 7.5 - sleepHours) * 7) : 0;
  // Suppressed HRV (below baseline) signals the body is still under load.
  const hrvStrain =
    hrv != null && hrvBaseline != null && hrv < hrvBaseline
      ? Math.min(15, ((hrvBaseline - hrv) / hrvBaseline) * 60)
      : 0;

  // ---- Sleep score: duration + efficiency + REM + deep − restlessness -----
  let sleepScore: number | null = null;
  if (sleepHours != null) {
    const comps: { w: number; v: number }[] = [
      { w: 0.45, v: clamp((sleepHours / 8) * 100, 0, 100) },
    ];
    if (sleepEfficiency != null) {
      comps.push({ w: 0.2, v: clamp((sleepEfficiency - 75) * 5, 0, 100) });
    }
    if (remHours != null && sleepHours > 0) {
      const remFrac = remHours / sleepHours; // ideal ≈ 22%
      comps.push({ w: 0.2, v: clamp(100 - Math.abs(remFrac - 0.22) * 400, 0, 100) });
    }
    if (deepHours != null && sleepHours > 0) {
      const deepFrac = deepHours / sleepHours; // ideal ≈ 15%
      comps.push({ w: 0.15, v: clamp(100 - Math.abs(deepFrac - 0.15) * 450, 0, 100) });
    }
    const totW = comps.reduce((s, c) => s + c.w, 0);
    let s = comps.reduce((acc, c) => acc + c.w * c.v, 0) / totW;
    if (awakeHours != null) s -= Math.min(20, awakeHours * 12); // restless penalty
    sleepScore = Math.round(clamp(s, 0, 100));
  }

  // ---- Recovery: HRV vs baseline + resting HR + sleep, − strain & resp ----
  const hrvScore =
    hrv != null && hrvBaseline != null
      ? clamp(50 + (hrv / hrvBaseline - 1) * 150, 0, 100)
      : null;
  const hrComponent =
    restingHr != null && hrBaseline != null
      ? clamp(100 - (restingHr - hrBaseline) * 5, 0, 100)
      : null;
  let recovery: number | null = null;
  {
    const comps: { w: number; v: number }[] = [];
    if (hrvScore != null) comps.push({ w: 0.45, v: hrvScore });
    if (hrComponent != null) comps.push({ w: 0.3, v: hrComponent });
    if (sleepScore != null) comps.push({ w: 0.25, v: sleepScore });
    if (comps.length) {
      const totW = comps.reduce((s, c) => s + c.w, 0);
      let r = comps.reduce((acc, c) => acc + c.w * c.v, 0) / totW;
      r -= Math.min(15, trainingLoad * 0.25); // hard training lowers readiness
      if (respiratoryRate != null && respBaseline != null) {
        r -= Math.min(10, Math.max(0, respiratoryRate - respBaseline - 1) * 6);
      }
      recovery = Math.round(clamp(r, 0, 100));
    }
  }

  // ---- Strain: total load on the body today ------------------------------
  const hasLoadSignal =
    daySets > 0 ||
    dayWorkouts > 0 ||
    daySteps != null ||
    dayActive != null ||
    restingHr != null ||
    sleepHours != null ||
    hrv != null;
  const stress = hasLoadSignal
    ? Math.round(
        clamp(
          trainingLoad + activityLoad + hrStrain + sleepDebt + hrvStrain,
          0,
          100,
        ),
      )
    : null;

  // ---- 14-day series ------------------------------------------------------
  const sleepSeries: HealthPoint[] = [];
  const rhrSeries: HealthPoint[] = [];
  const hrvSeries: HealthPoint[] = [];
  const sleepStages: SleepStagePoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = dayString(dayBefore(i));
    if (sleepByDay.has(d)) {
      sleepSeries.push({ date: d, value: round1(sleepByDay.get(d) as number) });
    }
    if (rhrByDay.has(d)) {
      rhrSeries.push({ date: d, value: Math.round(rhrByDay.get(d) as number) });
    }
    if (hrvByDay.has(d)) {
      hrvSeries.push({ date: d, value: Math.round(hrvByDay.get(d) as number) });
    }
    if (remByDay.has(d) || deepByDay.has(d) || coreByDay.has(d)) {
      sleepStages.push({
        date: d,
        deep: round1(deepByDay.get(d) ?? 0),
        core: round1(coreByDay.get(d) ?? 0),
        rem: round1(remByDay.get(d) ?? 0),
        awake: round1(awakeByDay.get(d) ?? 0),
      });
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
    hrv,
    hrvBaseline,
    respiratoryRate,
    remHours,
    deepHours,
    awakeHours,
    inBedHours,
    sleepEfficiency,
    sleepSeries,
    rhrSeries,
    hrvSeries,
    sleepStages,
    weekly,
    energySeries,
    updatedAt: summary.updatedAt,
    hasData: stress != null || summary.steps != null,
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

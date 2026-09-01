import { prisma } from "../db";
import { loadGoals } from "./goals";
import { computeHealth } from "./health";
import { loadAccounts, netWorthTotal } from "./money";
import { computePrs, e1rm, progressionSummary } from "./prs";
import { STATUS_LABEL, effectiveStatus } from "./status";
import { dayRange, dayString, localWeekdayMon0 } from "./time";

/** A compact, plain-text snapshot of the user's day for the AI to reason over. */
export async function buildUserContext(userId: string): Promise<string> {
  const { start, end } = dayRange();
  const [
    settings,
    meals,
    water,
    openTasks,
    goals,
    accounts,
    latestWeight,
    health,
    plannedWorkouts,
    trainingPlan,
    timedTasks,
    recentWorkouts,
    prs,
    strengthTrend,
    notes,
  ] = await Promise.all([
    prisma.settings.findUnique({ where: { userId } }),
    prisma.meal.findMany({ where: { userId, eatenAt: { gte: start, lt: end } } }),
    prisma.waterLog.findMany({ where: { userId, loggedAt: { gte: start, lt: end } } }),
    prisma.task.findMany({
      where: { userId, done: false },
      orderBy: [{ priority: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }],
      include: { steps: { orderBy: { order: "asc" } } },
      take: 12,
    }),
    loadGoals(userId),
    loadAccounts(userId),
    prisma.bodyweightEntry.findFirst({
      where: { userId },
      orderBy: { measuredAt: "desc" },
    }),
    computeHealth(userId),
    prisma.workout.findMany({
      where: { userId, performedAt: { gte: start, lt: end } },
    }),
    prisma.trainingPlan.findUnique({ where: { userId } }),
    prisma.task.findMany({
      where: {
        userId,
        done: true,
        estMinutes: { gt: 0 },
        actualMinutes: { gt: 0 },
      },
      orderBy: { doneAt: "desc" },
      take: 20,
      select: { estMinutes: true, actualMinutes: true },
    }),
    prisma.workout.findMany({
      where: { userId },
      orderBy: { performedAt: "desc" },
      take: 4,
      include: { sets: { orderBy: { order: "asc" } } },
    }),
    computePrs(userId),
    progressionSummary(userId),
    prisma.note.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 15,
      include: { folder: { select: { name: true } } },
    }),
  ]);

  // Today's planned training split + whether it's been done.
  const status = settings ? effectiveStatus(settings) : { status: "active" as const, until: null };
  const todayLabel = trainingPlan?.days?.[localWeekdayMon0()]?.trim();
  const isRestDay = !todayLabel || /^rest$/i.test(todayLabel);
  const workoutDone = plannedWorkouts.length > 0;
  const trainingLine =
    status.status !== "active"
      ? `Training today: SKIPPED — he is ${STATUS_LABEL[status.status]}. Do NOT schedule or push training; prioritise rest, hydration and recovery food.`
      : isRestDay
        ? "Training today: REST day (no gym session planned)."
        : `Training today: ${todayLabel} day — ${
            workoutDone
              ? "already logged ✓"
              : "NOT done yet; block a ~60–75min gym session"
          }.`;
  const statusLine =
    status.status !== "active"
      ? `Activity status: ${STATUS_LABEL[status.status].toUpperCase()}${
          status.until ? ` (until ${status.until.toISOString().slice(0, 10)})` : ""
        }.`
      : null;
  const splitLine = trainingPlan?.days?.length
    ? `Weekly split (Mon→Sun): ${trainingPlan.days.join(", ")}.`
    : "Weekly split: not set.";

  // Recent sessions with exercise detail — what an actual coach needs to see.
  const workoutLines = recentWorkouts.map((w) => {
    const byExercise = new Map<string, { count: number; top: string; topScore: number }>();
    for (const s of w.sets) {
      const cur = byExercise.get(s.exercise) ?? { count: 0, top: "", topScore: -1 };
      cur.count += 1;
      if (s.reps != null && s.reps > 0) {
        const score = s.weightKg != null && s.weightKg > 0 ? e1rm(s.weightKg, s.reps) : 0;
        if (score > cur.topScore) {
          cur.topScore = score;
          cur.top = s.weightKg != null && s.weightKg > 0 ? `${s.weightKg}kg×${s.reps}` : `BW×${s.reps}`;
        }
      }
      byExercise.set(s.exercise, cur);
    }
    const detail =
      [...byExercise.entries()]
        .slice(0, 10)
        .map(([ex, d]) => `${ex} ${d.count} sets${d.top ? ` (top ${d.top})` : ""}`)
        .join("; ") || "no set detail";
    return `- ${dayString(w.performedAt)} ${w.title}${w.source === "hevy" ? " [Hevy]" : ""}: ${detail}`;
  });

  const prLine =
    prs
      .slice(0, 10)
      .map((p) => `${p.exercise} ${p.weightKg}kg×${p.reps} (~${Math.round(p.e1rmKg)}kg 1RM)`)
      .join("; ") || "none yet";

  // Open tasks with priority, estimate, due-date urgency, and any next sub-step
  // (everything the planner needs to time-block the day around real tasks).
  const today = dayString();
  let totalEstMin = 0;
  const tasksLine =
    openTasks
      .map((t) => {
        if (t.estMinutes) totalEstMin += t.estMinutes;
        const est = t.estMinutes ? ` ~${t.estMinutes}m` : "";
        const nextStep = t.steps.find((s) => !s.done);
        const step = nextStep
          ? ` (next step: ${nextStep.title}${
              nextStep.estMinutes ? ` ~${nextStep.estMinutes}m` : ""
            })`
          : "";
        let due = "";
        if (t.dueDate) {
          const d = dayString(t.dueDate);
          due = d < today ? " [OVERDUE]" : d === today ? " [due today]" : ` [due ${d}]`;
        }
        return `[P${t.priority}]${est} ${t.title}${step}${due}`;
      })
      .join("; ") || "none";
  const workloadLine = totalEstMin
    ? `Estimated open-task workload: ~${Math.round((totalEstMin / 60) * 10) / 10}h total.`
    : "Estimated open-task workload: not estimated.";

  // How his estimates compare to focus-timer reality — lets the planner pad
  // (or tighten) time blocks instead of trusting raw estimates.
  const estSum = timedTasks.reduce((s, t) => s + (t.estMinutes ?? 0), 0);
  const actSum = timedTasks.reduce((s, t) => s + (t.actualMinutes ?? 0), 0);
  const calibrationLine =
    timedTasks.length >= 3 && estSum > 0
      ? `Estimate calibration: his last ${timedTasks.length} timed tasks took ~${
          Math.round((actSum / estSum) * 10) / 10
        }x their estimates — size time blocks accordingly.`
      : null;

  const cal = Math.round(meals.reduce((s, m) => s + m.calories, 0));
  const protein = Math.round(meals.reduce((s, m) => s + m.protein, 0));
  const waterMl = water.reduce((s, w) => s + w.amountMl, 0);

  // Composite health score shown in the app — keep the coach's number in sync.
  const scoreParts = [
    health.scores.sleep,
    health.scores.recovery,
    health.scores.stress != null ? 100 - health.scores.stress : null,
  ].filter((n): n is number => n != null);
  const healthScore = scoreParts.length
    ? Math.round(scoreParts.reduce((s, n) => s + n, 0) / scoreParts.length)
    : null;

  const lines = [
    `Today: ${dayString()}.`,
    ...(statusLine ? [statusLine] : []),
    settings
      ? `Targets: ${settings.calorieTarget} kcal, ${settings.proteinTarget}g protein, ${settings.fatTarget}g fat, ${settings.carbTarget}g carbs, ${settings.waterTargetMl}ml water (recomp: lose fat + gain muscle).`
      : "Targets: not set.",
    `Eaten so far: ${cal} kcal, ${protein}g protein, ${meals.length} meals; water ${waterMl}ml.`,
    `Latest bodyweight: ${latestWeight ? `${latestWeight.weightKg} kg` : "unknown"}.`,
    health.hasData
      ? `Apple Health today: ${health.steps ?? "?"} steps, ${health.activeEnergyKcal ?? "?"} kcal active energy, slept ${health.sleepHours ?? "?"}h. ` +
        `Wellbeing 0–100 (higher better, except strain): sleep ${health.scores.sleep ?? "?"}, recovery ${health.scores.recovery ?? "?"}, strain ${health.scores.stress ?? "?"} ` +
        `(HRV ${health.hrv ?? "?"}ms vs ${health.hrvBaseline ?? "?"} baseline, resting HR ${health.restingHr ?? "?"} vs ${health.hrBaseline ?? "?"}; REM ${health.remHours ?? "?"}h, deep ${health.deepHours ?? "?"}h). ` +
        `Composite health score today: ${healthScore ?? "?"}/100. Factor recovery into today's training advice.`
      : "Apple Health: nothing synced today (no sleep, recovery, steps, or active energy) — can't assess recovery; remind him to sync his watch.",
    trainingLine,
    splitLine,
    recentWorkouts.length
      ? `Recent workouts (newest first — his actual lifts):\n${workoutLines.join("\n")}`
      : "Recent workouts: none logged yet.",
    `Personal records (best set, est. 1RM): ${prLine}.`,
    `Strength trend (monthly best est. 1RM, last 3 months): ${strengthTrend}.`,
    `Open tasks (${openTasks.length}, highest priority first): ${tasksLine}.`,
    workloadLine,
    ...(calibrationLine ? [calibrationLine] : []),
    `Active goals: ${
      goals
        .filter((g) => g.status === "active")
        .map(
          (g) =>
            `"${g.title}" — ${g.pace.status}, ${g.pace.daysRemaining}d left, next step: ${g.pace.nextStep ?? "n/a"}`,
        )
        .join("; ") || "none"
    }.`,
    `Net worth: AED ${netWorthTotal(accounts)} across ${accounts.length} accounts.`,
    `His notes (titles only — use append_note to add to one): ${
      notes
        .map((n) => `"${n.title}"${n.folder ? ` [${n.folder.name}]` : ""}`)
        .join("; ") || "none"
    }.`,
  ];
  return lines.join("\n");
}

import { prisma } from "../db";
import { loadGoals } from "./goals";
import { computeHealth } from "./health";
import { loadAccounts, netWorthTotal } from "./money";
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
  ]);

  // Today's planned training split + whether it's been done.
  const todayLabel = trainingPlan?.days?.[localWeekdayMon0()]?.trim();
  const isRestDay = !todayLabel || /^rest$/i.test(todayLabel);
  const workoutDone = plannedWorkouts.length > 0;
  const trainingLine = isRestDay
    ? "Training today: REST day (no gym session planned)."
    : `Training today: ${todayLabel} day — ${
        workoutDone
          ? "already logged ✓"
          : "NOT done yet; block a ~60–75min gym session"
      }.`;

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

  const cal = Math.round(meals.reduce((s, m) => s + m.calories, 0));
  const protein = Math.round(meals.reduce((s, m) => s + m.protein, 0));
  const waterMl = water.reduce((s, w) => s + w.amountMl, 0);

  const lines = [
    `Today: ${dayString()}.`,
    settings
      ? `Targets: ${settings.calorieTarget} kcal, ${settings.proteinTarget}g protein, ${settings.fatTarget}g fat, ${settings.carbTarget}g carbs, ${settings.waterTargetMl}ml water (recomp: lose fat + gain muscle).`
      : "Targets: not set.",
    `Eaten so far: ${cal} kcal, ${protein}g protein, ${meals.length} meals; water ${waterMl}ml.`,
    `Latest bodyweight: ${latestWeight ? `${latestWeight.weightKg} kg` : "unknown"}.`,
    health.hasData
      ? `Apple Health today: ${health.steps ?? "?"} steps, ${health.activeEnergyKcal ?? "?"} kcal active energy, slept ${health.sleepHours ?? "?"}h. ` +
        `Wellbeing 0–100 (higher better, except strain): sleep ${health.scores.sleep ?? "?"}, recovery ${health.scores.recovery ?? "?"}, strain ${health.scores.stress ?? "?"} ` +
        `(HRV ${health.hrv ?? "?"}ms vs ${health.hrvBaseline ?? "?"} baseline, resting HR ${health.restingHr ?? "?"} vs ${health.hrBaseline ?? "?"}; REM ${health.remHours ?? "?"}h, deep ${health.deepHours ?? "?"}h). Factor recovery into today's training advice.`
      : "Apple Health: nothing synced today (no sleep, recovery, steps, or active energy) — can't assess recovery; remind him to sync his watch.",
    trainingLine,
    `Open tasks (${openTasks.length}, highest priority first): ${tasksLine}.`,
    workloadLine,
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
  ];
  return lines.join("\n");
}

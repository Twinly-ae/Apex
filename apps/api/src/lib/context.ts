import { prisma } from "../db";
import { loadGoals } from "./goals";
import { healthSummary } from "./health";
import { loadAccounts, netWorthTotal } from "./money";
import { dayRange, dayString } from "./time";

/** A compact, plain-text snapshot of the user's day for the AI to reason over. */
export async function buildUserContext(userId: string): Promise<string> {
  const { start, end } = dayRange();
  const [settings, meals, water, openTasks, goals, accounts, latestWeight, health, plannedWorkouts] =
    await Promise.all([
      prisma.settings.findUnique({ where: { userId } }),
      prisma.meal.findMany({ where: { userId, eatenAt: { gte: start, lt: end } } }),
      prisma.waterLog.findMany({ where: { userId, loggedAt: { gte: start, lt: end } } }),
      prisma.task.findMany({
        where: { userId, done: false },
        orderBy: [{ priority: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }],
        take: 12,
      }),
      loadGoals(userId),
      loadAccounts(userId),
      prisma.bodyweightEntry.findFirst({
        where: { userId },
        orderBy: { measuredAt: "desc" },
      }),
      healthSummary(userId),
      prisma.workout.findMany({
        where: { userId, performedAt: { gte: start, lt: end } },
      }),
    ]);

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
    health.steps != null || health.activeEnergyKcal != null
      ? `Apple Health today: ${health.steps ?? "?"} steps, ${health.activeEnergyKcal ?? "?"} kcal active energy, sleep ${health.sleepHours ?? "?"}h.`
      : "Apple Health: no data today.",
    `Workouts logged today: ${plannedWorkouts.map((w) => w.title).join(", ") || "none"}.`,
    `Open tasks (${openTasks.length}): ${openTasks.map((t) => t.title).join("; ") || "none"}.`,
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

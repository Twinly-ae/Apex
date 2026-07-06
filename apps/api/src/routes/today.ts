import type { FastifyInstance } from "fastify";
import type { TodaySummary } from "@apex/shared";
import type { Goal } from "@apex/shared";
import { prisma } from "../db";
import { getArtifact } from "../lib/coach";
import { loadGoals } from "../lib/goals";
import { loadHabits } from "../lib/habits";
import { healthSummary } from "../lib/health";
import { loadAccounts, netWorthTotal } from "../lib/money";
import { progress } from "../lib/nutrition";
import { toTask } from "../lib/serializers";
import { effectiveStatus } from "../lib/status";
import {
  dayRange,
  dayString,
  localDayFraction,
  localHour,
  localWeekdayMon0,
} from "../lib/time";
import { ensureSettings } from "./settings";
import { ensureTrainingPlan } from "./training-plan";

/** Lower number = more urgent, used to pick the goal to surface on Today. */
function goalUrgency(g: Goal): number {
  switch (g.pace.status) {
    case "overdue":
      return 0;
    case "behind":
      return 1;
    case "on_track":
      return 2;
    default:
      return 3;
  }
}

function greetingFor(hour: number): string {
  if (hour < 5) return "Late night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Winding down";
}

/**
 * Phase 1 briefing: a short, deterministic summary built from the day's
 * numbers. Phase 4 replaces the body of this function with a Claude call,
 * keeping the same return type so the Today screen never changes.
 */
function buildBriefing(args: {
  proteinRemaining: number;
  calorieRemaining: number;
  waterRemainingMl: number;
  openTaskCount: number;
  topTaskTitle?: string;
}): string {
  const parts: string[] = [];
  if (args.topTaskTitle) {
    parts.push(`First up: ${args.topTaskTitle}.`);
  }
  if (args.proteinRemaining > 0) {
    parts.push(`${Math.round(args.proteinRemaining)}g protein to go`);
  } else {
    parts.push("protein target hit — nice");
  }
  if (args.calorieRemaining > 0) {
    parts.push(`${Math.round(args.calorieRemaining)} kcal left`);
  }
  if (args.waterRemainingMl > 0) {
    parts.push(`${(args.waterRemainingMl / 1000).toFixed(1)}L water left`);
  }
  const tasksLine =
    args.openTaskCount === 0
      ? "No open tasks."
      : `${args.openTaskCount} task${args.openTaskCount === 1 ? "" : "s"} on deck.`;
  return `${tasksLine} ${parts.join(" · ")}.`.replace(/\s+\./g, ".");
}

export default async function todayRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request): Promise<TodaySummary> => {
    const userId = request.userId;
    const { start, end } = dayRange();

    const [
      settings,
      meals,
      waterLogs,
      openTasks,
      openTaskCount,
      latestWeight,
      goals,
      habits,
      plan,
      todayWorkoutCount,
      health,
      accounts,
      cachedBriefing,
      todayRevenue,
    ] = await Promise.all([
      ensureSettings(userId),
      prisma.meal.findMany({
        where: { userId, eatenAt: { gte: start, lt: end } },
      }),
      prisma.waterLog.findMany({
        where: { userId, loggedAt: { gte: start, lt: end } },
      }),
      prisma.task.findMany({
        where: { userId, done: false },
        orderBy: [
          { priority: "asc" },
          { dueDate: { sort: "asc", nulls: "last" } },
          { createdAt: "asc" },
        ],
        take: 3,
      }),
      prisma.task.count({ where: { userId, done: false } }),
      prisma.bodyweightEntry.findFirst({
        where: { userId },
        orderBy: { measuredAt: "desc" },
      }),
      loadGoals(userId),
      loadHabits(userId),
      ensureTrainingPlan(userId),
      prisma.workout.count({
        where: { userId, performedAt: { gte: start, lt: end } },
      }),
      healthSummary(userId),
      loadAccounts(userId),
      getArtifact(userId, "briefing", dayString()),
      prisma.twinlySale.aggregate({
        where: { userId, day: dayString() },
        _sum: { revenueAed: true },
      }),
    ]);

    const totals = meals.reduce(
      (acc, m) => {
        acc.calories += m.calories;
        acc.protein += m.protein;
        acc.carbs += m.carbs;
        acc.fat += m.fat;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
    const waterMl = waterLogs.reduce((sum, l) => sum + l.amountMl, 0);

    // Energy balance. "Burned so far" accrues maintenance across the day (you
    // haven't burned a full day's resting energy at breakfast) and adds today's
    // activity (Apple Health active energy, or ~250 kcal per logged workout when
    // Health isn't capturing it). The calorie *budget* is a full-day allowance
    // that grows with activity, so "how much can I still eat" reflects training.
    const eaten = Math.round(totals.calories);
    const activeKcal = health.activeEnergyKcal ?? 0;
    const workoutEst = activeKcal > 0 ? 0 : todayWorkoutCount * 250;
    const activity = Math.round(activeKcal + workoutEst);
    const maintenanceSoFar = Math.round(
      settings.maintenanceCalories * localDayFraction(),
    );
    const burned = maintenanceSoFar + activity;
    const budget = Math.round(settings.calorieTarget + activity);
    const energy = {
      eaten,
      burned,
      net: eaten - burned,
      activeKcal: activity > 0 ? activity : null,
      budget,
      remaining: budget - eaten,
    };

    const calories = progress(totals.calories, budget);
    const protein = progress(totals.protein, settings.proteinTarget);
    const carbs = progress(totals.carbs, settings.carbTarget);
    const fat = progress(totals.fat, settings.fatTarget);
    const water = progress(waterMl, settings.waterTargetMl);

    const topPriorities = openTasks.map(toTask);

    const activeGoals = goals.filter((g) => g.status === "active");
    const focusGoal = [...activeGoals].sort(
      (a, b) =>
        goalUrgency(a) - goalUrgency(b) ||
        a.pace.daysRemaining - b.pace.daysRemaining,
    )[0];
    const plannedLabel = plan.days[localWeekdayMon0()] ?? "Rest";
    const plannedWorkout =
      plannedLabel.trim().toLowerCase() === "rest" ? null : plannedLabel;

    // Prefer the Claude-written briefing if it's been generated today.
    const aiBriefing = cachedBriefing?.content?.trim();
    const briefing =
      aiBriefing ||
      buildBriefing({
        proteinRemaining: protein.remaining,
        calorieRemaining: calories.remaining,
        waterRemainingMl: water.remaining,
        openTaskCount,
        topTaskTitle: topPriorities[0]?.title,
      });

    return {
      date: dayString(),
      greeting: greetingFor(localHour()),
      briefing,
      topPriorities,
      nutrition: {
        calories,
        protein,
        carbs,
        fat,
        waterMl: water,
        mealCount: meals.length,
      },
      latestBodyweightKg: latestWeight ? latestWeight.weightKg : null,
      openTaskCount,
      todaysFocus: focusGoal ? focusGoal.pace.nextStep : null,
      plannedWorkout,
      plannedWorkoutDone: todayWorkoutCount > 0,
      habits,
      activeGoalCount: activeGoals.length,
      caloriesOut: burned,
      energy,
      steps: health.steps,
      netWorthAed: accounts.length ? netWorthTotal(accounts) : null,
      twinlyRevenueToday: todayRevenue._sum.revenueAed,
      briefingByAI: Boolean(aiBriefing),
      activityStatus: effectiveStatus(settings).status,
      statusUntil: effectiveStatus(settings).until?.toISOString() ?? null,
    };
  });
}

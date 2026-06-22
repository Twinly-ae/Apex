import type { FastifyInstance } from "fastify";
import type { TodaySummary } from "@apex/shared";
import { prisma } from "../db";
import { progress } from "../lib/nutrition";
import { toTask } from "../lib/serializers";
import { dayRange, dayString, localHour } from "../lib/time";
import { ensureSettings } from "./settings";

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

    const [settings, meals, waterLogs, openTasks, openTaskCount, latestWeight] =
      await Promise.all([
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

    const calories = progress(totals.calories, settings.calorieTarget);
    const protein = progress(totals.protein, settings.proteinTarget);
    const carbs = progress(totals.carbs, settings.carbTarget);
    const fat = progress(totals.fat, settings.fatTarget);
    const water = progress(waterMl, settings.waterTargetMl);

    const topPriorities = openTasks.map(toTask);

    return {
      date: dayString(),
      greeting: greetingFor(localHour()),
      briefing: buildBriefing({
        proteinRemaining: protein.remaining,
        calorieRemaining: calories.remaining,
        waterRemainingMl: water.remaining,
        openTaskCount,
        topTaskTitle: topPriorities[0]?.title,
      }),
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
    };
  });
}

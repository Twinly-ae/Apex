import type { FastifyInstance } from "fastify";
import { type DayOverview, dayStringSchema } from "@apex/shared";
import { prisma } from "../db";
import { healthSummary } from "../lib/health";
import { toMeal } from "../lib/serializers";
import { dayString, rangeForDayString } from "../lib/time";

export default async function dayRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  // GET /api/day?date=YYYY-MM-DD — everything logged that day (defaults today).
  app.get("/", async (request): Promise<DayOverview> => {
    const parsed = dayStringSchema
      .optional()
      .safeParse((request.query as Record<string, unknown> | undefined)?.date);
    const date = parsed.success && parsed.data ? parsed.data : dayString();
    const { start, end } = rangeForDayString(date);
    const userId = request.userId;

    const [meals, water, workouts, weight, tasksDone, health] =
      await Promise.all([
        prisma.meal.findMany({
          where: { userId, eatenAt: { gte: start, lt: end } },
          orderBy: { eatenAt: "asc" },
        }),
        prisma.waterLog.findMany({
          where: { userId, loggedAt: { gte: start, lt: end } },
        }),
        prisma.workout.findMany({
          where: { userId, performedAt: { gte: start, lt: end } },
          include: { sets: { orderBy: { order: "asc" } } },
          orderBy: { performedAt: "asc" },
        }),
        prisma.bodyweightEntry.findFirst({
          where: { userId, measuredAt: { gte: start, lt: end } },
          orderBy: { measuredAt: "desc" },
        }),
        prisma.task.findMany({
          where: { userId, done: true, doneAt: { gte: start, lt: end } },
          select: { id: true, title: true },
          orderBy: { doneAt: "asc" },
        }),
        healthSummary(userId, date),
      ]);

    const nutrition = meals.reduce(
      (a, m) => ({
        calories: a.calories + m.calories,
        protein: Math.round((a.protein + m.protein) * 10) / 10,
        carbs: Math.round((a.carbs + m.carbs) * 10) / 10,
        fat: Math.round((a.fat + m.fat) * 10) / 10,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );

    return {
      date,
      nutrition,
      meals: meals.map(toMeal),
      waterMl: water.reduce((s, w) => s + w.amountMl, 0),
      workouts: workouts.map((w) => ({
        id: w.id,
        title: w.title,
        performedAt: w.performedAt.toISOString(),
        notes: w.notes,
        source: w.source,
        sets: w.sets.map((s) => ({
          id: s.id,
          exercise: s.exercise,
          order: s.order,
          weightKg: s.weightKg,
          reps: s.reps,
        })),
      })),
      weightKg: weight ? weight.weightKg : null,
      steps: health.steps,
      activeEnergyKcal: health.activeEnergyKcal,
      tasksCompleted: tasksDone.map((t) => ({ id: t.id, title: t.title })),
    };
  });
}

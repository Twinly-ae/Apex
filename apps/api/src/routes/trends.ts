import type { FastifyInstance } from "fastify";
import type {
  AdherencePoint,
  BodyweightPoint,
  TrainingWeekPoint,
  TrendsResponse,
} from "@apex/shared";
import { prisma } from "../db";
import {
  dayBefore,
  dayString,
  localWeekdayMon0,
  rangeForDayString,
  weekStartString,
} from "../lib/time";
import { ensureSettings } from "./settings";
import { ensureTrainingPlan } from "./training-plan";

const isRest = (label: string) => label.trim().toLowerCase() === "rest";

export default async function trendsRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request): Promise<TrendsResponse> => {
    const userId = request.userId;
    const now = new Date();

    const [settings, plan, bwEntries, recentMeals, workouts] =
      await Promise.all([
        ensureSettings(userId),
        ensureTrainingPlan(userId),
        prisma.bodyweightEntry.findMany({
          where: { userId },
          orderBy: { measuredAt: "asc" },
          take: 120,
        }),
        prisma.meal.findMany({
          where: {
            userId,
            eatenAt: { gte: rangeForDayString(dayString(dayBefore(13, now))).start },
          },
        }),
        prisma.workout.findMany({
          where: {
            userId,
            performedAt: {
              gte: rangeForDayString(dayString(dayBefore(55, now))).start,
            },
          },
          include: { sets: true },
        }),
      ]);

    const bodyweight: BodyweightPoint[] = bwEntries.map((b) => ({
      date: b.measuredAt.toISOString(),
      kg: b.weightKg,
    }));

    // Calorie/protein adherence over the last 14 local days.
    const adherence: AdherencePoint[] = [];
    for (let i = 13; i >= 0; i--) {
      const ds = dayString(dayBefore(i, now));
      const { start, end } = rangeForDayString(ds);
      const dayMeals = recentMeals.filter(
        (m) => m.eatenAt >= start && m.eatenAt < end,
      );
      adherence.push({
        date: ds,
        calories: dayMeals.reduce((s, m) => s + m.calories, 0),
        calorieTarget: settings.calorieTarget,
        protein: Math.round(dayMeals.reduce((s, m) => s + m.protein, 0)),
        proteinTarget: settings.proteinTarget,
      });
    }

    // Training volume + sessions per week, last 8 weeks (oldest → newest).
    const weeks = new Map<string, { sessions: number; volumeKg: number }>();
    for (let w = 7; w >= 0; w--) {
      weeks.set(weekStartString(dayBefore(w * 7, now)), {
        sessions: 0,
        volumeKg: 0,
      });
    }
    const workoutDays = new Set<string>();
    for (const wk of workouts) {
      workoutDays.add(dayString(wk.performedAt));
      const bucket = weeks.get(weekStartString(wk.performedAt));
      if (bucket) {
        bucket.sessions += 1;
        bucket.volumeKg += wk.sets.reduce(
          (s, set) => s + (set.weightKg ?? 0) * (set.reps ?? 0),
          0,
        );
      }
    }
    const training: TrainingWeekPoint[] = [...weeks.entries()].map(
      ([weekStart, v]) => ({
        weekStart,
        sessions: v.sessions,
        volumeKg: Math.round(v.volumeKg),
      }),
    );

    // Streak of consecutive on-plan days (trained, or a scheduled rest day).
    let trainingStreak = 0;
    const todayLabel = plan.days[localWeekdayMon0(now)] ?? "Rest";
    const startIdx =
      !isRest(todayLabel) && !workoutDays.has(dayString(now)) ? 1 : 0;
    for (let i = startIdx; i < 120; i++) {
      const d = dayBefore(i, now);
      const label = plan.days[localWeekdayMon0(d)] ?? "Rest";
      if (isRest(label) || workoutDays.has(dayString(d))) trainingStreak++;
      else break;
    }

    return { bodyweight, adherence, training, trainingStreak };
  });
}

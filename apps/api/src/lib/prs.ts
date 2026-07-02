import type { PrRecord } from "@apex/shared";
import { prisma } from "../db";
import { notifyOnce } from "./notifications";

/** Epley estimated 1RM — lets a 60kg×10 set compare fairly with an 80kg×3. */
export function e1rm(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** All-time best set per exercise (by estimated 1RM). */
export async function computePrs(userId: string): Promise<PrRecord[]> {
  const sets = await prisma.workoutSet.findMany({
    where: {
      workout: { userId },
      weightKg: { not: null, gt: 0 },
      reps: { not: null, gt: 0 },
    },
    select: {
      exercise: true,
      weightKg: true,
      reps: true,
      workout: { select: { performedAt: true } },
    },
  });
  const best = new Map<string, PrRecord>();
  for (const s of sets) {
    const score = e1rm(s.weightKg as number, s.reps as number);
    const cur = best.get(s.exercise);
    if (!cur || score > cur.e1rmKg) {
      best.set(s.exercise, {
        exercise: s.exercise,
        weightKg: s.weightKg as number,
        reps: s.reps as number,
        e1rmKg: round1(score),
        performedAt: s.workout.performedAt.toISOString(),
      });
    }
  }
  return [...best.values()].sort((a, b) => b.e1rmKg - a.e1rmKg);
}

/**
 * Compare a just-logged workout against the bests BEFORE it and push a
 * "New PR" once per beaten exercise. Safe to call after every import.
 */
export async function detectNewPrs(
  userId: string,
  workoutId: string,
): Promise<void> {
  const workout = await prisma.workout.findFirst({
    where: { id: workoutId, userId },
    include: { sets: true },
  });
  if (!workout) return;

  // Best set of THIS workout per exercise.
  const inThis = new Map<string, { weightKg: number; reps: number; score: number }>();
  for (const s of workout.sets) {
    if (s.weightKg == null || s.weightKg <= 0 || s.reps == null || s.reps <= 0) continue;
    const score = e1rm(s.weightKg, s.reps);
    const cur = inThis.get(s.exercise);
    if (!cur || score > cur.score) {
      inThis.set(s.exercise, { weightKg: s.weightKg, reps: s.reps, score });
    }
  }

  for (const [exercise, top] of inThis) {
    const prior = await prisma.workoutSet.findMany({
      where: {
        exercise,
        weightKg: { not: null, gt: 0 },
        reps: { not: null, gt: 0 },
        workout: { userId, performedAt: { lt: workout.performedAt } },
      },
      select: { weightKg: true, reps: true },
    });
    if (prior.length === 0) continue; // first time doing it — not a "PR" yet
    const priorBest = Math.max(
      ...prior.map((s) => e1rm(s.weightKg as number, s.reps as number)),
    );
    if (top.score > priorBest) {
      await notifyOnce(
        userId,
        "pr",
        `pr:${exercise}:${workoutId}`,
        "New PR 🎉",
        `${exercise}: ${top.weightKg}kg × ${top.reps} (est. 1RM ${round1(top.score)}kg — beat ${round1(priorBest)}kg).`,
        "/health",
      );
    }
  }
}

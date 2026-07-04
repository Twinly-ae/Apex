import type { PrRecord, ProgressionPoint } from "@apex/shared";
import { prisma } from "../db";
import { notifyOnce } from "./notifications";
import { dayString } from "./time";

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

/** Best set per day for one exercise over the last ~6 months (oldest first). */
export async function exerciseProgression(
  userId: string,
  exercise: string,
  days = 186,
): Promise<ProgressionPoint[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  const sets = await prisma.workoutSet.findMany({
    where: {
      exercise,
      weightKg: { not: null, gt: 0 },
      reps: { not: null, gt: 0 },
      workout: { userId, performedAt: { gte: since } },
    },
    select: {
      weightKg: true,
      reps: true,
      workout: { select: { performedAt: true } },
    },
  });
  const byDay = new Map<string, ProgressionPoint>();
  for (const s of sets) {
    const date = dayString(s.workout.performedAt);
    const score = e1rm(s.weightKg as number, s.reps as number);
    const cur = byDay.get(date);
    if (!cur || score > cur.e1rmKg) {
      byDay.set(date, {
        date,
        weightKg: s.weightKg as number,
        reps: s.reps as number,
        e1rmKg: round1(score),
      });
    }
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Compact per-exercise trend lines for the AI context: monthly best est. 1RM
 * over the last 3 months for the user's top lifts.
 */
export async function progressionSummary(userId: string): Promise<string> {
  const prs = await computePrs(userId);
  const top = prs.slice(0, 5);
  if (top.length === 0) return "none yet";

  const parts: string[] = [];
  for (const p of top) {
    const points = await exerciseProgression(userId, p.exercise, 93);
    if (points.length === 0) continue;
    const byMonth = new Map<string, number>();
    for (const pt of points) {
      const m = pt.date.slice(0, 7);
      byMonth.set(m, Math.max(byMonth.get(m) ?? 0, pt.e1rmKg));
    }
    const months = [...byMonth.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
    const seq = months.map(([, v]) => Math.round(v)).join("→");
    const delta = Math.round(months[months.length - 1][1] - months[0][1]);
    parts.push(
      `${p.exercise} ${seq}kg${
        months.length > 1 ? ` (${delta >= 0 ? "+" : ""}${delta}kg)` : ""
      }`,
    );
  }
  return parts.join("; ") || "none yet";
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

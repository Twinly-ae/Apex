import { Prisma } from "@prisma/client";
import type { Goal, GoalCategory, GoalPace, GoalPaceStatus, GoalStatus } from "@apex/shared";
import { prisma } from "../db";

interface GoalRow {
  status: string;
  createdAt: Date;
  targetDate: Date;
  startValue: number | null;
  targetValue: number | null;
  currentValue: number | null;
}
interface MilestoneRow {
  done: boolean;
  order: number;
  dueDate: Date | null;
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

function dueAsc(a: Date | null, b: Date | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.getTime() - b.getTime();
}

/**
 * Rules-based pace engine: how far along should this goal be by now (time
 * elapsed) vs. how far it actually is (numeric metric or milestone completion),
 * plus the next concrete step. Phase 4 layers Claude on top for richer steps.
 */
export function computePace(
  goal: GoalRow,
  milestones: MilestoneRow[],
  now: Date = new Date(),
): GoalPace {
  const created = goal.createdAt.getTime();
  const target = goal.targetDate.getTime();
  const totalMs = target - created;
  const expectedPct = clamp(
    totalMs <= 0 ? 100 : ((now.getTime() - created) / totalMs) * 100,
    0,
    100,
  );
  const daysRemaining = Math.ceil((target - now.getTime()) / 86_400_000);

  let progressPct = 0;
  if (
    goal.targetValue != null &&
    goal.startValue != null &&
    goal.targetValue !== goal.startValue
  ) {
    const cur = goal.currentValue ?? goal.startValue;
    progressPct = clamp(
      ((cur - goal.startValue) / (goal.targetValue - goal.startValue)) * 100,
      0,
      100,
    );
  } else if (milestones.length > 0) {
    progressPct = (milestones.filter((m) => m.done).length / milestones.length) * 100;
  }

  let status: GoalPaceStatus;
  if (goal.status === "done" || progressPct >= 100) status = "done";
  else if (daysRemaining < 0) status = "overdue";
  else if (progressPct >= expectedPct + 5) status = "ahead";
  else if (progressPct >= expectedPct - 5) status = "on_track";
  else status = "behind";

  return {
    daysRemaining,
    progressPct: round1(progressPct),
    expectedPct: round1(expectedPct),
    status,
    nextStep: status === "done" ? null : null, // filled by caller (has titles)
  };
}

type GoalWithMilestones = Prisma.GoalGetPayload<{
  include: { milestones: true };
}>;

export function serializeGoal(g: GoalWithMilestones, now: Date = new Date()): Goal {
  const milestones = [...g.milestones].sort(
    (a, b) => a.order - b.order || dueAsc(a.dueDate, b.dueDate),
  );
  const pace = computePace(g, milestones, now);
  const nextIncomplete = milestones.find((m) => !m.done);
  pace.nextStep =
    pace.status === "done"
      ? null
      : (nextIncomplete?.title ?? `Make progress on “${g.title}”`);

  return {
    id: g.id,
    title: g.title,
    description: g.description,
    category: g.category as GoalCategory,
    status: g.status as GoalStatus,
    targetDate: g.targetDate.toISOString(),
    createdAt: g.createdAt.toISOString(),
    metricUnit: g.metricUnit,
    startValue: g.startValue,
    targetValue: g.targetValue,
    currentValue: g.currentValue,
    milestones: milestones.map((m) => ({
      id: m.id,
      title: m.title,
      dueDate: m.dueDate ? m.dueDate.toISOString() : null,
      done: m.done,
      doneAt: m.doneAt ? m.doneAt.toISOString() : null,
      order: m.order,
    })),
    pace,
  };
}

/** Load a user's goals (active + done, newest deadlines first) with pace. */
export async function loadGoals(userId: string): Promise<Goal[]> {
  const now = new Date();
  const goals = await prisma.goal.findMany({
    where: { userId, status: { not: "archived" } },
    include: { milestones: true },
    orderBy: [{ status: "asc" }, { targetDate: "asc" }],
  });
  return goals.map((g) => serializeGoal(g, now));
}

import type { Habit } from "@apex/shared";
import { prisma } from "../db";
import { dayBefore, dayString } from "./time";

export function computeHabit(
  base: { id: string; name: string; emoji: string | null },
  doneDays: Set<string>,
  now: Date = new Date(),
): Habit {
  const doneToday = doneDays.has(dayString(now));

  // Oldest → newest over the last 7 days.
  const last7: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    last7.push(doneDays.has(dayString(dayBefore(i, now))));
  }

  // Consecutive run ending today — or yesterday if today is still open, so an
  // unticked "today" doesn't read as a broken streak.
  let streak = 0;
  const start = doneToday ? 0 : 1;
  for (let i = start; i < 365; i++) {
    if (doneDays.has(dayString(dayBefore(i, now)))) streak++;
    else break;
  }

  return { id: base.id, name: base.name, emoji: base.emoji, doneToday, streak, last7 };
}

export async function loadHabits(
  userId: string,
  now: Date = new Date(),
): Promise<Habit[]> {
  const since = dayString(dayBefore(370, now));
  const habits = await prisma.habit.findMany({
    where: { userId, archived: false },
    orderBy: { createdAt: "asc" },
    include: { logs: { where: { day: { gte: since } }, select: { day: true } } },
  });
  return habits.map((h) =>
    computeHabit(
      { id: h.id, name: h.name, emoji: h.emoji },
      new Set(h.logs.map((l) => l.day)),
      now,
    ),
  );
}

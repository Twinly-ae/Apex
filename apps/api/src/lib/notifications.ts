// Phase 5 notification rules. A lightweight in-process scheduler (see index.ts)
// calls runNotificationChecks() periodically; each rule is time-gated and
// deduped via NotificationLog so the user gets at most one ping per event.
import { prisma } from "../db";
import { sendToUser } from "./push";
import { effectiveStatus } from "./status";
import { dayRange, dayString, localHour, localWeekdayMon0 } from "./time";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Create the dedupe log (unique on userId+dedupeKey) and, only if it was newly
 * created, push the notification. Returns true when a notification was sent.
 */
export async function notifyOnce(
  userId: string,
  kind: string,
  dedupeKey: string,
  title: string,
  body: string,
  url?: string,
): Promise<boolean> {
  // Idempotent insert: skipDuplicates relies on the @@unique(userId, dedupeKey)
  // index. count === 0 means we already logged (and sent) this event, so skip —
  // without provoking a Prisma error on every scheduler tick.
  const { count } = await prisma.notificationLog.createMany({
    data: [{ userId, kind, dedupeKey, title, body, url }],
    skipDuplicates: true,
  });
  if (count === 0) return false;
  await sendToUser(userId, { title, body, url, tag: kind });
  return true;
}

async function checkBills(userId: string): Promise<void> {
  const now = new Date();
  const horizon = new Date(now.getTime() + 3 * DAY_MS);
  const floor = new Date(now.getTime() - 1 * DAY_MS);
  const bills = await prisma.bill.findMany({
    where: { userId, nextDueDate: { gte: floor, lte: horizon } },
  });
  for (const b of bills) {
    const days = Math.round((b.nextDueDate.getTime() - now.getTime()) / DAY_MS);
    const dueDay = dayString(b.nextDueDate);
    const when =
      days <= 0 ? "is due today" : days === 1 ? "is due tomorrow" : `is due in ${days} days`;
    await notifyOnce(
      userId,
      "bill",
      `bill:${b.id}:${dueDay}`,
      "Bill due soon",
      `${b.name} (AED ${Math.round(b.amountAed)}) ${when}.`,
      "/money",
    );
  }
}

async function checkStreak(userId: string): Promise<void> {
  // Evening nudge only.
  if (localHour() < 18) return;
  const plan = await prisma.trainingPlan.findUnique({ where: { userId } });
  const label = plan?.days?.[localWeekdayMon0()]?.trim();
  if (!label || /^rest$/i.test(label)) return; // rest day — nothing to nudge

  const { start, end } = dayRange();
  const done = await prisma.workout.count({
    where: { userId, performedAt: { gte: start, lt: end } },
  });
  if (done > 0) return;

  await notifyOnce(
    userId,
    "streak",
    `streak:${dayString()}`,
    "Don't break the streak",
    `${label} is on today's plan and isn't logged yet. A quick session keeps your streak alive.`,
    "/",
  );
}

async function checkLogging(userId: string): Promise<void> {
  // Late-evening nudge if nothing was logged today.
  if (localHour() < 20) return;
  const { start, end } = dayRange();
  const meals = await prisma.meal.count({
    where: { userId, eatenAt: { gte: start, lt: end } },
  });
  if (meals > 0) return;

  await notifyOnce(
    userId,
    "logging",
    `logging:${dayString()}`,
    "Log today before bed",
    "You haven't logged any meals today — a few taps keeps your data honest.",
    "/",
  );
}

/**
 * Afternoon macro check-in: if protein or water is under half its target by
 * 16:00 local, nudge once — there's still time to close the gap before evening.
 */
async function checkMacros(
  userId: string,
  settings: { proteinTarget: number; waterTargetMl: number } | null,
): Promise<void> {
  const hour = localHour();
  if (hour < 16 || hour >= 19 || !settings) return;
  const { start, end } = dayRange();
  const [meals, water] = await Promise.all([
    prisma.meal.findMany({
      where: { userId, eatenAt: { gte: start, lt: end } },
      select: { protein: true },
    }),
    prisma.waterLog.findMany({
      where: { userId, loggedAt: { gte: start, lt: end } },
      select: { amountMl: true },
    }),
  ]);
  const protein = Math.round(meals.reduce((s, m) => s + m.protein, 0));
  const waterMl = water.reduce((s, w) => s + w.amountMl, 0);

  const behind: string[] = [];
  if (protein < settings.proteinTarget * 0.5) {
    behind.push(`protein ${protein}/${settings.proteinTarget}g`);
  }
  if (waterMl < settings.waterTargetMl * 0.5) {
    behind.push(
      `water ${(waterMl / 1000).toFixed(1)}/${(settings.waterTargetMl / 1000).toFixed(1)}L`,
    );
  }
  if (behind.length === 0) return;

  await notifyOnce(
    userId,
    "macros",
    `macros:${dayString()}`,
    "Afternoon check-in",
    `You're behind on ${behind.join(" and ")} — still time to close the gap.`,
    "/",
  );
}

/** Dubai-local HH:mm for a timestamp (fixed UTC+4, matches lib/time). */
function dubaiTime(d: Date): string {
  const s = new Date(d.getTime() + 4 * 60 * 60_000);
  return `${String(s.getUTCHours()).padStart(2, "0")}:${String(
    s.getUTCMinutes(),
  ).padStart(2, "0")}`;
}

async function checkTaskReminders(userId: string): Promise<void> {
  const now = Date.now();
  const tasks = await prisma.task.findMany({
    where: {
      userId,
      done: false,
      reminderLead: { not: null },
      dueDate: { not: null },
    },
  });
  const today = dayString();
  const tomorrow = dayString(new Date(now + DAY_MS));
  for (const t of tasks) {
    if (t.dueDate == null || t.reminderLead == null) continue;
    const remindAt = t.dueDate.getTime() - t.reminderLead * 60_000;
    // Fire once the reminder time has arrived; 12h grace covers brief downtime.
    if (remindAt > now || remindAt <= now - 12 * 60 * 60_000) continue;

    const dueDay = dayString(t.dueDate);
    const whenDay =
      dueDay === today ? "today" : dueDay === tomorrow ? "tomorrow" : dueDay;
    await notifyOnce(
      userId,
      "task",
      `task:${t.id}:${Math.round(remindAt / 60_000)}`,
      "Task reminder",
      `${t.title} is due ${whenDay} at ${dubaiTime(t.dueDate)}.`,
      "/tasks",
    );
  }
}

/** Evaluate every rule for every user. Safe to call frequently (rules dedupe). */
export async function runNotificationChecks(): Promise<void> {
  const users = await prisma.user.findMany({
    select: { id: true, settings: true },
  });
  for (const u of users) {
    const s = u.settings;
    try {
      if (s?.notifyBills ?? true) await checkBills(u.id);
      const resting = s ? effectiveStatus(s).status !== "active" : false;
      if ((s?.notifyStreak ?? true) && !resting) await checkStreak(u.id);
      if (s?.notifyLogging ?? true) {
        await checkLogging(u.id);
        await checkMacros(u.id, s);
      }
      await checkTaskReminders(u.id);
    } catch (err) {
      // Never let one user's failure stop the loop.
      console.error("[notifications]", err);
    }
  }
}

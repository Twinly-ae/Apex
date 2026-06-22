import type { HealthSummary } from "@apex/shared";
import { prisma } from "../db";
import { dayString } from "./time";

/** Roll up a day's ingested Apple Health metrics into the Today/summary shape. */
export async function healthSummary(
  userId: string,
  day: string = dayString(),
): Promise<HealthSummary> {
  const metrics = await prisma.healthMetric.findMany({
    where: { userId, day },
  });

  const sum = (type: string): number | null => {
    const rows = metrics.filter((m) => m.type === type);
    return rows.length ? Math.round(rows.reduce((s, m) => s + m.value, 0)) : null;
  };
  const latest = (type: string): number | null => {
    const rows = metrics
      .filter((m) => m.type === type)
      .sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
    return rows[0] ? Math.round(rows[0].value) : null;
  };

  let updatedAt: Date | null = null;
  for (const m of metrics) {
    if (!updatedAt || m.createdAt > updatedAt) updatedAt = m.createdAt;
  }

  const sleep = metrics.filter((m) => m.type === "sleep_hours");
  return {
    day,
    steps: sum("steps"),
    activeEnergyKcal: sum("active_energy"),
    restingHr: latest("resting_hr"),
    sleepHours: sleep.length
      ? Math.round(sleep.reduce((s, m) => s + m.value, 0) * 10) / 10
      : null,
    updatedAt: updatedAt ? updatedAt.toISOString() : null,
  };
}

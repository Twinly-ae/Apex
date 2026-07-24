// Hevy import, shared by the workouts route and the chat coach's tool.
import type { SyncResult } from "@apex/shared";
import { prisma } from "../db";
import { fetchRecentWorkouts, hevyConfigured } from "../integrations/hevy";
import { detectNewPrs } from "./prs";

/** Pull recent Hevy workouts (deduped by external id) into the user's log. */
export async function syncHevyForUser(userId: string): Promise<SyncResult> {
  if (!hevyConfigured()) {
    return {
      connected: false,
      imported: 0,
      total: 0,
      message: "Set HEVY_API_KEY (Hevy Pro) to auto-import workouts.",
    };
  }
  let workouts;
  try {
    workouts = await fetchRecentWorkouts();
  } catch (err) {
    return {
      connected: true,
      imported: 0,
      total: 0,
      message: err instanceof Error ? err.message : "Hevy sync failed",
    };
  }

  let imported = 0;
  for (const w of workouts) {
    if (!w.id) continue;
    const existing = await prisma.workout.findFirst({
      where: { userId, externalId: w.id },
    });
    if (existing) continue;
    const performedAt = w.start_time
      ? new Date(w.start_time)
      : w.created_at
        ? new Date(w.created_at)
        : undefined;
    const created = await prisma.workout.create({
      data: {
        userId,
        title: w.title || "Hevy workout",
        source: "hevy",
        externalId: w.id,
        performedAt,
        sets: {
          create: (w.exercises ?? []).flatMap((ex, exIdx) =>
            (ex.sets ?? []).map((s, setIdx) => ({
              exercise: ex.title || "Exercise",
              order: exIdx * 100 + setIdx,
              weightKg: s.weight_kg ?? null,
              reps: s.reps ?? null,
            })),
          ),
        },
      },
    });
    imported++;
    // New-PR push (deduped per exercise+workout); never blocks the sync.
    detectNewPrs(userId, created.id).catch(() => {});
  }
  return { connected: true, imported, total: workouts.length };
}

import type { FastifyInstance } from "fastify";
import { DEFAULT_SETTINGS, settingsSchema, type Settings } from "@apex/shared";
import { prisma } from "../db";
import { parseOr400 } from "../lib/http";

type DbSettings = {
  calorieTarget: number;
  proteinTarget: number;
  fatTarget: number;
  carbTarget: number;
  waterTargetMl: number;
  maintenanceCalories: number;
  heightCm: number | null;
  weightUnit: string;
  updatedAt: Date;
};

function toSettings(s: DbSettings): Settings {
  return {
    calorieTarget: s.calorieTarget,
    proteinTarget: s.proteinTarget,
    fatTarget: s.fatTarget,
    carbTarget: s.carbTarget,
    waterTargetMl: s.waterTargetMl,
    maintenanceCalories: s.maintenanceCalories,
    heightCm: s.heightCm,
    weightUnit: s.weightUnit as "kg" | "lb",
    updatedAt: s.updatedAt.toISOString(),
  };
}

/** Fetch the user's settings row, creating it with recomp defaults if missing. */
export async function ensureSettings(userId: string): Promise<DbSettings> {
  const existing = await prisma.settings.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.settings.create({
    data: { userId, ...DEFAULT_SETTINGS },
  });
}

export default async function settingsRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => {
    const settings = await ensureSettings(request.userId);
    return toSettings(settings);
  });

  app.put("/", async (request, reply) => {
    const body = parseOr400(settingsSchema, request.body, reply);
    if (!body) return;
    await ensureSettings(request.userId);
    const settings = await prisma.settings.update({
      where: { userId: request.userId },
      data: {
        calorieTarget: body.calorieTarget,
        proteinTarget: body.proteinTarget,
        fatTarget: body.fatTarget,
        carbTarget: body.carbTarget,
        waterTargetMl: body.waterTargetMl,
        maintenanceCalories: body.maintenanceCalories,
        heightCm: body.heightCm ?? null,
        weightUnit: body.weightUnit,
      },
    });
    return toSettings(settings);
  });
}

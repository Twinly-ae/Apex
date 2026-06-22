/**
 * @apex/shared — single source of truth for the API and the PWA.
 *
 * Every request body the API validates and every response shape the frontend
 * consumes is derived from these Zod schemas, so the two halves can never drift.
 */
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Common                                                                     */
/* -------------------------------------------------------------------------- */

export const idParamSchema = z.object({ id: z.string().min(1) });
export type IdParam = z.infer<typeof idParamSchema>;

/** A calendar day in the user's local time, formatted YYYY-MM-DD. */
export const dayStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(10, "Use at least 10 characters").max(200),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export interface PublicUser {
  id: string;
  email: string;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* Settings / targets (recomp — editable)                                     */
/* -------------------------------------------------------------------------- */

export const settingsSchema = z.object({
  calorieTarget: z.number().int().min(800).max(8000),
  proteinTarget: z.number().int().min(0).max(500),
  fatTarget: z.number().int().min(0).max(400),
  carbTarget: z.number().int().min(0).max(1000),
  waterTargetMl: z.number().int().min(0).max(10000),
  maintenanceCalories: z.number().int().min(800).max(8000),
  heightCm: z.number().int().min(100).max(250).nullable().optional(),
  weightUnit: z.enum(["kg", "lb"]).default("kg"),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export interface Settings extends SettingsInput {
  updatedAt: string;
}

/** Sensible recomp defaults from the spec — used to seed a new user. */
export const DEFAULT_SETTINGS: SettingsInput = {
  calorieTarget: 2200,
  proteinTarget: 155,
  fatTarget: 60,
  carbTarget: 260,
  waterTargetMl: 3000,
  maintenanceCalories: 2600,
  heightCm: 174,
  weightUnit: "kg",
};

/* -------------------------------------------------------------------------- */
/* Meals / nutrition                                                          */
/* -------------------------------------------------------------------------- */

export const mealSourceSchema = z.enum(["manual", "text", "photo", "barcode"]);
export type MealSource = z.infer<typeof mealSourceSchema>;

export const createMealSchema = z.object({
  description: z.string().min(1).max(500),
  calories: z.number().int().min(0).max(10000),
  protein: z.number().min(0).max(1000),
  carbs: z.number().min(0).max(2000),
  fat: z.number().min(0).max(1000),
  // Defaults to "now"; accepts an ISO timestamp for backfilling.
  eatenAt: z.string().datetime().optional(),
  source: mealSourceSchema.default("manual"),
});
export type CreateMealInput = z.infer<typeof createMealSchema>;

export interface Meal {
  id: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  eatenAt: string;
  source: MealSource;
}

/* -------------------------------------------------------------------------- */
/* Bodyweight                                                                 */
/* -------------------------------------------------------------------------- */

export const createBodyweightSchema = z.object({
  weightKg: z.number().min(20).max(400),
  measuredAt: z.string().datetime().optional(),
  source: z.enum(["manual", "watch"]).default("manual"),
});
export type CreateBodyweightInput = z.infer<typeof createBodyweightSchema>;

export interface BodyweightEntry {
  id: string;
  weightKg: number;
  measuredAt: string;
  source: "manual" | "watch";
}

/* -------------------------------------------------------------------------- */
/* Water                                                                      */
/* -------------------------------------------------------------------------- */

export const createWaterSchema = z.object({
  amountMl: z.number().int().min(1).max(5000),
  loggedAt: z.string().datetime().optional(),
});
export type CreateWaterInput = z.infer<typeof createWaterSchema>;

export interface WaterLog {
  id: string;
  amountMl: number;
  loggedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

/** 1 = high, 2 = medium, 3 = low. */
export const taskPrioritySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
export type TaskPriority = z.infer<typeof taskPrioritySchema>;

export const createTaskSchema = z.object({
  title: z.string().min(1).max(300),
  notes: z.string().max(2000).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  priority: taskPrioritySchema.default(2),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z
  .object({
    title: z.string().min(1).max(300),
    notes: z.string().max(2000).nullable(),
    dueDate: z.string().datetime().nullable(),
    priority: taskPrioritySchema,
    done: z.boolean(),
  })
  .partial();
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  dueDate: string | null;
  priority: TaskPriority;
  done: boolean;
  doneAt: string | null;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* Today (home aggregate)                                                     */
/* -------------------------------------------------------------------------- */

export interface MacroProgress {
  consumed: number;
  target: number;
  remaining: number;
}

export interface TodaySummary {
  date: string;
  greeting: string;
  /**
   * Plain, rules-based briefing for Phase 1. Replaced by the Claude-generated
   * briefing in Phase 4 (kept as the same field so the UI never changes).
   */
  briefing: string;
  /** Top 3 priorities, derived from tasks for now; AI-ranked in Phase 4. */
  topPriorities: Task[];
  nutrition: {
    calories: MacroProgress;
    protein: MacroProgress;
    carbs: MacroProgress;
    fat: MacroProgress;
    waterMl: MacroProgress;
    mealCount: number;
  };
  latestBodyweightKg: number | null;
  openTaskCount: number;
}

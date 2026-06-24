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

/** A day's meals plus their rolled-up totals (for the food log). */
export interface MealDay {
  day: string;
  totals: { calories: number; protein: number; carbs: number; fat: number };
  meals: Meal[];
}

/** Everything logged on a given day — powers the history / past-days view. */
export interface DayOverview {
  date: string;
  nutrition: { calories: number; protein: number; carbs: number; fat: number };
  meals: Meal[];
  waterMl: number;
  workouts: Workout[];
  weightKg: number | null;
  steps: number | null;
  activeEnergyKcal: number | null;
  tasksCompleted: { id: string; title: string }[];
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

export const TASK_COLORS = [
  "violet",
  "blue",
  "emerald",
  "amber",
  "rose",
  "slate",
] as const;
export const taskColorSchema = z.enum(TASK_COLORS).nullable();
export type TaskColor = (typeof TASK_COLORS)[number];

export const createTaskSchema = z.object({
  title: z.string().min(1).max(300),
  notes: z.string().max(2000).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  priority: taskPrioritySchema.default(2),
  color: taskColorSchema.optional(),
  estMinutes: z.number().int().min(0).max(10000).nullable().optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z
  .object({
    title: z.string().min(1).max(300),
    notes: z.string().max(2000).nullable(),
    dueDate: z.string().datetime().nullable(),
    priority: taskPrioritySchema,
    color: taskColorSchema,
    estMinutes: z.number().int().min(0).max(10000).nullable(),
    done: z.boolean(),
  })
  .partial();
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const createTaskStepSchema = z.object({
  title: z.string().min(1).max(200),
});
export type CreateTaskStepInput = z.infer<typeof createTaskStepSchema>;

export const updateTaskStepSchema = z
  .object({ title: z.string().min(1).max(200), done: z.boolean() })
  .partial();
export type UpdateTaskStepInput = z.infer<typeof updateTaskStepSchema>;

export interface TaskStep {
  id: string;
  title: string;
  order: number;
  done: boolean;
  doneAt: string | null;
}

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  dueDate: string | null;
  priority: TaskPriority;
  color: TaskColor | null;
  estMinutes: number | null;
  done: boolean;
  doneAt: string | null;
  createdAt: string;
  steps: TaskStep[];
}

/* -------------------------------------------------------------------------- */
/* Today (home aggregate)                                                     */
/* -------------------------------------------------------------------------- */

export interface MacroProgress {
  consumed: number;
  target: number;
  remaining: number;
}

export interface EnergyBalance {
  /** Calories eaten today. */
  eaten: number;
  /** Total burned = maintenance + activity. */
  burned: number;
  /** eaten − burned (negative = deficit). */
  net: number;
  /** Activity burn today (Apple Health active energy, or a workout estimate). */
  activeKcal: number | null;
  /** Activity-adjusted intake target (base target + activity). */
  budget: number;
  /** budget − eaten: how much you can still eat today. */
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
  /** Next step from the most urgent active goal (Phase 2). */
  todaysFocus: string | null;
  /** Today's planned split label, or null on a rest/unplanned day (Phase 2). */
  plannedWorkout: string | null;
  plannedWorkoutDone: boolean;
  /** Habits for the quick-tick row on Today (Phase 2). */
  habits: Habit[];
  activeGoalCount: number;
  /** Total energy burned today = maintenance + activity (Apple Health / workouts). */
  caloriesOut: number | null;
  /** Energy balance: how much eaten vs burned, and how much you can still eat. */
  energy: EnergyBalance;
  steps: number | null;
  netWorthAed: number | null;
  /** Twinly revenue logged today (Phase 4); null if none. */
  twinlyRevenueToday: number | null;
  /** True when the briefing above was written by Claude (Phase 4). */
  briefingByAI: boolean;
}

/* -------------------------------------------------------------------------- */
/* Goals (with deadlines → daily pace)                                        */
/* -------------------------------------------------------------------------- */

export const goalCategorySchema = z.enum([
  "business",
  "fitness",
  "money",
  "study",
  "personal",
]);
export type GoalCategory = z.infer<typeof goalCategorySchema>;

export const goalStatusSchema = z.enum(["active", "done", "archived"]);
export type GoalStatus = z.infer<typeof goalStatusSchema>;

export const createGoalSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).nullable().optional(),
  category: goalCategorySchema.default("personal"),
  targetDate: z.string().datetime(),
  // Optional numeric tracking (e.g. revenue/weight goals).
  metricUnit: z.string().max(20).nullable().optional(),
  startValue: z.number().nullable().optional(),
  targetValue: z.number().nullable().optional(),
  currentValue: z.number().nullable().optional(),
});
export type CreateGoalInput = z.infer<typeof createGoalSchema>;

export const updateGoalSchema = createGoalSchema
  .partial()
  .extend({ status: goalStatusSchema.optional() });
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;

export const createMilestoneSchema = z.object({
  title: z.string().min(1).max(300),
  dueDate: z.string().datetime().nullable().optional(),
});
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;

export const updateMilestoneSchema = z
  .object({
    title: z.string().min(1).max(300),
    dueDate: z.string().datetime().nullable(),
    done: z.boolean(),
    order: z.number().int(),
  })
  .partial();
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;

export interface GoalMilestone {
  id: string;
  title: string;
  dueDate: string | null;
  done: boolean;
  doneAt: string | null;
  order: number;
}

export type GoalPaceStatus =
  | "ahead"
  | "on_track"
  | "behind"
  | "overdue"
  | "done";

export interface GoalPace {
  daysRemaining: number;
  progressPct: number;
  expectedPct: number;
  status: GoalPaceStatus;
  nextStep: string | null;
}

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  category: GoalCategory;
  status: GoalStatus;
  targetDate: string;
  createdAt: string;
  metricUnit: string | null;
  startValue: number | null;
  targetValue: number | null;
  currentValue: number | null;
  milestones: GoalMilestone[];
  pace: GoalPace;
}

/* -------------------------------------------------------------------------- */
/* Habits / streaks                                                           */
/* -------------------------------------------------------------------------- */

export const createHabitSchema = z.object({
  name: z.string().min(1).max(100),
  emoji: z.string().max(8).nullable().optional(),
});
export type CreateHabitInput = z.infer<typeof createHabitSchema>;

export interface Habit {
  id: string;
  name: string;
  emoji: string | null;
  doneToday: boolean;
  streak: number;
  /** Oldest → newest completion flags for the last 7 days. */
  last7: boolean[];
}

/* -------------------------------------------------------------------------- */
/* Training plan + manual workouts                                            */
/* -------------------------------------------------------------------------- */

/** Monday-first weekly split. Phase 3 auto-imports the work itself via Hevy. */
export const DEFAULT_SPLIT = [
  "Push",
  "Pull",
  "Legs",
  "Rest",
  "Upper",
  "Lower",
  "Rest",
];

export const trainingPlanSchema = z.object({
  days: z.array(z.string().max(20)).length(7),
});
export type TrainingPlanInput = z.infer<typeof trainingPlanSchema>;

export interface TrainingPlan {
  days: string[];
  updatedAt: string;
}

export const workoutSetSchema = z.object({
  exercise: z.string().min(1).max(120),
  weightKg: z.number().min(0).max(1000).nullable().optional(),
  reps: z.number().int().min(0).max(1000).nullable().optional(),
});
export type WorkoutSetInput = z.infer<typeof workoutSetSchema>;

export const createWorkoutSchema = z.object({
  title: z.string().min(1).max(120),
  performedAt: z.string().datetime().optional(),
  notes: z.string().max(2000).nullable().optional(),
  sets: z.array(workoutSetSchema).max(100).default([]),
});
export type CreateWorkoutInput = z.infer<typeof createWorkoutSchema>;

export interface WorkoutSet {
  id: string;
  exercise: string;
  order: number;
  weightKg: number | null;
  reps: number | null;
}

export interface Workout {
  id: string;
  title: string;
  performedAt: string;
  notes: string | null;
  source: string;
  sets: WorkoutSet[];
}

/* -------------------------------------------------------------------------- */
/* Trends                                                                     */
/* -------------------------------------------------------------------------- */

export interface BodyweightPoint {
  date: string;
  kg: number;
}

export interface AdherencePoint {
  date: string;
  calories: number;
  calorieTarget: number;
  protein: number;
  proteinTarget: number;
}

export interface TrainingWeekPoint {
  weekStart: string;
  sessions: number;
  volumeKg: number;
}

export interface TrendsResponse {
  bodyweight: BodyweightPoint[];
  adherence: AdherencePoint[];
  training: TrainingWeekPoint[];
  trainingStreak: number;
}

/* -------------------------------------------------------------------------- */
/* Money — accounts, positions, net worth, bills (Phase 3)                    */
/* -------------------------------------------------------------------------- */

export const accountTypeSchema = z.enum(["cash", "investment", "other"]);
export type AccountType = z.infer<typeof accountTypeSchema>;

export const createAccountSchema = z.object({
  name: z.string().min(1).max(100),
  type: accountTypeSchema.default("cash"),
  provider: z.string().max(40).nullable().optional(),
  balanceAed: z.number().min(0).max(1e12).default(0),
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = createAccountSchema
  .partial()
  .extend({ sortOrder: z.number().int().optional() });
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

export const createPositionSchema = z.object({
  name: z.string().min(1).max(100),
  valueAed: z.number().min(0).max(1e12),
});
export type CreatePositionInput = z.infer<typeof createPositionSchema>;

export const updatePositionSchema = createPositionSchema.partial();
export type UpdatePositionInput = z.infer<typeof updatePositionSchema>;

export interface Position {
  id: string;
  name: string;
  valueAed: number;
  updatedAt: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  provider: string | null;
  balanceAed: number;
  /** Effective value: sum of positions when present, else balanceAed. */
  valueAed: number;
  sortOrder: number;
  updatedAt: string;
  positions: Position[];
}

export interface NetWorthPoint {
  day: string;
  totalAed: number;
}

export interface NetWorthResponse {
  totalAed: number;
  accounts: Account[];
  history: NetWorthPoint[];
}

export const billCadenceSchema = z.enum(["weekly", "monthly", "yearly", "once"]);
export type BillCadence = z.infer<typeof billCadenceSchema>;

export const createBillSchema = z.object({
  name: z.string().min(1).max(100),
  amountAed: z.number().min(0).max(1e9),
  cadence: billCadenceSchema.default("monthly"),
  nextDueDate: z.string().datetime(),
  category: z.string().max(60).nullable().optional(),
});
export type CreateBillInput = z.infer<typeof createBillSchema>;

export const updateBillSchema = createBillSchema.partial();
export type UpdateBillInput = z.infer<typeof updateBillSchema>;

export interface Bill {
  id: string;
  name: string;
  amountAed: number;
  cadence: BillCadence;
  nextDueDate: string;
  category: string | null;
  daysUntilDue: number;
}

/* -------------------------------------------------------------------------- */
/* Apple Health (ingested via a bridge app)                                   */
/* -------------------------------------------------------------------------- */

export interface HealthSummary {
  day: string;
  steps: number | null;
  activeEnergyKcal: number | null;
  restingHr: number | null;
  sleepHours: number | null;
  updatedAt: string | null;
}

/** Derived 0–100 wellbeing scores (higher = better, except stress). */
export interface HealthScores {
  sleep: number | null;
  recovery: number | null;
  stress: number | null; // higher = more stressed
}

export interface HealthPoint {
  date: string;
  value: number;
}

/** 7-day wellbeing averages. */
export interface HealthWeekly {
  avgSleepHours: number | null;
  avgRecovery: number | null;
  avgRestingHr: number | null;
  nights: number;
}

/** A day's energy in (food) vs out (maintenance + activity). */
export interface EnergyPoint {
  date: string;
  kcalIn: number;
  kcalOut: number;
}

export interface HealthResponse {
  day: string;
  scores: HealthScores;
  steps: number | null;
  activeEnergyKcal: number | null;
  restingHr: number | null;
  hrBaseline: number | null;
  sleepHours: number | null;
  sleepSeries: HealthPoint[];
  rhrSeries: HealthPoint[];
  weekly: HealthWeekly;
  energySeries: EnergyPoint[];
  updatedAt: string | null;
  hasData: boolean;
}

/* -------------------------------------------------------------------------- */
/* Twinly expenses (cached from Notion)                                       */
/* -------------------------------------------------------------------------- */

export interface TwinlyExpense {
  id: string;
  title: string | null;
  category: string | null;
  amountAed: number;
  date: string | null;
}

export interface TwinlyCategoryTotal {
  category: string;
  amountAed: number;
}

export interface TwinlySummary {
  connected: boolean;
  lastSyncedAt: string | null;
  monthToDateAed: number;
  lastMonthAed: number;
  byCategory: TwinlyCategoryTotal[];
  recent: TwinlyExpense[];
}

/* -------------------------------------------------------------------------- */
/* Integration sync result                                                    */
/* -------------------------------------------------------------------------- */

export interface SyncResult {
  connected: boolean;
  imported: number;
  total: number;
  message?: string;
}

/* -------------------------------------------------------------------------- */
/* Phase 4 — AI coach                                                         */
/* -------------------------------------------------------------------------- */

export interface AiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export const chatInputSchema = z.object({ message: z.string().min(1).max(4000) });
export type ChatInput = z.infer<typeof chatInputSchema>;

/** A cached, AI-generated text artifact (briefing / day plan / weekly review). */
export interface AiText {
  configured: boolean;
  text: string;
  generatedAt: string | null;
}

export const reviewTypeSchema = z.enum(["twinly", "fitness", "money"]);
export type ReviewType = z.infer<typeof reviewTypeSchema>;

/* ----- AI macro tracker ----- */

export interface MealEstimate {
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  note?: string | null;
  found?: boolean;
}

export const analyzeTextSchema = z.object({ text: z.string().min(1).max(500) });
export type AnalyzeTextInput = z.infer<typeof analyzeTextSchema>;

export const analyzePhotoSchema = z.object({
  imageBase64: z.string().min(10),
  mediaType: z.string().max(40).default("image/jpeg"),
  hint: z.string().max(200).optional(),
});
export type AnalyzePhotoInput = z.infer<typeof analyzePhotoSchema>;

/* -------------------------------------------------------------------------- */
/* Twinly sales (manual daily entry; AI weekly review)                        */
/* -------------------------------------------------------------------------- */

export const createTwinlySaleSchema = z.object({
  day: dayStringSchema.optional(),
  revenueAed: z.number().min(0).max(1e9),
  orders: z.number().int().min(0).max(100000).default(0),
  costAed: z.number().min(0).max(1e9).default(0),
  note: z.string().max(300).nullable().optional(),
});
export type CreateTwinlySaleInput = z.infer<typeof createTwinlySaleSchema>;

export interface TwinlySale {
  id: string;
  day: string;
  revenueAed: number;
  orders: number;
  costAed: number;
  profitAed: number;
  note: string | null;
}

export interface TwinlySalesSummary {
  today: TwinlySale | null;
  monthRevenueAed: number;
  monthProfitAed: number;
  monthOrders: number;
  recent: TwinlySale[];
}

/* ----- Businesses (multiple revenue-generating businesses) ----- */

export const createBusinessSchema = z.object({
  name: z.string().min(1).max(80),
});
export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;

export const updateBusinessSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;

export interface Business {
  id: string;
  name: string;
  sortOrder: number;
}

/** A business plus its month-to-date sales rollup. */
export interface BusinessSummary extends Business {
  monthRevenueAed: number;
  monthProfitAed: number;
  monthOrders: number;
  today: TwinlySale | null;
  recent: TwinlySale[];
}

/* -------------------------------------------------------------------------- */
/* Bank statement import (parsed + categorized by Claude, encrypted at rest)  */
/* -------------------------------------------------------------------------- */

export const importStatementSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM"),
  filename: z.string().min(1).max(200),
  kind: z.enum(["pdf", "csv"]),
  dataBase64: z.string().min(1),
});
export type ImportStatementInput = z.infer<typeof importStatementSchema>;

export interface StatementCategoryTotal {
  category: string;
  amountAed: number;
}

export interface StatementSummary {
  byCategory: StatementCategoryTotal[];
  totalSpentAed: number;
  totalIncomeAed: number;
  savingsRate: number | null;
  biggest: { description: string; amountAed: number; category: string }[];
  subscriptions: { description: string; amountAed: number }[];
  tips: string[];
  vsLastMonthAed: number | null;
}

export interface StatementListItem {
  id: string;
  month: string;
  filename: string;
  createdAt: string;
  totalSpentAed: number;
  transactionCount: number;
}

export interface StatementDetail extends StatementListItem {
  summary: StatementSummary;
}

/* -------------------------------------------------------------------------- */
/* Phase 5: web push notifications + data export                              */
/* -------------------------------------------------------------------------- */

/** Browser PushSubscription, as serialized by the Push API. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(200),
  }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
});

/** Per-category notification toggles. */
export const notificationPrefsSchema = z.object({
  notifyBills: z.boolean(),
  notifyStreak: z.boolean(),
  notifyLogging: z.boolean(),
});
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;

export interface PushConfig {
  configured: boolean;
  publicKey: string | null;
  prefs: NotificationPrefs;
}

/**
 * Which server-side integrations the API can actually see (booleans only — no
 * keys ever leave the server). Powers the Settings → Integrations diagnostics.
 */
export interface IntegrationStatus {
  ai: boolean;
  encryption: boolean;
  hevy: boolean;
  notion: boolean;
  healthIngest: boolean;
  push: boolean;
  model: string;
}

/** Result of a live "Test connections" ping against the outbound integrations. */
export interface IntegrationCheck {
  name: "ai" | "notion" | "hevy";
  configured: boolean;
  ok: boolean;
  detail: string;
}
export interface IntegrationCheckResult {
  checks: IntegrationCheck[];
}

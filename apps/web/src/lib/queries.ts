import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  BodyweightEntry,
  ChangePasswordInput,
  CreateBodyweightInput,
  CreateGoalInput,
  CreateHabitInput,
  CreateMealInput,
  CreateMilestoneInput,
  CreateTaskInput,
  CreateWaterInput,
  CreateWorkoutInput,
  Goal,
  Habit,
  LoginInput,
  Meal,
  PublicUser,
  Settings,
  SettingsInput,
  Task,
  TodaySummary,
  TrainingPlan,
  TrainingPlanInput,
  TrendsResponse,
  UpdateGoalInput,
  UpdateMilestoneInput,
  UpdateTaskInput,
  WaterLog,
  Workout,
} from "@apex/shared";
import { api } from "./api";

interface WaterDay {
  totalMl: number;
  logs: WaterLog[];
}

export const keys = {
  me: ["me"] as const,
  today: ["today"] as const,
  meals: (date?: string) => ["meals", date ?? "today"] as const,
  water: (date?: string) => ["water", date ?? "today"] as const,
  bodyweight: ["bodyweight"] as const,
  tasks: ["tasks"] as const,
  settings: ["settings"] as const,
  goals: ["goals"] as const,
  habits: ["habits"] as const,
  workouts: ["workouts"] as const,
  trainingPlan: ["training-plan"] as const,
  trends: ["trends"] as const,
};

/* ----------------------------- Auth ----------------------------- */

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: () => api.get<PublicUser>("/api/auth/me"),
    retry: false,
    staleTime: 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) =>
      api.post<PublicUser>("/api/auth/login", input),
    onSuccess: (user) => {
      qc.setQueryData(keys.me, user);
      qc.invalidateQueries();
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ ok: true }>("/api/auth/logout"),
    onSuccess: () => {
      qc.setQueryData(keys.me, null);
      qc.clear();
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      api.post<{ ok: true }>("/api/auth/password", input),
  });
}

/* ----------------------------- Today ----------------------------- */

export function useToday() {
  return useQuery({
    queryKey: keys.today,
    queryFn: () => api.get<TodaySummary>("/api/today"),
    staleTime: 15_000,
  });
}

/** Invalidate everything that the Today aggregate depends on. */
function useInvalidateDaily() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: keys.today });
  };
}

/* ----------------------------- Meals ----------------------------- */

export function useMeals(date?: string) {
  return useQuery({
    queryKey: keys.meals(date),
    queryFn: () =>
      api.get<Meal[]>(`/api/meals${date ? `?date=${date}` : ""}`),
  });
}

export function useAddMeal() {
  const qc = useQueryClient();
  const invalidateDaily = useInvalidateDaily();
  return useMutation({
    mutationFn: (input: CreateMealInput) => api.post<Meal>("/api/meals", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meals"] });
      invalidateDaily();
    },
  });
}

export function useDeleteMeal() {
  const qc = useQueryClient();
  const invalidateDaily = useInvalidateDaily();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: true }>(`/api/meals/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meals"] });
      invalidateDaily();
    },
  });
}

/* ----------------------------- Water ----------------------------- */

export function useWaterToday() {
  return useQuery({
    queryKey: keys.water(),
    queryFn: () => api.get<WaterDay>("/api/water"),
  });
}

export function useAddWater() {
  const qc = useQueryClient();
  const invalidateDaily = useInvalidateDaily();
  return useMutation({
    mutationFn: (input: CreateWaterInput) =>
      api.post<WaterLog>("/api/water", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["water"] });
      invalidateDaily();
    },
  });
}

/* --------------------------- Bodyweight --------------------------- */

export function useBodyweight() {
  return useQuery({
    queryKey: keys.bodyweight,
    queryFn: () => api.get<BodyweightEntry[]>("/api/bodyweight"),
  });
}

export function useAddBodyweight() {
  const qc = useQueryClient();
  const invalidateDaily = useInvalidateDaily();
  return useMutation({
    mutationFn: (input: CreateBodyweightInput) =>
      api.post<BodyweightEntry>("/api/bodyweight", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.bodyweight });
      invalidateDaily();
    },
  });
}

/* ----------------------------- Tasks ----------------------------- */

export function useTasks() {
  return useQuery({
    queryKey: keys.tasks,
    queryFn: () => api.get<Task[]>("/api/tasks"),
  });
}

export function useAddTask() {
  const qc = useQueryClient();
  const invalidateDaily = useInvalidateDaily();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => api.post<Task>("/api/tasks", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.tasks });
      invalidateDaily();
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  const invalidateDaily = useInvalidateDaily();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskInput }) =>
      api.patch<Task>(`/api/tasks/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.tasks });
      invalidateDaily();
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  const invalidateDaily = useInvalidateDaily();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: true }>(`/api/tasks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.tasks });
      invalidateDaily();
    },
  });
}

/* ---------------------------- Settings ---------------------------- */

export function useSettings() {
  return useQuery({
    queryKey: keys.settings,
    queryFn: () => api.get<Settings>("/api/settings"),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  const invalidateDaily = useInvalidateDaily();
  return useMutation({
    mutationFn: (input: SettingsInput) =>
      api.put<Settings>("/api/settings", input),
    onSuccess: (settings) => {
      qc.setQueryData(keys.settings, settings);
      invalidateDaily();
    },
  });
}

/* ----------------------------- Goals ----------------------------- */

export function useGoals() {
  return useQuery({
    queryKey: keys.goals,
    queryFn: () => api.get<Goal[]>("/api/goals"),
  });
}

function useGoalMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.goals });
      qc.invalidateQueries({ queryKey: keys.today });
    },
  });
}

export const useAddGoal = () =>
  useGoalMutation((input: CreateGoalInput) => api.post<Goal>("/api/goals", input));

export const useUpdateGoal = () =>
  useGoalMutation(({ id, input }: { id: string; input: UpdateGoalInput }) =>
    api.patch<Goal>(`/api/goals/${id}`, input),
  );

export const useDeleteGoal = () =>
  useGoalMutation((id: string) => api.del<{ ok: true }>(`/api/goals/${id}`));

export const useAddMilestone = () =>
  useGoalMutation(
    ({ goalId, input }: { goalId: string; input: CreateMilestoneInput }) =>
      api.post<Goal>(`/api/goals/${goalId}/milestones`, input),
  );

export const useUpdateMilestone = () =>
  useGoalMutation(({ id, input }: { id: string; input: UpdateMilestoneInput }) =>
    api.patch<Goal>(`/api/goals/milestones/${id}`, input),
  );

export const useDeleteMilestone = () =>
  useGoalMutation((id: string) =>
    api.del<{ ok: true }>(`/api/goals/milestones/${id}`),
  );

/* ----------------------------- Habits ----------------------------- */

export function useHabits() {
  return useQuery({
    queryKey: keys.habits,
    queryFn: () => api.get<Habit[]>("/api/habits"),
  });
}

export function useAddHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateHabitInput) =>
      api.post<Habit[]>("/api/habits", input),
    onSuccess: (list) => {
      qc.setQueryData(keys.habits, list);
      qc.invalidateQueries({ queryKey: keys.today });
    },
  });
}

export function useToggleHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Habit[]>(`/api/habits/${id}/toggle`),
    onSuccess: (list) => {
      qc.setQueryData(keys.habits, list);
      qc.invalidateQueries({ queryKey: keys.today });
    },
  });
}

export function useDeleteHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: true }>(`/api/habits/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.habits });
      qc.invalidateQueries({ queryKey: keys.today });
    },
  });
}

/* ---------------------------- Workouts ---------------------------- */

export function useWorkouts() {
  return useQuery({
    queryKey: keys.workouts,
    queryFn: () => api.get<Workout[]>("/api/workouts"),
  });
}

function useWorkoutMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.workouts });
      qc.invalidateQueries({ queryKey: keys.trends });
      qc.invalidateQueries({ queryKey: keys.today });
    },
  });
}

export const useAddWorkout = () =>
  useWorkoutMutation((input: CreateWorkoutInput) =>
    api.post<Workout>("/api/workouts", input),
  );

export const useDeleteWorkout = () =>
  useWorkoutMutation((id: string) =>
    api.del<{ ok: true }>(`/api/workouts/${id}`),
  );

/* ------------------------- Training plan -------------------------- */

export function useTrainingPlan() {
  return useQuery({
    queryKey: keys.trainingPlan,
    queryFn: () => api.get<TrainingPlan>("/api/training-plan"),
  });
}

export function useUpdateTrainingPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TrainingPlanInput) =>
      api.put<TrainingPlan>("/api/training-plan", input),
    onSuccess: (plan) => {
      qc.setQueryData(keys.trainingPlan, plan);
      qc.invalidateQueries({ queryKey: keys.trends });
      qc.invalidateQueries({ queryKey: keys.today });
    },
  });
}

/* ----------------------------- Trends ----------------------------- */

export function useTrends() {
  return useQuery({
    queryKey: keys.trends,
    queryFn: () => api.get<TrendsResponse>("/api/trends"),
  });
}

/* ===================== Phase 3: integrations ===================== */
import type {
  Account,
  Bill,
  CreateAccountInput,
  CreateBillInput,
  CreatePositionInput,
  HealthResponse,
  HealthSummary,
  NetWorthResponse,
  SyncResult,
  TwinlySummary,
  UpdateAccountInput,
  UpdateBillInput,
  UpdatePositionInput,
} from "@apex/shared";

export const moneyKeys = {
  money: ["money"] as const,
  bills: ["bills"] as const,
  metrics: ["metrics-summary"] as const,
  twinly: ["twinly-summary"] as const,
};

/* ----- Money / net worth ----- */
export function useMoney() {
  return useQuery({
    queryKey: moneyKeys.money,
    queryFn: () => api.get<NetWorthResponse>("/api/money"),
  });
}

function useMoneyMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: moneyKeys.money });
      qc.invalidateQueries({ queryKey: keys.today });
    },
  });
}

export const useAddAccount = () =>
  useMoneyMutation((input: CreateAccountInput) =>
    api.post<Account[]>("/api/money/accounts", input),
  );
export const useUpdateAccount = () =>
  useMoneyMutation(({ id, input }: { id: string; input: UpdateAccountInput }) =>
    api.patch<Account[]>(`/api/money/accounts/${id}`, input),
  );
export const useDeleteAccount = () =>
  useMoneyMutation((id: string) =>
    api.del<Account[]>(`/api/money/accounts/${id}`),
  );
export const useAddPosition = () =>
  useMoneyMutation(
    ({ accountId, input }: { accountId: string; input: CreatePositionInput }) =>
      api.post<Account[]>(`/api/money/accounts/${accountId}/positions`, input),
  );
export const useUpdatePosition = () =>
  useMoneyMutation(({ id, input }: { id: string; input: UpdatePositionInput }) =>
    api.patch<Account[]>(`/api/money/positions/${id}`, input),
  );
export const useDeletePosition = () =>
  useMoneyMutation((id: string) =>
    api.del<Account[]>(`/api/money/positions/${id}`),
  );

/* ----- Bills ----- */
export function useBills() {
  return useQuery({
    queryKey: moneyKeys.bills,
    queryFn: () => api.get<Bill[]>("/api/bills"),
  });
}
export const useAddBill = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBillInput) => api.post<Bill>("/api/bills", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: moneyKeys.bills }),
  });
};
export const useUpdateBill = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBillInput }) =>
      api.patch<Bill>(`/api/bills/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: moneyKeys.bills }),
  });
};
export const useDeleteBill = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: true }>(`/api/bills/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: moneyKeys.bills }),
  });
};

/* ----- Apple Health summary ----- */
export function useMetricsSummary() {
  return useQuery({
    queryKey: moneyKeys.metrics,
    queryFn: () => api.get<HealthSummary>("/api/metrics/summary"),
  });
}

/* ----- Health scores (sleep / recovery / stress) ----- */
export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => api.get<HealthResponse>("/api/health/scores"),
  });
}

/* ----- Twinly expenses ----- */
export function useTwinlySummary() {
  return useQuery({
    queryKey: moneyKeys.twinly,
    queryFn: () => api.get<TwinlySummary>("/api/twinly/summary"),
  });
}
export const useSyncTwinly = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<SyncResult>("/api/twinly/sync"),
    onSuccess: () => qc.invalidateQueries({ queryKey: moneyKeys.twinly }),
  });
};

/* ----- Hevy sync ----- */
export const useSyncHevy = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<SyncResult>("/api/workouts/sync-hevy"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.workouts });
      qc.invalidateQueries({ queryKey: keys.trends });
      qc.invalidateQueries({ queryKey: keys.today });
    },
  });
};

/* ===================== Phase 4: AI coach ===================== */
import type {
  AiChatMessage,
  AiText,
  CreateTwinlySaleInput,
  ImportStatementInput,
  MealEstimate,
  ReviewType,
  StatementDetail,
  StatementListItem,
  TwinlySale,
  TwinlySalesSummary,
} from "@apex/shared";

/* ----- Chat ----- */
export function useAiChat() {
  return useQuery({
    queryKey: ["ai-chat"],
    queryFn: () =>
      api.get<{ configured: boolean; messages: AiChatMessage[] }>("/api/ai/chat"),
  });
}
export function useSendChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (message: string) =>
      api.post<AiChatMessage>("/api/ai/chat", { message }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-chat"] }),
  });
}

/* ----- Briefing + day plan ----- */
export function useBriefing() {
  return useQuery({
    queryKey: ["ai-briefing"],
    queryFn: () => api.get<AiText>("/api/ai/briefing"),
  });
}
export function useGenerateBriefing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<AiText>("/api/ai/briefing"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-briefing"] });
      qc.invalidateQueries({ queryKey: keys.today });
    },
  });
}
export function usePlan() {
  return useQuery({
    queryKey: ["ai-plan"],
    queryFn: () => api.get<AiText>("/api/ai/plan"),
  });
}
export function useGeneratePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commitments?: string) =>
      api.post<AiText>("/api/ai/plan", { commitments }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-plan"] }),
  });
}

/* ----- Weekly reviews ----- */
export function useReview(type: ReviewType) {
  return useQuery({
    queryKey: ["ai-review", type],
    queryFn: () => api.get<AiText>(`/api/ai/review?type=${type}`),
  });
}
export function useGenerateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (type: ReviewType) =>
      api.post<AiText>(`/api/ai/review?type=${type}`),
    onSuccess: (_data, type) =>
      qc.invalidateQueries({ queryKey: ["ai-review", type] }),
  });
}

/* ----- AI macro tracker ----- */
export const useAnalyzeText = () =>
  useMutation({
    mutationFn: (text: string) =>
      api.post<MealEstimate>("/api/meals/analyze/text", { text }),
  });
export const useAnalyzePhoto = () =>
  useMutation({
    mutationFn: (input: { imageBase64: string; mediaType: string; hint?: string }) =>
      api.post<MealEstimate>("/api/meals/analyze/photo", input),
  });
export const useBarcodeLookup = () =>
  useMutation({
    mutationFn: (code: string) =>
      api.get<MealEstimate>(`/api/meals/barcode/${code}`),
  });

/* ----- Twinly sales ----- */
export function useTwinlySales() {
  return useQuery({
    queryKey: ["twinly-sales"],
    queryFn: () => api.get<TwinlySalesSummary>("/api/twinly/sales"),
  });
}
export function useSaveTwinlySale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTwinlySaleInput) =>
      api.post<TwinlySale>("/api/twinly/sales", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["twinly-sales"] });
      qc.invalidateQueries({ queryKey: keys.today });
    },
  });
}

/* ----- Bank statements ----- */
export function useStatements() {
  return useQuery({
    queryKey: ["statements"],
    queryFn: () => api.get<StatementListItem[]>("/api/statements"),
  });
}
export function useStatement(id: string | null) {
  return useQuery({
    queryKey: ["statement", id],
    queryFn: () => api.get<StatementDetail>(`/api/statements/${id}`),
    enabled: Boolean(id),
  });
}
export function useImportStatement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ImportStatementInput) =>
      api.post<StatementDetail>("/api/statements", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["statements"] }),
  });
}
export function useDeleteStatement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: true }>(`/api/statements/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["statements"] }),
  });
}

/* ===================== Phase 5: notifications + export ===================== */
import type {
  IntegrationCheckResult,
  IntegrationStatus,
  NotificationPrefs,
  PushConfig,
} from "@apex/shared";

export function useIntegrationStatus() {
  return useQuery({
    queryKey: ["integration-status"],
    queryFn: () => api.get<IntegrationStatus>("/api/status"),
    staleTime: 30_000,
  });
}
export function useCheckIntegrations() {
  return useMutation({
    mutationFn: () => api.post<IntegrationCheckResult>("/api/status/check"),
  });
}

export function usePushConfig() {
  return useQuery({
    queryKey: ["push-config"],
    queryFn: () => api.get<PushConfig>("/api/push/config"),
    staleTime: 30_000,
  });
}
export function useUpdatePushPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prefs: NotificationPrefs) =>
      api.put<NotificationPrefs>("/api/push/prefs", prefs),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["push-config"] }),
  });
}
export function useSendTestPush() {
  return useMutation({
    mutationFn: () => api.post<{ ok: true; sent: number }>("/api/push/test"),
  });
}
/** After enabling/disabling a subscription, refresh the config view. */
export function useInvalidatePushConfig() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["push-config"] });
}

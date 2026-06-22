import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  BodyweightEntry,
  ChangePasswordInput,
  CreateBodyweightInput,
  CreateMealInput,
  CreateTaskInput,
  CreateWaterInput,
  LoginInput,
  Meal,
  PublicUser,
  Settings,
  SettingsInput,
  Task,
  TodaySummary,
  UpdateTaskInput,
  WaterLog,
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

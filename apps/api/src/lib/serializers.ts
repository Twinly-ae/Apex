import type {
  BodyweightEntry as DbBodyweight,
  Meal as DbMeal,
  Task as DbTask,
  TaskStep as DbTaskStep,
  WaterLog as DbWater,
} from "@prisma/client";
import type {
  BodyweightEntry,
  Meal,
  MealSource,
  Task,
  TaskColor,
  TaskPriority,
  WaterLog,
} from "@apex/shared";

export function toMeal(m: DbMeal): Meal {
  return {
    id: m.id,
    description: m.description,
    calories: m.calories,
    protein: m.protein,
    carbs: m.carbs,
    fat: m.fat,
    eatenAt: m.eatenAt.toISOString(),
    source: m.source as MealSource,
  };
}

export function toBodyweight(b: DbBodyweight): BodyweightEntry {
  return {
    id: b.id,
    weightKg: b.weightKg,
    measuredAt: b.measuredAt.toISOString(),
    source: b.source as "manual" | "watch",
  };
}

export function toWater(w: DbWater): WaterLog {
  return {
    id: w.id,
    amountMl: w.amountMl,
    loggedAt: w.loggedAt.toISOString(),
  };
}

export function toTask(t: DbTask & { steps?: DbTaskStep[] }): Task {
  return {
    id: t.id,
    title: t.title,
    notes: t.notes,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    priority: t.priority as TaskPriority,
    color: (t.color as TaskColor | null) ?? null,
    estMinutes: t.estMinutes,
    done: t.done,
    doneAt: t.doneAt ? t.doneAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    steps: [...(t.steps ?? [])]
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        id: s.id,
        title: s.title,
        estMinutes: s.estMinutes,
        order: s.order,
        done: s.done,
        doneAt: s.doneAt ? s.doneAt.toISOString() : null,
      })),
  };
}

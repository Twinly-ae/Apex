// The coach's hands: a curated set of safe, single-user actions Claude can
// take from chat. Every executor returns a short human-readable result that
// doubles as the tool_result the model sees.
import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../db";
import { createExpense, notionConfigured } from "../integrations/notion";
import { ensureTrainingPlan } from "../routes/training-plan";
import { syncHevyForUser } from "./hevySync";
import { bankedMinutes, nextOccurrence } from "./tasks";
import { dayRange, dayString } from "./time";

export const COACH_TOOLS: Anthropic.Tool[] = [
  {
    name: "add_task",
    description:
      "Add a task to the user's task list. Use when he asks to add/remember/track something to do.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short task title" },
        priority: { type: "number", enum: [1, 2, 3], description: "1=high 2=med 3=low (default 2)" },
        dueDate: { type: "string", description: "ISO datetime when due (optional)" },
        estMinutes: { type: "number", description: "Estimated minutes (optional)" },
        notes: { type: "string", description: "Extra details (optional)" },
      },
      required: ["title"],
    },
  },
  {
    name: "log_meal",
    description:
      "Log a meal he just ate with estimated macros. Estimate calories/protein/carbs/fat yourself from the description.",
    input_schema: {
      type: "object",
      properties: {
        description: { type: "string" },
        calories: { type: "number" },
        protein: { type: "number", description: "grams" },
        carbs: { type: "number", description: "grams" },
        fat: { type: "number", description: "grams" },
      },
      required: ["description", "calories", "protein", "carbs", "fat"],
    },
  },
  {
    name: "log_water",
    description: "Log drinking water in millilitres.",
    input_schema: {
      type: "object",
      properties: { amountMl: { type: "number", description: "e.g. 500" } },
      required: ["amountMl"],
    },
  },
  {
    name: "log_weight",
    description: "Log today's bodyweight in kilograms.",
    input_schema: {
      type: "object",
      properties: { weightKg: { type: "number" } },
      required: ["weightKg"],
    },
  },
  {
    name: "set_activity_status",
    description:
      "Set his activity status when he says he's sick, injured, taking a break, or back to training.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["active", "sick", "injured", "break"] },
        days: { type: "number", description: "Auto-expire after N days (omit = until changed)" },
      },
      required: ["status"],
    },
  },
  {
    name: "update_task",
    description:
      "Edit an open task: rename it, change priority, due date, estimate, or notes. Match the task by part of its title.",
    input_schema: {
      type: "object",
      properties: {
        task: { type: "string", description: "Part of the task's title" },
        title: { type: "string", description: "New title" },
        priority: { type: "number", enum: [1, 2, 3] },
        dueDate: { type: "string", description: "New due date/time (ISO or YYYY-MM-DD)" },
        estMinutes: { type: "number" },
        notes: { type: "string" },
      },
      required: ["task"],
    },
  },
  {
    name: "complete_task",
    description: "Mark an open task as done. Repeating tasks schedule their next occurrence.",
    input_schema: {
      type: "object",
      properties: { task: { type: "string", description: "Part of the task's title" } },
      required: ["task"],
    },
  },
  {
    name: "delete_task",
    description:
      "Delete an open task he doesn't want anymore. Set deleteAll=true only when he wants every task matching the title gone.",
    input_schema: {
      type: "object",
      properties: {
        task: { type: "string", description: "Part of the task's title" },
        deleteAll: { type: "boolean", description: "Delete every matching open task (default false)" },
      },
      required: ["task"],
    },
  },
  {
    name: "dedupe_tasks",
    description:
      "Remove duplicate open tasks (same title logged twice) — keeps the oldest copy of each and deletes the rest.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "delete_meal",
    description:
      "Delete a meal logged today (mislogged or duplicate). Without a description, deletes the most recent one.",
    input_schema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Part of the meal's description (optional)" },
      },
    },
  },
  {
    name: "tick_habit",
    description: "Tick (or untick) one of his daily habits for today.",
    input_schema: {
      type: "object",
      properties: {
        habit: { type: "string", description: "Part of the habit's name" },
        done: { type: "boolean", description: "false to untick (default true)" },
      },
      required: ["habit"],
    },
  },
  {
    name: "update_targets",
    description:
      "Change his daily nutrition targets: calories, protein, carbs, fat, or water.",
    input_schema: {
      type: "object",
      properties: {
        calorieTarget: { type: "number", description: "kcal/day" },
        proteinTarget: { type: "number", description: "g/day" },
        carbTarget: { type: "number", description: "g/day" },
        fatTarget: { type: "number", description: "g/day" },
        waterTargetMl: { type: "number", description: "ml/day" },
      },
    },
  },
  {
    name: "sync_workouts",
    description: "Import his latest workouts from Hevy right now.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "set_training_split",
    description:
      "Change his weekly training split — set what he trains on specific weekdays (e.g. thursday → Lower, friday → Rest). Days not mentioned keep their current value.",
    input_schema: {
      type: "object",
      properties: {
        changes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              day: {
                type: "string",
                enum: [
                  "monday",
                  "tuesday",
                  "wednesday",
                  "thursday",
                  "friday",
                  "saturday",
                  "sunday",
                ],
              },
              workout: {
                type: "string",
                description: "Push, Pull, Legs, Upper, Lower, Rest, or a custom name",
              },
            },
            required: ["day", "workout"],
          },
        },
      },
      required: ["changes"],
    },
  },
  {
    name: "add_bill",
    description: "Track a new recurring bill or subscription.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        amountAed: { type: "number" },
        cadence: { type: "string", enum: ["weekly", "monthly", "yearly", "once"] },
        dueDate: { type: "string", description: "Next due date YYYY-MM-DD" },
      },
      required: ["name", "amountAed"],
    },
  },
  {
    name: "mark_bill_paid",
    description:
      "Mark a bill as paid — rolls its due date forward one cadence (one-time bills are removed).",
    input_schema: {
      type: "object",
      properties: { bill: { type: "string", description: "Part of the bill's name" } },
      required: ["bill"],
    },
  },
  {
    name: "add_goal",
    description: "Create a new goal he wants to start tracking.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        category: {
          type: "string",
          enum: ["business", "fitness", "money", "study", "personal"],
        },
        targetDate: { type: "string", description: "YYYY-MM-DD (default ~3 months out)" },
        description: { type: "string", description: "Why it matters / current status (optional)" },
        metricUnit: { type: "string", description: "e.g. AED, kg (optional)" },
        targetValue: { type: "number" },
        currentValue: { type: "number" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_goal",
    description:
      "Update one of his goals: rewrite the status/description note, mark it done or archived, move the target date, or set the current metric value. Match the goal by part of its title.",
    input_schema: {
      type: "object",
      properties: {
        goal: { type: "string", description: "Part of the goal's title" },
        description: { type: "string", description: "New status/description text (replaces the old)" },
        status: { type: "string", enum: ["active", "done", "archived"] },
        targetDate: { type: "string", description: "New target date YYYY-MM-DD" },
        currentValue: { type: "number", description: "New current metric value" },
      },
      required: ["goal"],
    },
  },
  {
    name: "set_milestone",
    description: "Tick or untick a milestone on one of his goals.",
    input_schema: {
      type: "object",
      properties: {
        goal: { type: "string", description: "Part of the goal's title" },
        milestone: { type: "string", description: "Part of the milestone's title" },
        done: { type: "boolean", description: "true = completed (default true)" },
      },
      required: ["goal", "milestone"],
    },
  },
  {
    name: "add_milestone",
    description: "Add a new milestone step to one of his goals.",
    input_schema: {
      type: "object",
      properties: {
        goal: { type: "string", description: "Part of the goal's title" },
        title: { type: "string" },
        dueDate: { type: "string", description: "YYYY-MM-DD (optional)" },
      },
      required: ["goal", "title"],
    },
  },
  {
    name: "add_note",
    description:
      "Create a note in his Notes page. Use when he asks to write something down, save an idea, " +
      "or make a note. Optionally file it under a section by name (e.g. Twinly, Gym) — the " +
      "section is created if it doesn't exist.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short note title" },
        content: { type: "string", description: "The note's body (plain text)" },
        section: { type: "string", description: "Section name to file it under (optional)" },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "append_note",
    description:
      "Add lines to the end of one of his existing notes. Match the note by part of its title.",
    input_schema: {
      type: "object",
      properties: {
        note: { type: "string", description: "Part of the note's title" },
        content: { type: "string", description: "Text to append" },
      },
      required: ["note", "content"],
    },
  },
  {
    name: "remember",
    description:
      "Save one short fact to your long-term memory — it persists across all future conversations " +
      "and AI features. Use when he says 'remember …' or shares a lasting preference, fact, or " +
      "deadline worth keeping. Don't save trivia or anything already in his live data.",
    input_schema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The fact to remember, one short plain sentence",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "forget",
    description:
      "Delete a saved long-term memory that is wrong, obsolete, or that he asks you to forget. " +
      "Match it by part of its text.",
    input_schema: {
      type: "object",
      properties: {
        memory: { type: "string", description: "Part of the memory's text" },
      },
      required: ["memory"],
    },
  },
  {
    name: "add_notion_expense",
    description:
      "Add a business expense row to his Twinly Notion expenses database. Use when he asks to add/track an expense in Notion.",
    input_schema: {
      type: "object",
      properties: {
        item: { type: "string", description: "What was bought" },
        amountAed: { type: "number", description: "Amount in AED" },
        category: { type: "string", description: "e.g. Product, Marketing, Shipping (optional)" },
        date: { type: "string", description: "YYYY-MM-DD (defaults to today)" },
      },
      required: ["item", "amountAed"],
    },
  },
];

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

/** Accept "YYYY-MM-DD" or a full ISO datetime; null when unparseable. */
function toDate(v: unknown): Date | null {
  const s = str(v);
  if (!s) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00.000Z` : s;
  return Number.isNaN(Date.parse(iso)) ? null : new Date(iso);
}

/** Find one goal by (partial) title; the error teaches the model his titles. */
async function findGoal(userId: string, q: string) {
  const goals = await prisma.goal.findMany({
    where: { userId, status: "active" },
    include: { milestones: { orderBy: { order: "asc" } } },
  });
  const needle = q.trim().toLowerCase();
  const hits = goals.filter((g) => g.title.toLowerCase().includes(needle));
  if (hits.length === 1) return hits[0];
  const titles = goals.map((g) => `"${g.title}"`).join(", ") || "none";
  if (hits.length === 0) {
    throw new Error(`No active goal matches "${q}". His active goals: ${titles}`);
  }
  throw new Error(
    `Several goals match "${q}": ${hits.map((g) => `"${g.title}"`).join(", ")} — be more specific`,
  );
}

const GOAL_CATEGORIES = ["business", "fitness", "money", "study", "personal"];

/** Open tasks whose title contains q, oldest first, plus all open titles. */
async function findOpenTasks(userId: string, q: string) {
  const tasks = await prisma.task.findMany({
    where: { userId, done: false },
    include: { steps: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  const needle = q.trim().toLowerCase();
  const hits = tasks.filter((t) => t.title.toLowerCase().includes(needle));
  const titles = tasks.map((t) => `"${t.title}"`).slice(0, 20).join(", ") || "none";
  return { hits, titles };
}

/** Exactly one open task, or a teaching error (identical dupes hinted). */
async function findOneTask(userId: string, q: string) {
  const { hits, titles } = await findOpenTasks(userId, q);
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) {
    throw new Error(`No open task matches "${q}". His open tasks: ${titles}`);
  }
  const unique = new Set(hits.map((t) => t.title.toLowerCase()));
  if (unique.size === 1) {
    throw new Error(
      `"${hits[0].title}" exists ${hits.length} times — use dedupe_tasks to clean duplicates, or delete_task with deleteAll:true`,
    );
  }
  throw new Error(
    `Several open tasks match "${q}": ${hits.map((t) => `"${t.title}"`).join(", ")} — be more specific`,
  );
}

/** Run one tool for this user; always returns a short result line. */
export async function executeCoachTool(
  userId: string,
  name: string,
  rawInput: unknown,
): Promise<string> {
  const input = (rawInput ?? {}) as Record<string, unknown>;

  switch (name) {
    case "add_task": {
      const title = str(input.title);
      if (!title) throw new Error("title is required");
      const priority = [1, 2, 3].includes(input.priority as number)
        ? (input.priority as number)
        : 2;
      const due = str(input.dueDate);
      const dueDate = due && !Number.isNaN(Date.parse(due)) ? new Date(due) : null;
      const est = num(input.estMinutes);
      await prisma.task.create({
        data: {
          userId,
          title: title.slice(0, 300),
          priority,
          dueDate,
          estMinutes: est ? Math.round(est) : null,
          notes: str(input.notes)?.slice(0, 2000) ?? null,
        },
      });
      return `✓ Task added: "${title}" (P${priority}${dueDate ? `, due ${dayString(dueDate)}` : ""}${est ? `, ~${Math.round(est)}m` : ""})`;
    }

    case "log_meal": {
      const description = str(input.description);
      const calories = num(input.calories);
      if (!description || calories == null) {
        throw new Error("description and calories are required");
      }
      await prisma.meal.create({
        data: {
          userId,
          description: description.slice(0, 500),
          calories: Math.round(calories),
          protein: num(input.protein) ?? 0,
          carbs: num(input.carbs) ?? 0,
          fat: num(input.fat) ?? 0,
          source: "text",
        },
      });
      return `✓ Meal logged: ${description} (${Math.round(calories)} kcal, ${num(input.protein) ?? 0}g protein)`;
    }

    case "log_water": {
      const amountMl = num(input.amountMl);
      if (!amountMl || amountMl <= 0 || amountMl > 5000) {
        throw new Error("amountMl must be 1–5000");
      }
      await prisma.waterLog.create({
        data: { userId, amountMl: Math.round(amountMl) },
      });
      return `✓ Water logged: ${Math.round(amountMl)}ml`;
    }

    case "log_weight": {
      const weightKg = num(input.weightKg);
      if (!weightKg || weightKg < 20 || weightKg > 400) {
        throw new Error("weightKg must be 20–400");
      }
      await prisma.bodyweightEntry.create({
        data: { userId, weightKg, source: "manual" },
      });
      return `✓ Bodyweight logged: ${weightKg} kg`;
    }

    case "set_activity_status": {
      const status = str(input.status);
      if (!status || !["active", "sick", "injured", "break"].includes(status)) {
        throw new Error("status must be active|sick|injured|break");
      }
      const days = num(input.days);
      const statusUntil =
        status === "active" || days == null
          ? null
          : new Date(Date.now() + Math.min(60, Math.max(1, days)) * 86_400_000);
      await prisma.settings.update({
        where: { userId },
        data: { activityStatus: status, statusUntil },
      });
      return `✓ Activity status set to ${status}${statusUntil ? ` until ${dayString(statusUntil)}` : ""}`;
    }

    case "update_task": {
      const q = str(input.task);
      if (!q) throw new Error("task is required");
      const task = await findOneTask(userId, q);
      const changes: string[] = [];
      const data: Record<string, unknown> = {};
      const title = str(input.title);
      if (title) {
        data.title = title.slice(0, 300);
        changes.push(`renamed to "${title}"`);
      }
      if ([1, 2, 3].includes(input.priority as number)) {
        data.priority = input.priority;
        changes.push(`P${input.priority}`);
      }
      const dueDate = toDate(input.dueDate);
      if (dueDate) {
        data.dueDate = dueDate;
        changes.push(`due ${dayString(dueDate)}`);
      }
      const est = num(input.estMinutes);
      if (est) {
        data.estMinutes = Math.round(est);
        changes.push(`~${Math.round(est)}m`);
      }
      const notes = str(input.notes);
      if (notes) {
        data.notes = notes.slice(0, 2000);
        changes.push("notes updated");
      }
      if (changes.length === 0) throw new Error("Nothing to change");
      await prisma.task.update({ where: { id: task.id }, data });
      return `✓ Task updated: "${task.title}" — ${changes.join(", ")}`;
    }

    case "complete_task": {
      const q = str(input.task);
      if (!q) throw new Error("task is required");
      const task = await findOneTask(userId, q);
      await prisma.task.update({
        where: { id: task.id },
        data: {
          done: true,
          doneAt: new Date(),
          // A running focus timer banks its elapsed minutes, like the UI.
          ...(task.timerStartedAt
            ? {
                actualMinutes:
                  (task.actualMinutes ?? 0) + bankedMinutes(task.timerStartedAt),
                timerStartedAt: null,
              }
            : {}),
        },
      });
      let spawned = "";
      if (task.repeat) {
        const next = nextOccurrence(task.dueDate ?? new Date(), task.repeat);
        await prisma.task.create({
          data: {
            userId,
            title: task.title,
            notes: task.notes,
            dueDate: next,
            priority: task.priority,
            color: task.color,
            estMinutes: task.estMinutes,
            reminderLead: task.reminderLead,
            repeat: task.repeat,
            steps: {
              create: task.steps.map((s) => ({
                title: s.title,
                estMinutes: s.estMinutes,
                order: s.order,
              })),
            },
          },
        });
        spawned = ` — next one scheduled for ${dayString(next)}`;
      }
      return `✓ Task completed: "${task.title}"${spawned}`;
    }

    case "delete_task": {
      const q = str(input.task);
      if (!q) throw new Error("task is required");
      if (input.deleteAll === true) {
        const { hits, titles } = await findOpenTasks(userId, q);
        if (hits.length === 0) {
          throw new Error(`No open task matches "${q}". His open tasks: ${titles}`);
        }
        await prisma.task.deleteMany({ where: { id: { in: hits.map((t) => t.id) } } });
        return `✓ Deleted ${hits.length} task${hits.length === 1 ? "" : "s"} matching "${q}"`;
      }
      const task = await findOneTask(userId, q);
      await prisma.task.delete({ where: { id: task.id } });
      return `✓ Task deleted: "${task.title}"`;
    }

    case "dedupe_tasks": {
      const tasks = await prisma.task.findMany({
        where: { userId, done: false },
        orderBy: { createdAt: "asc" },
      });
      const seen = new Map<string, number>();
      const removeIds: string[] = [];
      const removedTitles = new Map<string, number>();
      for (const t of tasks) {
        const key = t.title.trim().toLowerCase();
        if (seen.has(key)) {
          removeIds.push(t.id);
          removedTitles.set(t.title, (removedTitles.get(t.title) ?? 0) + 1);
        } else {
          seen.set(key, 1);
        }
      }
      if (removeIds.length === 0) return "No duplicate tasks found — the list is clean.";
      await prisma.task.deleteMany({ where: { id: { in: removeIds } } });
      const detail = [...removedTitles.entries()]
        .map(([t, n]) => `"${t}"${n > 1 ? ` ×${n}` : ""}`)
        .join(", ");
      return `✓ Removed ${removeIds.length} duplicate task${removeIds.length === 1 ? "" : "s"} (kept the originals): ${detail}`;
    }

    case "delete_meal": {
      const { start, end } = dayRange();
      const meals = await prisma.meal.findMany({
        where: { userId, eatenAt: { gte: start, lt: end } },
        orderBy: { eatenAt: "desc" },
      });
      if (meals.length === 0) throw new Error("No meals logged today");
      const q = str(input.description)?.toLowerCase();
      const target = q
        ? meals.find((m) => m.description.toLowerCase().includes(q))
        : meals[0];
      if (!target) {
        throw new Error(
          `No meal today matches "${q}". Today's meals: ${meals.map((m) => `"${m.description}"`).join(", ")}`,
        );
      }
      await prisma.meal.delete({ where: { id: target.id } });
      return `✓ Meal deleted: ${target.description} (${target.calories} kcal, ${target.protein}g protein)`;
    }

    case "tick_habit": {
      const q = str(input.habit);
      if (!q) throw new Error("habit is required");
      const habits = await prisma.habit.findMany({
        where: { userId, archived: false },
      });
      const needle = q.toLowerCase();
      const hits = habits.filter((h) => h.name.toLowerCase().includes(needle));
      if (hits.length !== 1) {
        const titles = habits.map((h) => `"${h.name}"`).join(", ") || "none";
        throw new Error(
          hits.length === 0
            ? `No habit matches "${q}". His habits: ${titles}`
            : `Several habits match "${q}": ${hits.map((h) => `"${h.name}"`).join(", ")}`,
        );
      }
      const day = dayString();
      if (input.done === false) {
        await prisma.habitLog.deleteMany({ where: { habitId: hits[0].id, day } });
        return `✓ Habit unticked for today: ${hits[0].name}`;
      }
      await prisma.habitLog.upsert({
        where: { habitId_day: { habitId: hits[0].id, day } },
        create: { habitId: hits[0].id, day },
        update: {},
      });
      return `✓ Habit ticked for today: ${hits[0].name}`;
    }

    case "update_targets": {
      const ranges: Record<string, [number, number, string]> = {
        calorieTarget: [800, 6000, "kcal"],
        proteinTarget: [40, 400, "g"],
        carbTarget: [20, 800, "g"],
        fatTarget: [10, 300, "g"],
        waterTargetMl: [500, 8000, "ml"],
      };
      const data: Record<string, number> = {};
      const changes: string[] = [];
      for (const [field, [min, max, unit]] of Object.entries(ranges)) {
        const v = num(input[field]);
        if (v == null) continue;
        if (v < min || v > max) {
          throw new Error(`${field} must be ${min}–${max} ${unit}`);
        }
        data[field] = Math.round(v);
        changes.push(`${field.replace("Target", "").replace("Ml", "")} → ${Math.round(v)}${unit}`);
      }
      if (changes.length === 0) throw new Error("Pass at least one target to change");
      await prisma.settings.update({ where: { userId }, data });
      return `✓ Targets updated: ${changes.join(", ")}`;
    }

    case "sync_workouts": {
      const r = await syncHevyForUser(userId);
      if (!r.connected) throw new Error(r.message ?? "Hevy isn't connected");
      if (r.message) throw new Error(r.message);
      return `✓ Hevy synced: ${r.imported} new workout${r.imported === 1 ? "" : "s"} imported (${r.total} checked)`;
    }

    case "set_training_split": {
      const changes = Array.isArray(input.changes) ? input.changes : [];
      if (changes.length === 0) throw new Error("changes is required");
      const DAY_INDEX: Record<string, number> = {
        monday: 0,
        tuesday: 1,
        wednesday: 2,
        thursday: 3,
        friday: 4,
        saturday: 5,
        sunday: 6,
      };
      const plan = await ensureTrainingPlan(userId);
      const days = [...plan.days];
      const applied: string[] = [];
      for (const raw of changes) {
        const c = (raw ?? {}) as Record<string, unknown>;
        const day = str(c.day)?.toLowerCase();
        const workout = str(c.workout);
        if (!day || !(day in DAY_INDEX) || !workout) {
          throw new Error("each change needs day (monday–sunday) and workout");
        }
        const w = workout.slice(0, 20);
        const norm = w.charAt(0).toUpperCase() + w.slice(1);
        days[DAY_INDEX[day]] = norm;
        applied.push(`${day.charAt(0).toUpperCase()}${day.slice(1, 3)} → ${norm}`);
      }
      await prisma.trainingPlan.update({ where: { userId }, data: { days } });
      const week = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        .map((d, i) => `${d} ${days[i]}`)
        .join(" · ");
      return `✓ Split updated (${applied.join(", ")}). Week now: ${week}`;
    }

    case "add_bill": {
      const name = str(input.name);
      const amountAed = num(input.amountAed);
      if (!name || amountAed == null || amountAed <= 0) {
        throw new Error("name and a positive amountAed are required");
      }
      const cadence = ["weekly", "monthly", "yearly", "once"].includes(
        input.cadence as string,
      )
        ? (input.cadence as string)
        : "monthly";
      const nextDueDate =
        toDate(input.dueDate) ?? new Date(Date.now() + 30 * 86_400_000);
      await prisma.bill.create({
        data: { userId, name: name.slice(0, 200), amountAed, cadence, nextDueDate },
      });
      return `✓ Bill added: ${name} — AED ${amountAed} ${cadence}, next due ${dayString(nextDueDate)}`;
    }

    case "mark_bill_paid": {
      const q = str(input.bill);
      if (!q) throw new Error("bill is required");
      const bills = await prisma.bill.findMany({ where: { userId } });
      const needle = q.toLowerCase();
      const hits = bills.filter((b) => b.name.toLowerCase().includes(needle));
      if (hits.length !== 1) {
        const names = bills.map((b) => `"${b.name}"`).join(", ") || "none";
        throw new Error(
          hits.length === 0
            ? `No bill matches "${q}". His bills: ${names}`
            : `Several bills match "${q}": ${hits.map((b) => `"${b.name}"`).join(", ")}`,
        );
      }
      const bill = hits[0];
      if (bill.cadence === "once") {
        await prisma.bill.delete({ where: { id: bill.id } });
        return `✓ Bill paid and removed (one-time): ${bill.name}`;
      }
      const next = new Date(bill.nextDueDate.getTime());
      if (bill.cadence === "weekly") next.setUTCDate(next.getUTCDate() + 7);
      else if (bill.cadence === "yearly") next.setUTCFullYear(next.getUTCFullYear() + 1);
      else next.setUTCMonth(next.getUTCMonth() + 1);
      await prisma.bill.update({ where: { id: bill.id }, data: { nextDueDate: next } });
      return `✓ Bill paid: ${bill.name} — next due ${dayString(next)}`;
    }

    case "add_goal": {
      const title = str(input.title);
      if (!title) throw new Error("title is required");
      const category = GOAL_CATEGORIES.includes(input.category as string)
        ? (input.category as string)
        : "personal";
      const targetDate =
        toDate(input.targetDate) ?? new Date(Date.now() + 90 * 86_400_000);
      await prisma.goal.create({
        data: {
          userId,
          title: title.slice(0, 300),
          category,
          targetDate,
          description: str(input.description)?.slice(0, 2000) ?? null,
          metricUnit: str(input.metricUnit)?.slice(0, 20) ?? null,
          targetValue: num(input.targetValue),
          currentValue: num(input.currentValue),
          startValue: num(input.currentValue),
        },
      });
      return `✓ Goal added: "${title}" (${category}, target ${dayString(targetDate)})`;
    }

    case "update_goal": {
      const q = str(input.goal);
      if (!q) throw new Error("goal is required");
      const goal = await findGoal(userId, q);
      const changes: string[] = [];
      const data: Record<string, unknown> = {};
      const description = str(input.description);
      if (description) {
        data.description = description.slice(0, 2000);
        changes.push("note updated");
      }
      const status = str(input.status);
      if (status) {
        if (!["active", "done", "archived"].includes(status)) {
          throw new Error("status must be active|done|archived");
        }
        data.status = status;
        changes.push(`marked ${status}`);
      }
      const targetDate = toDate(input.targetDate);
      if (targetDate) {
        data.targetDate = targetDate;
        changes.push(`target → ${dayString(targetDate)}`);
      }
      const currentValue = num(input.currentValue);
      if (currentValue != null) {
        data.currentValue = currentValue;
        changes.push(
          `now ${currentValue}${goal.metricUnit ? ` ${goal.metricUnit}` : ""}${goal.targetValue != null ? ` of ${goal.targetValue}` : ""}`,
        );
      }
      if (changes.length === 0) {
        throw new Error("Nothing to change — pass description, status, targetDate or currentValue");
      }
      await prisma.goal.update({ where: { id: goal.id }, data });
      return `✓ Goal updated: "${goal.title}" — ${changes.join(", ")}`;
    }

    case "set_milestone": {
      const gq = str(input.goal);
      const mq = str(input.milestone);
      if (!gq || !mq) throw new Error("goal and milestone are required");
      const goal = await findGoal(userId, gq);
      const needle = mq.toLowerCase();
      const hits = goal.milestones.filter((m) =>
        m.title.toLowerCase().includes(needle),
      );
      if (hits.length !== 1) {
        const titles = goal.milestones.map((m) => `"${m.title}"`).join(", ") || "none";
        throw new Error(
          hits.length === 0
            ? `No milestone matches "${mq}" on "${goal.title}". Its milestones: ${titles}`
            : `Several milestones match "${mq}" — be more specific: ${hits.map((m) => `"${m.title}"`).join(", ")}`,
        );
      }
      const done = input.done !== false;
      await prisma.goalMilestone.update({
        where: { id: hits[0].id },
        data: { done, doneAt: done ? new Date() : null },
      });
      const doneCount =
        goal.milestones.filter((m) => (m.id === hits[0].id ? done : m.done)).length;
      return `✓ Milestone ${done ? "completed" : "reopened"}: "${hits[0].title}" (${goal.title}: ${doneCount}/${goal.milestones.length} done)`;
    }

    case "add_milestone": {
      const gq = str(input.goal);
      const title = str(input.title);
      if (!gq || !title) throw new Error("goal and title are required");
      const goal = await findGoal(userId, gq);
      const order =
        goal.milestones.reduce((max, m) => Math.max(max, m.order), 0) + 1;
      await prisma.goalMilestone.create({
        data: {
          goalId: goal.id,
          title: title.slice(0, 300),
          dueDate: toDate(input.dueDate),
          order,
        },
      });
      const total = goal.milestones.length + 1;
      return `✓ Milestone added to "${goal.title}": "${title}" (now ${total} step${total === 1 ? "" : "s"})`;
    }

    case "add_note": {
      const title = str(input.title);
      const content = str(input.content);
      if (!title || !content) throw new Error("title and content are required");
      let folderId: string | null = null;
      const section = str(input.section);
      if (section) {
        const folders = await prisma.noteFolder.findMany({ where: { userId } });
        const hit = folders.find(
          (f) => f.name.toLowerCase() === section.toLowerCase(),
        );
        if (hit) {
          folderId = hit.id;
        } else {
          const last = folders.reduce((m, f) => Math.max(m, f.sortOrder), 0);
          const created = await prisma.noteFolder.create({
            data: { userId, name: section.slice(0, 60), sortOrder: last + 1 },
          });
          folderId = created.id;
        }
      }
      await prisma.note.create({
        data: {
          userId,
          folderId,
          title: title.slice(0, 200),
          content: content.slice(0, 50_000),
        },
      });
      return `✓ Note added: "${title}"${section ? ` (${section})` : ""}`;
    }

    case "append_note": {
      const q = str(input.note);
      const content = str(input.content);
      if (!q || !content) throw new Error("note and content are required");
      const notes = await prisma.note.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
      });
      const needle = q.toLowerCase();
      const hits = notes.filter((n) => n.title.toLowerCase().includes(needle));
      if (hits.length === 0) {
        const titles = notes.map((n) => `"${n.title}"`).slice(0, 20).join(", ") || "none";
        throw new Error(`No note matches "${q}". His notes: ${titles}`);
      }
      if (hits.length > 1) {
        throw new Error(
          `Several notes match "${q}": ${hits.map((n) => `"${n.title}"`).join(", ")} — be more specific`,
        );
      }
      const note = hits[0];
      const merged = `${note.content.replace(/\s+$/, "")}\n${content}`.slice(0, 50_000);
      await prisma.note.update({
        where: { id: note.id },
        data: { content: merged },
      });
      return `✓ Added to note "${note.title}"`;
    }

    case "remember": {
      const content = str(input.content);
      if (!content) throw new Error("content is required");
      const trimmed = content.slice(0, 500);
      const existing = await prisma.aiMemory.findMany({ where: { userId } });
      if (existing.some((m) => m.content.trim().toLowerCase() === trimmed.trim().toLowerCase())) {
        return `Already in memory: "${trimmed}"`;
      }
      if (existing.length >= 100) {
        throw new Error("Memory is full (100 facts) — forget something first");
      }
      await prisma.aiMemory.create({
        data: { userId, content: trimmed, source: "agent" },
      });
      return `✓ Saved to memory: "${trimmed}"`;
    }

    case "forget": {
      const q = str(input.memory);
      if (!q) throw new Error("memory is required");
      const memories = await prisma.aiMemory.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      });
      const needle = q.toLowerCase();
      const hits = memories.filter((m) => m.content.toLowerCase().includes(needle));
      if (hits.length === 0) {
        const all = memories.map((m) => `"${m.content}"`).slice(0, 30).join(", ") || "none";
        throw new Error(`No memory matches "${q}". Saved memories: ${all}`);
      }
      if (hits.length > 1) {
        throw new Error(
          `Several memories match "${q}": ${hits.map((m) => `"${m.content}"`).join(", ")} — be more specific`,
        );
      }
      await prisma.aiMemory.delete({ where: { id: hits[0].id } });
      return `✓ Forgotten: "${hits[0].content}"`;
    }

    case "add_notion_expense": {
      if (!notionConfigured()) {
        throw new Error("Notion isn't connected (set NOTION_TOKEN and NOTION_EXPENSES_DB_ID)");
      }
      const item = str(input.item);
      const amountAed = num(input.amountAed);
      if (!item || amountAed == null || amountAed <= 0) {
        throw new Error("item and a positive amountAed are required");
      }
      const date = str(input.date) ?? dayString();
      const category = str(input.category) ?? undefined;
      const notionId = await createExpense({
        title: item.slice(0, 200),
        amountAed,
        date,
        category,
      });
      // Mirror into the local cache so Businesses shows it immediately.
      await prisma.twinlyExpense.upsert({
        where: { notionId },
        create: {
          userId,
          notionId,
          title: item.slice(0, 200),
          category: category ?? null,
          amountAed,
          date: new Date(`${date}T00:00:00.000Z`),
        },
        update: {},
      });
      return `✓ Notion expense added: ${item} — AED ${amountAed}${category ? ` (${category})` : ""} on ${date}`;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

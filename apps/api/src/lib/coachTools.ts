// The coach's hands: a curated set of safe, single-user actions Claude can
// take from chat. Every executor returns a short human-readable result that
// doubles as the tool_result the model sees.
import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../db";
import { createExpense, notionConfigured } from "../integrations/notion";
import { dayString } from "./time";

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

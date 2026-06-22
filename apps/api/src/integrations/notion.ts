// Notion adapter — read-only pull of the Twinly "Business Expenses" database.
// The database's property *names* are unknown, so we introspect the schema and
// map by property *type* (number → amount, date → date, select/status → category).
import { env } from "../env";

const BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export function notionConfigured(): boolean {
  return Boolean(env.NOTION_TOKEN && env.NOTION_EXPENSES_DB_ID);
}

async function notionFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Notion API ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export interface ParsedExpense {
  notionId: string;
  title: string | null;
  category: string | null;
  amountAed: number;
  date: string | null;
}

interface PropMap {
  amount?: string;
  date?: string;
  category?: string;
  title?: string;
}

async function discoverProps(dbId: string): Promise<PropMap> {
  const db = await notionFetch<{
    properties: Record<string, { type: string }>;
  }>(`/databases/${dbId}`);
  const map: PropMap = {};
  for (const [name, prop] of Object.entries(db.properties)) {
    if (prop.type === "title") map.title = name;
    else if (prop.type === "number" && !map.amount) map.amount = name;
    else if (prop.type === "date" && !map.date) map.date = name;
    else if (
      !map.category &&
      (prop.type === "select" ||
        prop.type === "status" ||
        prop.type === "multi_select")
    ) {
      map.category = name;
    }
  }
  return map;
}

function readTitle(prop: unknown): string | null {
  const arr = (prop as { title?: { plain_text?: string }[] })?.title;
  return arr?.map((t) => t.plain_text ?? "").join("") || null;
}
function readNumber(prop: unknown): number | null {
  const n = (prop as { number?: number | null })?.number;
  return typeof n === "number" ? n : null;
}
function readDate(prop: unknown): string | null {
  return (prop as { date?: { start?: string } })?.date?.start ?? null;
}
function readCategory(prop: unknown): string | null {
  const p = prop as {
    select?: { name?: string };
    status?: { name?: string };
    multi_select?: { name?: string }[];
  };
  return (
    p?.select?.name ??
    p?.status?.name ??
    p?.multi_select?.map((m) => m.name).join(", ") ??
    null
  );
}

/** Pull every expense row, mapping by discovered property types. */
export async function fetchExpenses(): Promise<ParsedExpense[]> {
  const dbId = env.NOTION_EXPENSES_DB_ID as string;
  const props = await discoverProps(dbId);
  const out: ParsedExpense[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const data = await notionFetch<{
      results: { id: string; properties: Record<string, unknown> }[];
      has_more: boolean;
      next_cursor: string | null;
    }>(`/databases/${dbId}/query`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    for (const page of data.results) {
      const p = page.properties;
      const amount = props.amount ? readNumber(p[props.amount]) : null;
      if (amount == null) continue; // skip rows without an amount
      out.push({
        notionId: page.id,
        title: props.title ? readTitle(p[props.title]) : null,
        category: props.category ? readCategory(p[props.category]) : null,
        amountAed: amount,
        date: props.date ? readDate(p[props.date]) : null,
      });
    }
    cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return out;
}

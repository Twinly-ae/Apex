import { Check, ChevronLeft, ChevronRight, Repeat } from "lucide-react";
import { useMemo, useState } from "react";
import type { Task } from "@apex/shared";
import { TASK_COLOR_HEX } from "../../lib/taskColors";
import { useUpdateTask } from "../../lib/queries";

/* Month calendar over task due dates: dots per day, tap a day for its list.
   Repeating tasks are projected forward as faint "ghost" occurrences so
   "what's on Tuesday?" works even before the next instance exists. */

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"]; // Monday-first

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const dotColor = (t: Task, overdue: boolean): string => {
  if (overdue) return "#fb7185";
  return t.color ? TASK_COLOR_HEX[t.color] : "rgb(var(--accent))";
};

function timeLabel(iso: string): string | null {
  const d = new Date(iso);
  if (d.getHours() === 0 && d.getMinutes() === 0) return null; // date-only
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Future occurrences of a repeating task inside [from, to], as day keys. */
function projectRepeats(task: Task, from: Date, to: Date): string[] {
  if (!task.repeat || task.done || !task.dueDate) return [];
  const out: string[] = [];
  const d = new Date(task.dueDate);
  for (let i = 0; i < 200; i++) {
    if (task.repeat === "weekly") {
      d.setDate(d.getDate() + 7);
    } else {
      d.setDate(d.getDate() + 1);
      if (task.repeat === "weekdays") {
        while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
      }
    }
    if (d.getTime() > to.getTime()) break;
    if (d.getTime() >= from.getTime()) out.push(dayKey(d));
  }
  return out;
}

export function TaskCalendar({
  tasks,
  onEdit,
}: {
  tasks: Task[];
  onEdit: (t: Task) => void;
}) {
  const update = useUpdateTask();
  const today = dayKey(new Date());
  const [anchor, setAnchor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selected, setSelected] = useState(today);

  const { cells, byDay, ghostsByDay, undated } = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59);
    const daysInMonth = last.getDate();
    const leading = (first.getDay() + 6) % 7; // Monday-first blanks

    const byDay = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const k = dayKey(new Date(t.dueDate));
      byDay.set(k, [...(byDay.get(k) ?? []), t]);
    }
    const ghostsByDay = new Map<string, Task[]>();
    for (const t of tasks) {
      for (const k of projectRepeats(t, first, last)) {
        ghostsByDay.set(k, [...(ghostsByDay.get(k) ?? []), t]);
      }
    }

    const cells: (string | null)[] = [
      ...Array.from({ length: leading }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) =>
        dayKey(new Date(anchor.getFullYear(), anchor.getMonth(), i + 1)),
      ),
    ];
    const undated = tasks.filter((t) => !t.done && !t.dueDate).length;
    return { cells, byDay, ghostsByDay, undated };
  }, [tasks, anchor]);

  const monthLabel = anchor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const move = (n: number) =>
    setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + n, 1));

  const dayTasks = [...(byDay.get(selected) ?? [])].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
  });
  const dayGhosts = ghostsByDay.get(selected) ?? [];
  const selectedLabel = new Date(`${selected}T12:00:00`).toLocaleDateString(
    undefined,
    { weekday: "long", month: "short", day: "numeric" },
  );

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => move(-1)}
            className="rounded-lg bg-surface-2 p-2 text-muted"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-semibold text-text">{monthLabel}</p>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => move(1)}
            className="rounded-lg bg-surface-2 p-2 text-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((w, i) => (
            <span key={`${w}${i}`} className="pb-1 text-[10px] font-medium uppercase text-muted">
              {w}
            </span>
          ))}
          {cells.map((k, i) =>
            k === null ? (
              <span key={`b${i}`} />
            ) : (
              <button
                key={k}
                type="button"
                onClick={() => setSelected(k)}
                aria-pressed={selected === k}
                className={`flex h-11 flex-col items-center justify-center rounded-xl transition-colors ${
                  selected === k
                    ? "bg-accent text-white"
                    : k === today
                      ? "bg-surface-2 text-text ring-1 ring-inset ring-accent/60"
                      : "text-text active:bg-surface-2"
                }`}
              >
                <span className="text-[13px] font-medium leading-none">
                  {Number(k.slice(8))}
                </span>
                <span className="mt-1 flex h-1.5 items-center gap-0.5">
                  {(byDay.get(k) ?? [])
                    .filter((t) => !t.done)
                    .slice(0, 3)
                    .map((t) => (
                      <span
                        key={t.id}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          background:
                            selected === k ? "#fff" : dotColor(t, k < today),
                        }}
                      />
                    ))}
                  {(ghostsByDay.get(k) ?? []).length > 0 && (
                    <span
                      className={`h-1.5 w-1.5 rounded-full border ${
                        selected === k ? "border-white/80" : "border-accent/60"
                      }`}
                    />
                  )}
                </span>
              </button>
            ),
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">
          {selectedLabel}
        </h2>
        {dayTasks.length === 0 && dayGhosts.length === 0 ? (
          <p className="py-3 text-sm text-muted">Nothing due this day.</p>
        ) : (
          <ul className="space-y-2">
            {dayTasks.map((t) => {
              const time = t.dueDate ? timeLabel(t.dueDate) : null;
              const overdue = !t.done && selected < today;
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-xl bg-surface p-3"
                >
                  <button
                    type="button"
                    aria-label={t.done ? "Mark not done" : "Mark done"}
                    onClick={() =>
                      update.mutate({ id: t.id, input: { done: !t.done } })
                    }
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      t.done ? "bg-accent text-white" : "ring-1 ring-inset ring-line"
                    }`}
                  >
                    {t.done && <Check className="h-4 w-4" strokeWidth={3} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(t)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p
                      className={`truncate text-[15px] ${
                        t.done ? "text-muted line-through" : "text-text"
                      }`}
                    >
                      {t.title}
                    </p>
                    <p className="text-xs text-muted">
                      {overdue ? "Overdue · " : ""}
                      {time ? `${time} · ` : ""}P{t.priority}
                      {t.repeat ? " · repeats" : ""}
                    </p>
                  </button>
                  <span
                    className="h-8 w-1 shrink-0 rounded-full"
                    style={{ background: dotColor(t, overdue) }}
                  />
                </li>
              );
            })}
            {dayGhosts.map((t) => (
              <li
                key={`g${t.id}`}
                className="flex items-center gap-3 rounded-xl bg-surface/60 p-3 opacity-60"
              >
                <Repeat className="h-4 w-4 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] text-text">{t.title}</p>
                  <p className="text-xs text-muted">
                    Repeats {t.repeat === "weekdays" ? "on weekdays" : t.repeat}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {undated > 0 && (
          <p className="mt-3 text-xs text-muted">
            {undated} open task{undated === 1 ? " has" : "s have"} no date — see
            the List view.
          </p>
        )}
      </section>
    </div>
  );
}

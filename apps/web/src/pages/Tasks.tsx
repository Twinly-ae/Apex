import { useState } from "react";
import type { Task } from "@apex/shared";
import { TaskSheet } from "../components/logging/TaskSheet";
import { useDeleteTask, useTasks, useUpdateTask } from "../lib/queries";

const PRIORITY_COLOR: Record<number, string> = {
  1: "bg-bad",
  2: "bg-warn",
  3: "bg-muted",
};

function TaskRow({ task }: { task: Task }) {
  const update = useUpdateTask();
  const del = useDeleteTask();
  return (
    <li className="flex items-center gap-3 py-3">
      <span
        className={`h-8 w-1 shrink-0 rounded-full ${PRIORITY_COLOR[task.priority]}`}
        aria-hidden
      />
      <button
        aria-label={task.done ? "Mark not done" : "Mark done"}
        onClick={() =>
          update.mutate({ id: task.id, input: { done: !task.done } })
        }
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-xs ${
          task.done ? "border-good bg-good/20 text-good" : "border-line"
        }`}
      >
        {task.done ? "✓" : ""}
      </button>
      <div className="flex-1">
        <div className={task.done ? "text-muted line-through" : "text-text"}>
          {task.title}
        </div>
        {task.dueDate && (
          <div className="text-xs text-muted">
            Due {new Date(task.dueDate).toLocaleDateString()}
          </div>
        )}
      </div>
      <button
        onClick={() => del.mutate(task.id)}
        className="-m-2 p-2 text-muted hover:text-bad"
        aria-label="Delete"
      >
        🗑
      </button>
    </li>
  );
}

export function Tasks() {
  const { data, isLoading } = useTasks();
  const [sheetOpen, setSheetOpen] = useState(false);
  const tasks = data ?? [];
  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text">Tasks</h1>
        <button
          onClick={() => setSheetOpen(true)}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white active:opacity-80"
        >
          + Add
        </button>
      </header>

      {isLoading ? (
        <div className="h-20 animate-pulse rounded-2xl bg-surface" />
      ) : tasks.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          No tasks yet. Add your first one.
        </p>
      ) : (
        <>
          <section>
            <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted">
              Open · {open.length}
            </h2>
            <ul className="divide-y divide-line">
              {open.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
              {open.length === 0 && (
                <li className="py-3 text-sm text-muted">All clear 🎉</li>
              )}
            </ul>
          </section>

          {done.length > 0 && (
            <section>
              <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted">
                Done · {done.length}
              </h2>
              <ul className="divide-y divide-line">
                {done.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <TaskSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}

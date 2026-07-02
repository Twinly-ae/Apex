import {
  Bell,
  Check,
  ChevronDown,
  Lock,
  Pencil,
  Plus,
  Repeat,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import type { Task } from "@apex/shared";
import { TaskSheet } from "../components/logging/TaskSheet";
import {
  useDeleteTask,
  useTasks,
  useUpdateTask,
  useUpdateTaskStep,
} from "../lib/queries";
import { colorHex, estLabel } from "../lib/taskColors";

const PRIORITY_PILL: Record<number, string> = {
  1: "bg-bad/15 text-bad",
  2: "bg-warn/15 text-warn",
  3: "bg-surface-2 text-muted",
};
const PRIORITY_LABEL: Record<number, string> = { 1: "High", 2: "Med", 3: "Low" };

function TaskCard({ task, onEdit }: { task: Task; onEdit: (t: Task) => void }) {
  const update = useUpdateTask();
  const del = useDeleteTask();
  const updateStep = useUpdateTaskStep();
  const [open, setOpen] = useState(false);

  const steps = task.steps;
  const doneSteps = steps.filter((s) => s.done).length;
  const hasSteps = steps.length > 0;
  const accent = colorHex(task.color);
  const est = estLabel(task.estMinutes);

  return (
    <li
      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="flex items-center gap-3 p-3.5">
        <button
          aria-label={task.done ? "Mark not done" : "Mark done"}
          onClick={() => update.mutate({ id: task.id, input: { done: !task.done } })}
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-colors active:scale-90 ${
            task.done ? "border-good bg-good/20 text-good" : "border-line"
          }`}
        >
          {task.done && <Check className="h-4 w-4" strokeWidth={3} />}
        </button>

        {/* Tappable title area — expands the steps when present */}
        <button
          onClick={() => hasSteps && setOpen((o) => !o)}
          className="min-w-0 flex-1 py-1 text-left"
        >
          <div
            className={`truncate ${task.done ? "text-muted line-through" : "text-text"}`}
          >
            {task.title}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] ${PRIORITY_PILL[task.priority]}`}
            >
              {PRIORITY_LABEL[task.priority]}
            </span>
            {est && <span>{est}</span>}
            {task.dueDate && (
              <span className="inline-flex items-center gap-1">
                Due{" "}
                {new Date(task.dueDate).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {task.reminderLead != null && (
                  <Bell className="h-3 w-3 text-accent" strokeWidth={2.5} />
                )}
              </span>
            )}
            {task.repeat && (
              <span className="inline-flex items-center gap-1 text-accent">
                <Repeat className="h-3 w-3" strokeWidth={2.5} />
                {task.repeat}
              </span>
            )}
            {hasSteps && (
              <span className="inline-flex items-center gap-1 tabular-nums text-accent">
                {doneSteps}/{steps.length} steps
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
                  strokeWidth={2.5}
                />
              </span>
            )}
          </div>
        </button>

        <button
          onClick={() => onEdit(task)}
          aria-label="Edit task"
          className="-m-1.5 p-1.5 text-muted active:text-text"
        >
          <Pencil className="h-[18px] w-[18px]" strokeWidth={2} />
        </button>
        <button
          onClick={() => del.mutate(task.id)}
          aria-label="Delete task"
          className="-m-1.5 p-1.5 text-muted active:text-bad"
        >
          <Trash2 className="h-[18px] w-[18px]" strokeWidth={2} />
        </button>
      </div>

      {/* Steps — smooth height animation; each unlocks in order */}
      {hasSteps && (
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <ul className="ml-[1.85rem] space-y-2 border-l border-line px-4 pb-3.5 pt-0.5">
              {steps.map((s, i) => {
                const unlocked = steps.slice(0, i).every((p) => p.done);
                return (
                  <li key={s.id} className="flex items-center gap-2.5 text-sm">
                    <button
                      disabled={!unlocked}
                      onClick={() =>
                        updateStep.mutate({ id: s.id, input: { done: !s.done } })
                      }
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors active:scale-90 ${
                        s.done
                          ? "border-good bg-good/20 text-good"
                          : unlocked
                            ? "border-line"
                            : "border-line/50 text-muted"
                      }`}
                      aria-label={unlocked ? "Toggle step" : "Locked"}
                    >
                      {s.done ? (
                        <Check className="h-3 w-3" strokeWidth={3} />
                      ) : !unlocked ? (
                        <Lock className="h-2.5 w-2.5" strokeWidth={2.5} />
                      ) : null}
                    </button>
                    <span
                      className={
                        s.done
                          ? "text-muted line-through"
                          : unlocked
                            ? "text-text"
                            : "text-muted"
                      }
                    >
                      {s.title}
                    </span>
                    {estLabel(s.estMinutes) && (
                      <span className="ml-auto shrink-0 text-xs tabular-nums text-muted">
                        {estLabel(s.estMinutes)?.replace("est. ", "")}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </li>
  );
}

export function Tasks() {
  const { data, isLoading } = useTasks();
  const [addOpen, setAddOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [showDone, setShowDone] = useState(false);

  const tasks = data ?? [];
  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text">Tasks</h1>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-accent to-accent-strong px-3.5 py-2 text-sm font-semibold text-white shadow-glow active:scale-[0.99]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Add
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
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">
              Open · {open.length}
            </h2>
            {open.length === 0 ? (
              <p className="py-3 text-sm text-muted">All clear.</p>
            ) : (
              <ul className="space-y-2.5">
                {open.map((t) => (
                  <TaskCard key={t.id} task={t} onEdit={setEditTask} />
                ))}
              </ul>
            )}
          </section>

          {done.length > 0 && (
            <section>
              <button
                onClick={() => setShowDone((s) => !s)}
                className="mb-2 text-sm font-medium text-accent active:opacity-70"
              >
                {showDone ? "Hide" : "Show"} completed · {done.length}
              </button>
              {showDone && (
                <ul className="space-y-2.5">
                  {done.map((t) => (
                    <TaskCard key={t.id} task={t} onEdit={setEditTask} />
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      <TaskSheet
        open={addOpen || Boolean(editTask)}
        task={editTask}
        onClose={() => {
          setAddOpen(false);
          setEditTask(null);
        }}
      />
    </div>
  );
}

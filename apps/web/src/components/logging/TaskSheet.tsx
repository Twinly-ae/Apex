import { Check, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Task, TaskColor, TaskPriority, TaskRepeat } from "@apex/shared";
import {
  useAddTask,
  useAddTaskStep,
  useDeleteTaskStep,
  useUpdateTask,
  useUpdateTaskStep,
} from "../../lib/queries";
import { TASK_COLORS, colorHex } from "../../lib/taskColors";
import { Sheet, inputClass, primaryButtonClass, selectClass } from "../ui/Sheet";

interface Props {
  open: boolean;
  onClose: () => void;
  /** When set, the sheet edits this task instead of creating a new one. */
  task?: Task | null;
}

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 1, label: "High" },
  { value: 2, label: "Medium" },
  { value: 3, label: "Low" },
];

const REMINDERS: { value: number | null; label: string }[] = [
  { value: null, label: "No reminder" },
  { value: 0, label: "At due time" },
  { value: 10, label: "10 min before" },
  { value: 30, label: "30 min before" },
  { value: 60, label: "1 hour before" },
  { value: 1440, label: "1 day before" },
];

const REPEATS: { value: TaskRepeat | null; label: string }[] = [
  { value: null, label: "No repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays (Mon–Fri)" },
  { value: "weekly", label: "Weekly" },
];

/** ISO (UTC) → a `datetime-local` value in the browser's local time. */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function TaskSheet({ open, onClose, task }: Props) {
  const add = useAddTask();
  const update = useUpdateTask();
  const addStep = useAddTaskStep();
  const updateStep = useUpdateTaskStep();
  const delStep = useDeleteTaskStep();
  const editing = Boolean(task);

  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<TaskPriority>(2);
  const [color, setColor] = useState<TaskColor | null>(null);
  const [est, setEst] = useState("");
  const [reminderLead, setReminderLead] = useState<number | null>(null);
  const [repeat, setRepeat] = useState<TaskRepeat | null>(null);
  const [notes, setNotes] = useState("");
  const [newStep, setNewStep] = useState("");
  const [newStepEst, setNewStepEst] = useState("");

  // Populate when opening an existing task (or reset for a new one).
  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDue(isoToLocalInput(task?.dueDate ?? null));
    setPriority(task?.priority ?? 2);
    setColor(task?.color ?? null);
    setEst(task?.estMinutes ? String(task.estMinutes) : "");
    setReminderLead(task?.reminderLead ?? null);
    setRepeat(task?.repeat ?? null);
    setNotes(task?.notes ?? "");
    setNewStep("");
    setNewStepEst("");
  }, [open, task]);

  const busy = add.isPending || update.isPending;

  function addCurrentStep() {
    if (!task || !newStep.trim()) return;
    addStep.mutate({
      taskId: task.id,
      title: newStep.trim(),
      estMinutes: newStepEst ? Math.round(Number(newStepEst)) : null,
    });
    setNewStep("");
    setNewStepEst("");
  }

  async function submit() {
    if (!title.trim()) return;
    const payload = {
      title: title.trim(),
      dueDate: due ? new Date(due).toISOString() : null,
      priority,
      color,
      estMinutes: est ? Math.round(Number(est)) : null,
      reminderLead: due ? reminderLead : null,
      repeat,
      notes: notes.trim() || null,
    };
    if (task) {
      await update.mutateAsync({ id: task.id, input: payload });
    } else {
      await add.mutateAsync(payload);
    }
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={editing ? "Edit task" : "Add a task"}>
      <div className="space-y-4">
        <input
          autoFocus={!editing}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          className={inputClass}
        />

        <label className="block">
          <span className="mb-1 block text-xs text-muted">
            Due date &amp; time (optional)
          </span>
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className={inputClass}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Priority</span>
            <select
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value) as TaskPriority)}
              className={selectClass}
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Reminder</span>
            <select
              value={reminderLead ?? ""}
              disabled={!due}
              onChange={(e) =>
                setReminderLead(e.target.value === "" ? null : Number(e.target.value))
              }
              className={`${selectClass} disabled:opacity-50`}
            >
              {REMINDERS.map((r) => (
                <option key={r.label} value={r.value ?? ""}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!due && (
          <p className="-mt-2 text-xs text-muted">
            Set a due date &amp; time to enable a reminder.
          </p>
        )}

        <label className="block">
          <span className="mb-1 block text-xs text-muted">Repeat</span>
          <select
            value={repeat ?? ""}
            onChange={(e) =>
              setRepeat(
                e.target.value === "" ? null : (e.target.value as TaskRepeat),
              )
            }
            className={selectClass}
          >
            {REPEATS.map((r) => (
              <option key={r.label} value={r.value ?? ""}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        {/* Colour + estimate */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="mb-1 block text-xs text-muted">Colour</span>
            <div className="flex items-center gap-2">
              {TASK_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => setColor(color === c ? null : c)}
                  className="grid h-7 w-7 place-items-center rounded-full"
                  style={{ backgroundColor: colorHex(c) }}
                >
                  {color === c && (
                    <Check className="h-4 w-4 text-white" strokeWidth={3} />
                  )}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Est. minutes</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={est}
              onChange={(e) => setEst(e.target.value)}
              placeholder="e.g. 30"
              className={inputClass}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs text-muted">Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Details…"
            className={`${inputClass} resize-none`}
          />
        </label>

        {/* Steps — only once the task exists */}
        {editing && task && (
          <div>
            <span className="mb-1 block text-xs text-muted">
              Steps (done in order)
            </span>
            {task.steps.length > 0 && (
              <ul className="mb-2 space-y-1">
                {task.steps.map((s, i) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm"
                  >
                    <span className="text-xs text-muted">{i + 1}.</span>
                    <span
                      className={`flex-1 ${s.done ? "text-muted line-through" : "text-text"}`}
                    >
                      {s.title}
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      defaultValue={s.estMinutes ?? ""}
                      onBlur={(e) => {
                        const raw = e.target.value.trim();
                        const v = raw ? Math.round(Number(raw)) : null;
                        if (v !== (s.estMinutes ?? null)) {
                          updateStep.mutate({ id: s.id, input: { estMinutes: v } });
                        }
                      }}
                      placeholder="min"
                      aria-label="Step estimate (minutes)"
                      className="w-14 shrink-0 rounded-lg border border-line bg-surface px-2 py-1 text-center text-xs text-text outline-none focus:border-accent"
                    />
                    <button
                      onClick={() => delStep.mutate(s.id)}
                      className="text-muted hover:text-bad"
                      aria-label="Remove step"
                    >
                      <X className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                value={newStep}
                onChange={(e) => setNewStep(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCurrentStep();
                }}
                placeholder="Add a step…"
                className={inputClass}
              />
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={newStepEst}
                onChange={(e) => setNewStepEst(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCurrentStep();
                }}
                placeholder="min"
                aria-label="Step estimate (minutes)"
                className="w-16 shrink-0 rounded-xl border border-line bg-surface-2 px-2 text-center text-text outline-none focus:border-accent"
              />
              <button
                onClick={addCurrentStep}
                disabled={!newStep.trim() || addStep.isPending}
                className="shrink-0 rounded-xl bg-surface-2 px-3 text-accent active:opacity-80 disabled:opacity-50"
                aria-label="Add step"
              >
                <Plus className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        )}

        <button
          onClick={submit}
          disabled={busy || !title.trim()}
          className={primaryButtonClass}
        >
          {busy ? "Saving…" : editing ? "Save changes" : "Add task"}
        </button>
        {!editing && (
          <p className="text-center text-xs text-muted">
            Add the task first, then tap it to add steps.
          </p>
        )}
      </div>
    </Sheet>
  );
}

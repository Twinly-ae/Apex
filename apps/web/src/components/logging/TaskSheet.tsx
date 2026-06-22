import { useState } from "react";
import type { TaskPriority } from "@apex/shared";
import { useAddTask } from "../../lib/queries";
import { Sheet, inputClass, primaryButtonClass } from "../ui/Sheet";

interface Props {
  open: boolean;
  onClose: () => void;
}

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 1, label: "High" },
  { value: 2, label: "Medium" },
  { value: 3, label: "Low" },
];

export function TaskSheet({ open, onClose }: Props) {
  const add = useAddTask();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<TaskPriority>(2);

  function reset() {
    setTitle("");
    setDue("");
    setPriority(2);
  }

  async function submit() {
    if (!title.trim()) return;
    await add.mutateAsync({
      title: title.trim(),
      dueDate: due ? new Date(`${due}T09:00:00`).toISOString() : null,
      priority,
    });
    reset();
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add a task">
      <div className="space-y-4">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          className={inputClass}
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Due (optional)</span>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Priority</span>
            <select
              value={priority}
              onChange={(e) =>
                setPriority(Number(e.target.value) as TaskPriority)
              }
              className={inputClass}
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          onClick={submit}
          disabled={add.isPending || !title.trim()}
          className={primaryButtonClass}
        >
          {add.isPending ? "Adding…" : "Add task"}
        </button>
      </div>
    </Sheet>
  );
}

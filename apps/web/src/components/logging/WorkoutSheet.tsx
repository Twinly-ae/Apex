import { useState } from "react";
import type { WorkoutSetInput } from "@apex/shared";
import { useAddWorkout } from "../../lib/queries";
import { Sheet, inputClass, primaryButtonClass } from "../ui/Sheet";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultTitle?: string;
}

type Row = { exercise: string; weightKg: string; reps: string };
const emptyRow = (): Row => ({ exercise: "", weightKg: "", reps: "" });

export function WorkoutSheet({ open, onClose, defaultTitle }: Props) {
  const add = useAddWorkout();
  const [title, setTitle] = useState(defaultTitle ?? "");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function submit() {
    const finalTitle = title.trim() || defaultTitle || "Workout";
    const sets: WorkoutSetInput[] = rows
      .filter((r) => r.exercise.trim())
      .map((r) => ({
        exercise: r.exercise.trim(),
        weightKg: r.weightKg ? Number(r.weightKg) : null,
        reps: r.reps ? Number(r.reps) : null,
      }));
    await add.mutateAsync({ title: finalTitle, sets });
    setTitle(defaultTitle ?? "");
    setRows([emptyRow()]);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Log workout">
      <div className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Session (e.g. Push)"
          className={inputClass}
        />
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-2">
              <input
                value={r.exercise}
                onChange={(e) => update(i, { exercise: e.target.value })}
                placeholder="Exercise"
                className="rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-text outline-none focus:border-accent"
              />
              <input
                type="number"
                inputMode="decimal"
                value={r.weightKg}
                onChange={(e) => update(i, { weightKg: e.target.value })}
                placeholder="kg"
                className="rounded-xl border border-line bg-surface-2 px-2 py-2.5 text-center text-text outline-none focus:border-accent"
              />
              <input
                type="number"
                inputMode="numeric"
                value={r.reps}
                onChange={(e) => update(i, { reps: e.target.value })}
                placeholder="reps"
                className="rounded-xl border border-line bg-surface-2 px-2 py-2.5 text-center text-text outline-none focus:border-accent"
              />
            </div>
          ))}
        </div>
        <button
          onClick={() => setRows((rs) => [...rs, emptyRow()])}
          className="w-full rounded-xl border border-dashed border-line py-2 text-sm text-muted active:text-text"
        >
          + Add set
        </button>
        <button
          onClick={submit}
          disabled={add.isPending}
          className={primaryButtonClass}
        >
          {add.isPending ? "Saving…" : "Save workout"}
        </button>
        <p className="text-center text-xs text-muted">
          Auto-import from Hevy arrives in Phase 3.
        </p>
      </div>
    </Sheet>
  );
}

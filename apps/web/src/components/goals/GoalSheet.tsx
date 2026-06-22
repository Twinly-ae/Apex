import { useState } from "react";
import type { GoalCategory } from "@apex/shared";
import { useAddGoal } from "../../lib/queries";
import { Sheet, inputClass, primaryButtonClass } from "../ui/Sheet";

const CATEGORIES: GoalCategory[] = [
  "business",
  "fitness",
  "money",
  "study",
  "personal",
];

export function GoalSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const add = useAddGoal();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<GoalCategory>("personal");
  const [targetDate, setTargetDate] = useState("");
  const [unit, setUnit] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [currentValue, setCurrentValue] = useState("");

  function reset() {
    setTitle("");
    setCategory("personal");
    setTargetDate("");
    setUnit("");
    setTargetValue("");
    setCurrentValue("");
  }

  async function submit() {
    if (!title.trim() || !targetDate) return;
    await add.mutateAsync({
      title: title.trim(),
      category,
      targetDate: new Date(`${targetDate}T12:00:00`).toISOString(),
      metricUnit: unit.trim() || null,
      targetValue: targetValue ? Number(targetValue) : null,
      startValue: currentValue ? Number(currentValue) : null,
      currentValue: currentValue ? Number(currentValue) : null,
    });
    reset();
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="New goal">
      <div className="space-y-3">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Launch Twinly For Him line"
          className={inputClass}
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as GoalCategory)}
              className={inputClass}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Target date</span>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <details className="rounded-xl border border-line bg-surface-2 px-3 py-2">
          <summary className="cursor-pointer text-sm text-muted">
            Track a number (optional)
          </summary>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="unit (AED)"
              className={inputClass}
            />
            <input
              type="number"
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              placeholder="now"
              className={inputClass}
            />
            <input
              type="number"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="goal"
              className={inputClass}
            />
          </div>
        </details>

        <button
          onClick={submit}
          disabled={add.isPending || !title.trim() || !targetDate}
          className={primaryButtonClass}
        >
          {add.isPending ? "Creating…" : "Create goal"}
        </button>
      </div>
    </Sheet>
  );
}

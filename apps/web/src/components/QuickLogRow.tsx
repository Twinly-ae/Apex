import { useState } from "react";
import { useAddWater } from "../lib/queries";
import { MealSheet } from "./logging/MealSheet";
import { TaskSheet } from "./logging/TaskSheet";
import { WeightSheet } from "./logging/WeightSheet";

const QUICK_WATER_ML = 250;

type ActiveSheet = null | "meal" | "weight" | "task";

/** The one-tap quick-log row. Water logs instantly; the rest open a sheet. */
export function QuickLogRow({ defaultKg }: { defaultKg?: number | null }) {
  const [sheet, setSheet] = useState<ActiveSheet>(null);
  const addWater = useAddWater();

  const buttons = [
    { key: "meal", label: "Meal", icon: "🍽️", onClick: () => setSheet("meal") },
    {
      key: "weight",
      label: "Weight",
      icon: "⚖️",
      onClick: () => setSheet("weight"),
    },
    {
      key: "water",
      label: `+${QUICK_WATER_ML}ml`,
      icon: "💧",
      onClick: () => addWater.mutate({ amountMl: QUICK_WATER_ML }),
    },
    { key: "task", label: "Task", icon: "✓", onClick: () => setSheet("task") },
  ];

  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        {buttons.map((b) => (
          <button
            key={b.key}
            onClick={b.onClick}
            className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-surface py-3 active:bg-surface-2"
          >
            <span className="text-2xl leading-none">{b.icon}</span>
            <span className="text-xs text-muted">{b.label}</span>
          </button>
        ))}
      </div>

      <MealSheet open={sheet === "meal"} onClose={() => setSheet(null)} />
      <WeightSheet
        open={sheet === "weight"}
        onClose={() => setSheet(null)}
        defaultKg={defaultKg}
      />
      <TaskSheet open={sheet === "task"} onClose={() => setSheet(null)} />
    </>
  );
}

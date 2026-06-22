import { Droplets, type LucideIcon, Scale, Utensils, Plus } from "lucide-react";
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

  const buttons: { key: string; label: string; icon: LucideIcon; onClick: () => void }[] = [
    { key: "meal", label: "Meal", icon: Utensils, onClick: () => setSheet("meal") },
    { key: "weight", label: "Weight", icon: Scale, onClick: () => setSheet("weight") },
    {
      key: "water",
      label: `+${QUICK_WATER_ML}ml`,
      icon: Droplets,
      onClick: () => addWater.mutate({ amountMl: QUICK_WATER_ML }),
    },
    { key: "task", label: "Task", icon: Plus, onClick: () => setSheet("task") },
  ];

  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        {buttons.map(({ key, label, icon: Icon, onClick }) => (
          <button
            key={key}
            onClick={onClick}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface py-3.5 text-muted transition-colors active:bg-surface-2"
          >
            <Icon className="h-5 w-5 text-accent" strokeWidth={2} />
            <span className="text-xs">{label}</span>
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

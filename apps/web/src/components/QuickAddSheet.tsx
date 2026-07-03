import {
  Droplets,
  Dumbbell,
  type LucideIcon,
  Plus,
  Scale,
  Utensils,
} from "lucide-react";
import { useState } from "react";
import { useAddWater, useToday } from "../lib/queries";
import { MealSheet } from "./logging/MealSheet";
import { TaskSheet } from "./logging/TaskSheet";
import { WeightSheet } from "./logging/WeightSheet";
import { WorkoutSheet } from "./logging/WorkoutSheet";
import { Sheet } from "./ui/Sheet";

const QUICK_WATER_ML = 250;

type Target = null | "meal" | "weight" | "task" | "workout";

/** The global “+” menu — log anything from anywhere in two taps. */
export function QuickAddSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const addWater = useAddWater();
  const { data: today } = useToday();
  const [target, setTarget] = useState<Target>(null);

  const actions: {
    key: Exclude<Target, null> | "water";
    label: string;
    sub: string;
    icon: LucideIcon;
    onClick: () => void;
  }[] = [
    {
      key: "meal",
      label: "Meal",
      sub: "AI, photo, barcode or manual",
      icon: Utensils,
      onClick: () => setTarget("meal"),
    },
    {
      key: "water",
      label: "Water",
      sub: `+${QUICK_WATER_ML}ml, logged instantly`,
      icon: Droplets,
      onClick: () => {
        addWater.mutate({ amountMl: QUICK_WATER_ML });
        onClose();
      },
    },
    {
      key: "workout",
      label: "Workout",
      sub: "Log a session manually",
      icon: Dumbbell,
      onClick: () => setTarget("workout"),
    },
    {
      key: "weight",
      label: "Weight",
      sub: "Today's bodyweight",
      icon: Scale,
      onClick: () => setTarget("weight"),
    },
    {
      key: "task",
      label: "Task",
      sub: "With steps, timer & reminder",
      icon: Plus,
      onClick: () => setTarget("task"),
    },
  ];

  function closeAll() {
    setTarget(null);
    onClose();
  }

  return (
    <>
      <Sheet open={open && target === null} onClose={onClose} title="Quick log">
        <div className="grid grid-cols-2 gap-2.5">
          {actions.map(({ key, label, sub, icon: Icon, onClick }) => (
            <button
              key={key}
              onClick={onClick}
              className="pressable flex flex-col items-start gap-2.5 rounded-2xl border border-line bg-surface-2 p-4 text-left"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent">
                <Icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <span>
                <span className="block text-sm font-semibold text-text">
                  {label}
                </span>
                <span className="mt-0.5 block text-[11px] leading-tight text-muted">
                  {sub}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Sheet>

      <MealSheet open={target === "meal"} onClose={closeAll} />
      <WeightSheet
        open={target === "weight"}
        onClose={closeAll}
        defaultKg={today?.latestBodyweightKg}
      />
      <TaskSheet open={target === "task"} onClose={closeAll} />
      <WorkoutSheet
        open={target === "workout"}
        onClose={closeAll}
        defaultTitle={today?.plannedWorkout ?? undefined}
      />
    </>
  );
}

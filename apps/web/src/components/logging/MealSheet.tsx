import { useState } from "react";
import { useAddMeal } from "../../lib/queries";
import { Sheet, inputClass, primaryButtonClass } from "../ui/Sheet";

interface Props {
  open: boolean;
  onClose: () => void;
}

function NumField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <div className="flex items-center rounded-xl border border-line bg-surface-2 px-3">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="w-full bg-transparent py-3 text-text outline-none"
        />
        <span className="pl-1 text-sm text-muted">{suffix}</span>
      </div>
    </label>
  );
}

export function MealSheet({ open, onClose }: Props) {
  const add = useAddMeal();
  const [description, setDescription] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  function reset() {
    setDescription("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
  }

  async function submit() {
    if (!description.trim() || !calories) return;
    await add.mutateAsync({
      description: description.trim(),
      calories: Math.round(Number(calories) || 0),
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      source: "manual",
    });
    reset();
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Log a meal">
      <div className="space-y-3">
        <input
          autoFocus
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Chicken, rice & veg"
          className={inputClass}
        />
        <NumField label="Calories" value={calories} onChange={setCalories} suffix="kcal" />
        <div className="grid grid-cols-3 gap-3">
          <NumField label="Protein" value={protein} onChange={setProtein} suffix="g" />
          <NumField label="Carbs" value={carbs} onChange={setCarbs} suffix="g" />
          <NumField label="Fat" value={fat} onChange={setFat} suffix="g" />
        </div>
        <button
          onClick={submit}
          disabled={add.isPending || !description.trim() || !calories}
          className={primaryButtonClass}
        >
          {add.isPending ? "Saving…" : "Add meal"}
        </button>
        <p className="text-center text-xs text-muted">
          Photo, barcode & plain-text AI logging arrive in Phase 4.
        </p>
      </div>
    </Sheet>
  );
}

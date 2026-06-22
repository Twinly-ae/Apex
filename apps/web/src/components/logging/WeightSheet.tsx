import { useState } from "react";
import { useAddBodyweight } from "../../lib/queries";
import { Sheet, inputClass, primaryButtonClass } from "../ui/Sheet";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultKg?: number | null;
}

export function WeightSheet({ open, onClose, defaultKg }: Props) {
  const add = useAddBodyweight();
  const [weight, setWeight] = useState(defaultKg ? String(defaultKg) : "");

  async function submit() {
    const weightKg = Number(weight);
    if (!weightKg || weightKg < 20 || weightKg > 400) return;
    await add.mutateAsync({ weightKg, source: "manual" });
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Log bodyweight">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Weight (kg)</span>
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="74.0"
            className={inputClass}
          />
        </label>
        <button
          onClick={submit}
          disabled={add.isPending || !weight}
          className={primaryButtonClass}
        >
          {add.isPending ? "Saving…" : "Save weight"}
        </button>
        <p className="text-center text-xs text-muted">
          Auto-sync from Apple Watch arrives in Phase 3.
        </p>
      </div>
    </Sheet>
  );
}

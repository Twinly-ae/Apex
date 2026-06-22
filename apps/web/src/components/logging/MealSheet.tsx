import { useState } from "react";
import type { MealEstimate, MealSource } from "@apex/shared";
import {
  useAddMeal,
  useAnalyzePhoto,
  useAnalyzeText,
  useBarcodeLookup,
} from "../../lib/queries";
import { Sheet, inputClass, primaryButtonClass } from "../ui/Sheet";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Mode = "describe" | "photo" | "barcode" | "manual";

const MODES: { id: Mode; label: string }[] = [
  { id: "describe", label: "Describe" },
  { id: "photo", label: "Photo" },
  { id: "barcode", label: "Barcode" },
  { id: "manual", label: "Manual" },
];

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

function readImage(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result);
      const comma = res.indexOf(",");
      const meta = res.slice(0, comma);
      const m = /data:(.*?);base64/.exec(meta);
      resolve({ data: res.slice(comma + 1), mediaType: m?.[1] || "image/jpeg" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function MealSheet({ open, onClose }: Props) {
  const add = useAddMeal();
  const analyzeText = useAnalyzeText();
  const analyzePhoto = useAnalyzePhoto();
  const barcode = useBarcodeLookup();

  const [mode, setMode] = useState<Mode>("describe");
  const [prompt, setPrompt] = useState(""); // text/barcode input
  const [error, setError] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  const estimating =
    analyzeText.isPending || analyzePhoto.isPending || barcode.isPending;

  function applyEstimate(e: MealEstimate) {
    setDescription(e.description);
    setCalories(String(e.calories));
    setProtein(String(e.protein));
    setCarbs(String(e.carbs));
    setFat(String(e.fat));
  }

  function reset() {
    setPrompt("");
    setDescription("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setError(null);
  }

  async function run(fn: () => Promise<MealEstimate>) {
    setError(null);
    try {
      applyEstimate(await fn());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't estimate that.");
    }
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    const { data, mediaType } = await readImage(file);
    await run(() => analyzePhoto.mutateAsync({ imageBase64: data, mediaType }));
  }

  async function submit() {
    if (!description.trim() || !calories) return;
    const source: MealSource =
      mode === "manual"
        ? "manual"
        : mode === "describe"
          ? "text"
          : mode === "photo"
            ? "photo"
            : "barcode";
    await add.mutateAsync({
      description: description.trim(),
      calories: Math.round(Number(calories) || 0),
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      source,
    });
    reset();
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Log a meal">
      <div className="space-y-4">
        {/* Mode selector */}
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-surface-2 p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setMode(m.id);
                setError(null);
              }}
              className={`rounded-lg py-2 text-xs font-medium ${
                mode === m.id ? "bg-accent text-white" : "text-muted"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Per-mode input */}
        {mode === "describe" && (
          <div className="flex gap-2">
            <input
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. 2 eggs, oatmeal & a banana"
              className={inputClass}
            />
            <button
              onClick={() => run(() => analyzeText.mutateAsync(prompt))}
              disabled={!prompt.trim() || estimating}
              className="shrink-0 rounded-xl bg-surface-2 px-4 text-sm text-text active:opacity-80"
            >
              {estimating ? "…" : "Estimate"}
            </button>
          </div>
        )}
        {mode === "photo" && (
          <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-line bg-surface-2 py-6 text-sm text-muted">
            {estimating ? "Analyzing photo…" : "📷 Tap to take / choose a photo"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onPhoto(e.target.files?.[0])}
            />
          </label>
        )}
        {mode === "barcode" && (
          <div className="flex gap-2">
            <input
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              inputMode="numeric"
              placeholder="Barcode number"
              className={inputClass}
            />
            <button
              onClick={() => run(() => barcode.mutateAsync(prompt.trim()))}
              disabled={!/^\d{6,14}$/.test(prompt.trim()) || estimating}
              className="shrink-0 rounded-xl bg-surface-2 px-4 text-sm text-text active:opacity-80"
            >
              {estimating ? "…" : "Look up"}
            </button>
          </div>
        )}

        {error && <p className="text-sm text-bad">{error}</p>}

        {/* Confirm / edit (shared) */}
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Meal description"
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
        {mode !== "manual" && (
          <p className="text-center text-xs text-muted">
            Estimates are a starting point — tweak the numbers before saving.
          </p>
        )}
      </div>
    </Sheet>
  );
}

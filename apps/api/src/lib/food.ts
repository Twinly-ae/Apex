import type { MealEstimate } from "@apex/shared";
import { imageMessage, runJSON } from "./ai";

const MACRO_SYS =
  "You are a precise nutrition estimator. Given a food description or photo, " +
  "estimate the TOTAL calories and macros for the portion shown/described. " +
  'Respond ONLY with JSON: {"description": string, "calories": number, ' +
  '"protein": number, "carbs": number, "fat": number, "note": string}. ' +
  "Calories in kcal; protein/carbs/fat in grams. If the portion is unclear, " +
  "assume one typical serving and say so in note.";

function clampNum(v: unknown, lo: number, hi: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : 0;
}

function normalize(e: Partial<MealEstimate>): MealEstimate {
  return {
    description: String(e?.description ?? "Meal").slice(0, 200),
    calories: clampNum(e?.calories, 0, 10000),
    protein: clampNum(e?.protein, 0, 1000),
    carbs: clampNum(e?.carbs, 0, 2000),
    fat: clampNum(e?.fat, 0, 1000),
    note: e?.note ? String(e.note).slice(0, 300) : null,
  };
}

export async function estimateFromText(text: string): Promise<MealEstimate> {
  const out = await runJSON<Partial<MealEstimate>>({
    system: MACRO_SYS,
    messages: [{ role: "user", content: `Food: ${text}` }],
    maxTokens: 500,
  });
  return normalize(out);
}

export async function estimateFromPhoto(
  imageBase64: string,
  mediaType: string,
  hint?: string,
): Promise<MealEstimate> {
  const out = await runJSON<Partial<MealEstimate>>({
    system: MACRO_SYS,
    messages: [
      imageMessage(
        `Estimate this meal.${hint ? ` Hint: ${hint}` : ""}`,
        imageBase64,
        mediaType,
      ),
    ],
    maxTokens: 500,
  });
  return normalize(out);
}

/** Open Food Facts barcode lookup (free, no key). */
export async function lookupBarcode(code: string): Promise<MealEstimate | null> {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
      code,
    )}.json?fields=product_name,nutriments,serving_size`,
    { headers: { "User-Agent": "Apex/1.0 (personal dashboard)" } },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status?: number;
    product?: {
      product_name?: string;
      serving_size?: string;
      nutriments?: Record<string, number | undefined>;
    };
  };
  const p = data.product;
  if (!p || data.status === 0) return null;
  const n = p.nutriments ?? {};
  const per = (k: string) => n[`${k}_serving`] ?? n[`${k}_100g`] ?? n[k] ?? 0;
  const kcal =
    n["energy-kcal_serving"] ?? n["energy-kcal_100g"] ?? n["energy-kcal"] ?? 0;
  return {
    description: String(p.product_name || "Scanned product").slice(0, 200),
    calories: clampNum(kcal, 0, 10000),
    protein: clampNum(per("proteins"), 0, 1000),
    carbs: clampNum(per("carbohydrates"), 0, 2000),
    fat: clampNum(per("fat"), 0, 1000),
    note: p.serving_size ? `Per serving (${p.serving_size})` : "Per 100g",
    found: true,
  };
}

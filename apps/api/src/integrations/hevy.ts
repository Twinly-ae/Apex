// Hevy adapter — read-only. Requires Hevy Pro; the key (HEVY_API_KEY) is sent
// as an `api-key` header. Docs: https://api.hevyapp.com
import { env } from "../env";

const BASE = "https://api.hevyapp.com/v1";

export interface HevySet {
  weight_kg?: number | null;
  reps?: number | null;
}
export interface HevyExercise {
  title?: string;
  sets?: HevySet[];
}
export interface HevyWorkout {
  id: string;
  title?: string;
  start_time?: string;
  created_at?: string;
  exercises?: HevyExercise[];
}

export function hevyConfigured(): boolean {
  return Boolean(env.HEVY_API_KEY);
}

async function hevyGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "api-key": env.HEVY_API_KEY as string, accept: "application/json" },
  });
  if (!res.ok) {
    // Include the body — Hevy explains *why* here (bad key, or API access needs
    // Hevy Pro), which is far more useful than a bare status code.
    const body = await res.text().catch(() => "");
    const hint =
      res.status === 401
        ? " (check HEVY_API_KEY — and Hevy API access requires Hevy Pro)"
        : "";
    throw new Error(`Hevy API ${res.status}: ${body.slice(0, 180) || res.statusText}${hint}`);
  }
  return (await res.json()) as T;
}

/** Liveness check: a 1-row fetch that validates the api-key. Throws on fail. */
export async function pingHevy(): Promise<void> {
  await hevyGet("/workouts?page=1&pageSize=1");
}

/** Most recent workouts, newest first, across a few pages. */
export async function fetchRecentWorkouts(
  pages = 3,
  pageSize = 10,
): Promise<HevyWorkout[]> {
  const all: HevyWorkout[] = [];
  for (let page = 1; page <= pages; page++) {
    const data = await hevyGet<{ workouts?: HevyWorkout[] }>(
      `/workouts?page=${page}&pageSize=${pageSize}`,
    );
    const workouts = data.workouts ?? [];
    all.push(...workouts);
    if (workouts.length < pageSize) break;
  }
  return all;
}

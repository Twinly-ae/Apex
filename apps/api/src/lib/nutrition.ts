import type { MacroProgress } from "@apex/shared";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Build a consumed/target/remaining triple, never letting remaining go below 0. */
export function progress(consumed: number, target: number): MacroProgress {
  return {
    consumed: round1(consumed),
    target,
    remaining: round1(Math.max(0, target - consumed)),
  };
}

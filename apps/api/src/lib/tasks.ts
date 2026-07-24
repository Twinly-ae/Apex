// Task helpers shared by the tasks route and the chat coach's tools.
import { localWeekdayMon0 } from "./time";

/**
 * Next due date for a repeating task, always in the future. Keeps the
 * time-of-day; "weekdays" skips Sat/Sun (local Dubai weekdays).
 */
export function nextOccurrence(
  from: Date,
  repeat: string,
  now = new Date(),
): Date {
  const d = new Date(from.getTime());
  const step = () => {
    if (repeat === "weekly") {
      d.setUTCDate(d.getUTCDate() + 7);
    } else {
      d.setUTCDate(d.getUTCDate() + 1);
      if (repeat === "weekdays") {
        while (localWeekdayMon0(d) >= 5) d.setUTCDate(d.getUTCDate() + 1);
      }
    }
  };
  step();
  while (d.getTime() <= now.getTime()) step();
  return d;
}

/**
 * Minutes to bank for a focus stretch. Honest rounding: ignore accidental
 * taps (<10s), count short-but-real stretches as 1m, else round normally.
 */
export function bankedMinutes(startedAt: Date): number {
  const sec = (Date.now() - startedAt.getTime()) / 1000;
  if (sec < 10) return 0;
  if (sec < 60) return 1;
  return Math.round(sec / 60);
}

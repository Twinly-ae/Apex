import { useEffect, useState } from "react";

/** Layout customization — home page, bottom-bar tabs, home sections. */

export interface PageDef {
  id: string;
  route: string;
  label: string;
}

export const PAGES: PageDef[] = [
  { id: "today", route: "/", label: "Today" },
  { id: "tasks", route: "/tasks", label: "Tasks" },
  { id: "health", route: "/health", label: "Health" },
  { id: "goals", route: "/goals", label: "Goals" },
  { id: "money", route: "/money", label: "Money" },
  { id: "businesses", route: "/businesses", label: "Business" },
  { id: "coach", route: "/coach", label: "Coach" },
  { id: "meals", route: "/meals", label: "Food log" },
  { id: "day", route: "/day", label: "History" },
  { id: "settings", route: "/settings", label: "Settings" },
];

export const pageById = (id: string): PageDef =>
  PAGES.find((p) => p.id === id) ?? PAGES[0];

/** Sections of the Today page that can be hidden. */
export const HOME_SECTIONS: { id: string; label: string }[] = [
  { id: "wellbeing", label: "Wellbeing gauges" },
  { id: "energy", label: "Energy hero" },
  { id: "briefing", label: "Briefing" },
  { id: "plan", label: "Focus & day plan" },
  { id: "priorities", label: "Top priorities" },
  { id: "training", label: "Training today" },
  { id: "habits", label: "Habits" },
];

const KEYS = {
  home: "apex-home",
  slots: "apex-nav-slots",
  hidden: "apex-home-hidden",
} as const;

const DEFAULT_SLOTS = ["today", "tasks", "health"];

export function getHomeId(): string {
  const v = localStorage.getItem(KEYS.home);
  return v && PAGES.some((p) => p.id === v) ? v : "today";
}

/** The three customizable tab slots (More is always the fourth). */
export function getNavSlots(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEYS.slots) ?? "[]") as string[];
    if (
      Array.isArray(v) &&
      v.length === 3 &&
      v.every((id) => PAGES.some((p) => p.id === id)) &&
      new Set(v).size === 3
    ) {
      return v;
    }
  } catch {
    // fall through to default
  }
  return [...DEFAULT_SLOTS];
}

export function getHiddenSections(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(KEYS.hidden) ?? "[]") as string[];
    return new Set(Array.isArray(v) ? v : []);
  } catch {
    return new Set();
  }
}

function emit(): void {
  window.dispatchEvent(new Event("apex-layout"));
}

export function setHomeId(id: string): void {
  localStorage.setItem(KEYS.home, id);
  emit();
}

export function setNavSlot(index: number, id: string): void {
  const slots = getNavSlots();
  // If the page is already in another slot, swap them so slots stay unique.
  const existing = slots.indexOf(id);
  if (existing >= 0) slots[existing] = slots[index];
  slots[index] = id;
  localStorage.setItem(KEYS.slots, JSON.stringify(slots));
  emit();
}

export function setSectionHidden(id: string, hidden: boolean): void {
  const set = getHiddenSections();
  if (hidden) set.add(id);
  else set.delete(id);
  localStorage.setItem(KEYS.hidden, JSON.stringify([...set]));
  emit();
}

/** Re-render when any layout setting changes (cross-component). */
export function useLayoutVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const bump = () => setV((n) => n + 1);
    window.addEventListener("apex-layout", bump);
    return () => window.removeEventListener("apex-layout", bump);
  }, []);
  return v;
}

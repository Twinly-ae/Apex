/** Appearance customization — accent color + aurora backdrop, persisted locally. */

export interface AccentOption {
  id: string;
  name: string;
  /** "R G B" triplets consumed by the CSS variables. */
  accent: string;
  strong: string;
  /** Swatch color for the picker. */
  hex: string;
}

export const ACCENTS: AccentOption[] = [
  { id: "violet", name: "Violet", accent: "124 107 255", strong: "93 68 245", hex: "#7c6bff" },
  { id: "blue", name: "Blue", accent: "79 140 255", strong: "37 99 235", hex: "#4f8cff" },
  { id: "cyan", name: "Cyan", accent: "34 211 238", strong: "8 145 178", hex: "#22d3ee" },
  { id: "emerald", name: "Emerald", accent: "52 211 153", strong: "5 150 105", hex: "#34d399" },
  { id: "amber", name: "Amber", accent: "251 191 36", strong: "217 119 6", hex: "#fbbf24" },
  { id: "rose", name: "Rose", accent: "251 113 133", strong: "225 29 72", hex: "#fb7185" },
];

const ACCENT_KEY = "apex-accent";
const AURORA_KEY = "apex-aurora";

export function getAccentId(): string {
  return localStorage.getItem(ACCENT_KEY) ?? "violet";
}

export function getAurora(): boolean {
  return localStorage.getItem(AURORA_KEY) !== "off";
}

export function setAccent(id: string): void {
  localStorage.setItem(ACCENT_KEY, id);
  applyTheme();
}

export function setAurora(on: boolean): void {
  localStorage.setItem(AURORA_KEY, on ? "on" : "off");
  applyTheme();
}

/** Apply the stored appearance — call once at boot and after every change. */
export function applyTheme(): void {
  const opt = ACCENTS.find((a) => a.id === getAccentId()) ?? ACCENTS[0];
  const root = document.documentElement;
  root.style.setProperty("--accent", opt.accent);
  root.style.setProperty("--accent-strong", opt.strong);
  root.classList.toggle("no-aurora", !getAurora());
}

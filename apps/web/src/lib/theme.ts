/** Appearance customization — accent, theme, text size, aurora. Persisted locally. */

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
  { id: "lime", name: "Lime", accent: "163 230 53", strong: "101 163 13", hex: "#a3e635" },
  { id: "amber", name: "Amber", accent: "251 191 36", strong: "217 119 6", hex: "#fbbf24" },
  { id: "orange", name: "Orange", accent: "251 146 60", strong: "234 88 12", hex: "#fb923c" },
  { id: "rose", name: "Rose", accent: "251 113 133", strong: "225 29 72", hex: "#fb7185" },
  { id: "pink", name: "Pink", accent: "244 114 182", strong: "219 39 119", hex: "#f472b6" },
  { id: "graphite", name: "Graphite", accent: "161 161 170", strong: "113 113 122", hex: "#a1a1aa" },
];

export type ThemeId = "dark" | "oled";
export const THEMES: { id: ThemeId; name: string; desc: string }[] = [
  { id: "dark", name: "Dark", desc: "Deep violet-tinted dark" },
  { id: "oled", name: "True black", desc: "Pure black, OLED-friendly" },
];

export type TextSizeId = "s" | "m" | "l";
export const TEXT_SIZES: { id: TextSizeId; name: string; px: number }[] = [
  { id: "s", name: "S", px: 15 },
  { id: "m", name: "M", px: 16 },
  { id: "l", name: "L", px: 17.5 },
];

const KEYS = {
  accent: "apex-accent",
  aurora: "apex-aurora",
  theme: "apex-theme",
  textSize: "apex-text-size",
} as const;

export function getAccentId(): string {
  return localStorage.getItem(KEYS.accent) ?? "violet";
}
export function getAurora(): boolean {
  return localStorage.getItem(KEYS.aurora) !== "off";
}
export function getThemeId(): ThemeId {
  return localStorage.getItem(KEYS.theme) === "oled" ? "oled" : "dark";
}
export function getTextSizeId(): TextSizeId {
  const v = localStorage.getItem(KEYS.textSize);
  return v === "s" || v === "l" ? v : "m";
}

export function setAccent(id: string): void {
  localStorage.setItem(KEYS.accent, id);
  applyTheme();
}
export function setAurora(on: boolean): void {
  localStorage.setItem(KEYS.aurora, on ? "on" : "off");
  applyTheme();
}
export function setTheme(id: ThemeId): void {
  localStorage.setItem(KEYS.theme, id);
  applyTheme();
}
export function setTextSize(id: TextSizeId): void {
  localStorage.setItem(KEYS.textSize, id);
  applyTheme();
}

/** Apply the stored appearance — call once at boot and after every change. */
export function applyTheme(): void {
  const root = document.documentElement;
  const accent = ACCENTS.find((a) => a.id === getAccentId()) ?? ACCENTS[0];
  root.style.setProperty("--accent", accent.accent);
  root.style.setProperty("--accent-strong", accent.strong);
  root.classList.toggle("no-aurora", !getAurora());
  root.classList.toggle("oled", getThemeId() === "oled");
  const size = TEXT_SIZES.find((t) => t.id === getTextSizeId()) ?? TEXT_SIZES[1];
  root.style.fontSize = `${size.px}px`;
}

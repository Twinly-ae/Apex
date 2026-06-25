import type { HealthResponse } from "@apex/shared";

// system-ui resolves to SF Pro on iOS and is honoured by canvas (unlike
// -apple-system, which canvas often ignores and renders rough).
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const SCALE = 2; // supersample so text & rings stay crisp on retina screens

export type ShareDesign =
  | "card"
  | "bold"
  | "focus"
  | "minimal"
  | "light"
  | "rings";

const RINGS = [
  { key: "stress", label: "STRESS", from: "#f59e0b", to: "#fb7185" },
  { key: "recovery", label: "RECOVERY", from: "#22c55e", to: "#a3e635" },
  { key: "sleep", label: "SLEEP", from: "#6366f1", to: "#a5b4fc" },
] as const;

type RingDef = (typeof RINGS)[number];

interface Theme {
  num: string;
  pct: string;
  track: string;
  labelDark: boolean; // use the ring's darker stop for labels (light backgrounds)
  shadow: boolean;
}

function setLS(ctx: CanvasRenderingContext2D, px: number) {
  (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
}

function dateLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function drawArc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  lw: number,
  value: number,
  from: string,
  to: string,
  track: string,
) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.strokeStyle = track;
  ctx.stroke();

  if (value <= 0) return;
  const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, from);
  grad.addColorStop(1, to);
  const start = -Math.PI / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, start + (Math.min(100, value) / 100) * Math.PI * 2);
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.strokeStyle = grad;
  ctx.shadowColor = to;
  ctx.shadowBlur = 22;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  lw: number,
  ring: RingDef,
  value: number | null,
  t: Theme,
) {
  drawArc(ctx, cx, cy, r, lw, value ?? 0, ring.from, ring.to, t.track);

  const num = value == null ? "—" : String(value);
  const numFont = `800 ${Math.round(r * 0.66)}px ${FONT}`;
  const pctFont = `700 ${Math.round(r * 0.26)}px ${FONT}`;

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.font = numFont;
  const nw = ctx.measureText(num).width;
  let pw = 0;
  if (value != null) {
    ctx.font = pctFont;
    pw = ctx.measureText("%").width + 6;
  }
  const startX = cx - (nw + pw) / 2;
  const baseY = cy + r * 0.23;

  if (t.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 12;
  }
  ctx.font = numFont;
  ctx.fillStyle = t.num;
  ctx.fillText(num, startX, baseY);
  if (value != null) {
    ctx.font = pctFont;
    ctx.fillStyle = t.pct;
    ctx.fillText("%", startX + nw + 6, baseY);
  }
  ctx.shadowBlur = 0;

  ctx.textAlign = "center";
  ctx.font = `700 ${Math.round(r * 0.2)}px ${FONT}`;
  setLS(ctx, 1);
  if (t.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 8;
  }
  ctx.fillStyle = t.labelDark ? ring.from : ring.to;
  ctx.fillText(ring.label, cx, cy + r + r * 0.42);
  ctx.shadowBlur = 0;
  setLS(ctx, 0);
}

function ringRow(
  ctx: CanvasRenderingContext2D,
  health: HealthResponse,
  cy: number,
  r: number,
  lw: number,
  t: Theme,
) {
  const gap = r + 24;
  const xs = [540 - 2 * gap, 540, 540 + 2 * gap];
  RINGS.forEach((ring, i) =>
    drawRing(ctx, xs[i], cy, r, lw, ring, health.scores[ring.key], t),
  );
}

function header(
  ctx: CanvasRenderingContext2D,
  subColor: string,
  mainColor: string,
) {
  ctx.textAlign = "center";
  ctx.fillStyle = subColor;
  ctx.font = `700 30px ${FONT}`;
  setLS(ctx, 6);
  ctx.fillText("WELLBEING", 540, 150);
  setLS(ctx, 0);
  ctx.fillStyle = mainColor;
  ctx.font = `700 54px ${FONT}`;
  ctx.fillText(dateLabel(), 540, 218);
}

function wordmark(
  ctx: CanvasRenderingContext2D,
  y: number,
  size: number,
  mode: "violet" | "white" | "shadow-white",
) {
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 ${size}px ${FONT}`;
  setLS(ctx, size * 0.06);
  if (mode === "violet") {
    const g = ctx.createLinearGradient(540 - size * 1.6, y, 540 + size * 1.6, y);
    g.addColorStop(0, "#a78bfa");
    g.addColorStop(1, "#7c6bff");
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = "#ffffff";
  }
  if (mode === "shadow-white") {
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 12;
  }
  ctx.fillText("Apex", 540, y);
  ctx.shadowBlur = 0;
  setLS(ctx, 0);
}

function statsLine(
  ctx: CanvasRenderingContext2D,
  health: HealthResponse,
  y: number,
  color: string,
) {
  const bits: string[] = [];
  if (health.sleepHours != null) bits.push(`${health.sleepHours}h sleep`);
  if (health.restingHr != null) bits.push(`${health.restingHr} bpm RHR`);
  if (health.steps != null) bits.push(`${health.steps.toLocaleString()} steps`);
  if (!bits.length) return;
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.font = `500 28px ${FONT}`;
  ctx.fillText(bits.join("   ·   "), 540, y);
}

function wrapCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  ctx.textAlign = "center";
  const words = text.split(" ");
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, 540, y);
      line = w;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, 540, y);
}

const DARK_THEME: Theme = {
  num: "#ffffff",
  pct: "#9393a6",
  track: "rgba(255,255,255,0.10)",
  labelDark: false,
  shadow: false,
};
const SHADOW_THEME: Theme = {
  num: "#ffffff",
  pct: "#e9e9f2",
  track: "rgba(255,255,255,0.20)",
  labelDark: false,
  shadow: true,
};
const LIGHT_THEME: Theme = {
  num: "#14141d",
  pct: "#6b6b80",
  track: "rgba(0,0,0,0.08)",
  labelDark: true,
  shadow: false,
};

function buildCanvas(
  health: HealthResponse,
  coaching: string,
  design: ShareDesign,
  scale = SCALE,
): HTMLCanvasElement {
  const W = 1080;
  const H = design === "rings" ? 1080 : 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(scale, scale);
  ctx.textAlign = "center";

  if (design === "rings") {
    // Transparent — exports a clear-background PNG to layer on a story photo.
    ringRow(ctx, health, 470, 150, 30, SHADOW_THEME);
    wordmark(ctx, 880, 60, "shadow-white");
    return canvas;
  }

  if (design === "minimal") {
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#9393a6";
    ctx.font = `600 32px ${FONT}`;
    ctx.fillText(dateLabel(), 540, 170);
    ringRow(ctx, health, 620, 150, 30, DARK_THEME);
    wordmark(ctx, H - 120, 56, "violet");
    return canvas;
  }

  if (design === "light") {
    ctx.fillStyle = "#f4f4f7";
    ctx.fillRect(0, 0, W, H);
    header(ctx, "#8a8a99", "#14141d");
    ringRow(ctx, health, 560, 128, 24, LIGHT_THEME);
    statsLine(ctx, health, 830, "#8a8a99");
    ctx.fillStyle = "#3a3a46";
    ctx.font = `500 38px ${FONT}`;
    wrapCentered(ctx, coaching, 930, W - 200, 52);
    wordmark(ctx, H - 90, 44, "violet");
    return canvas;
  }

  if (design === "bold") {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#6d28d9");
    g.addColorStop(0.55, "#4338ca");
    g.addColorStop(1, "#1e3a8a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    header(ctx, "rgba(255,255,255,0.7)", "#ffffff");
    ringRow(ctx, health, 560, 128, 24, SHADOW_THEME);
    statsLine(ctx, health, 830, "rgba(255,255,255,0.75)");
    ctx.fillStyle = "#ffffff";
    ctx.font = `500 38px ${FONT}`;
    wrapCentered(ctx, coaching, 930, W - 200, 52);
    wordmark(ctx, H - 90, 46, "white");
    return canvas;
  }

  if (design === "focus") {
    // Hero: big Recovery ring, with Stress & Sleep beneath.
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(540, 430, 0, 540, 430, 460);
    glow.addColorStop(0, "rgba(52,211,153,0.16)");
    glow.addColorStop(1, "rgba(52,211,153,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, 900);
    ctx.fillStyle = "#9393a6";
    ctx.font = `600 30px ${FONT}`;
    ctx.fillText(dateLabel(), 540, 130);
    drawRing(ctx, 540, 440, 210, 34, RINGS[1], health.scores.recovery, DARK_THEME);
    drawRing(ctx, 330, 880, 130, 24, RINGS[0], health.scores.stress, DARK_THEME);
    drawRing(ctx, 750, 880, 130, 24, RINGS[2], health.scores.sleep, DARK_THEME);
    wordmark(ctx, H - 110, 50, "violet");
    return canvas;
  }

  // design === "card" — full dark story card
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b0b12");
  bg.addColorStop(1, "#14141d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(540, 120, 0, 540, 120, 700);
  glow.addColorStop(0, "rgba(124,107,255,0.18)");
  glow.addColorStop(1, "rgba(124,107,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 760);
  header(ctx, "#9393a6", "#ececf1");
  ringRow(ctx, health, 560, 128, 24, DARK_THEME);
  statsLine(ctx, health, 830, "#6b6b80");
  ctx.fillStyle = "#ececf1";
  ctx.font = `500 38px ${FONT}`;
  wrapCentered(ctx, coaching, 930, W - 200, 52);
  wordmark(ctx, H - 90, 46, "violet");
  return canvas;
}

/** A small in-app preview (rendered at 1× for speed). */
export function previewUrl(
  health: HealthResponse,
  coaching: string,
  design: ShareDesign,
): string {
  return buildCanvas(health, coaching, design, 1).toDataURL("image/png");
}

export type ShareResult = "shared" | "downloaded" | "error";

/** Render the chosen design at full resolution and open the native share sheet. */
export async function shareWellbeing(
  health: HealthResponse,
  coaching: string,
  design: ShareDesign,
): Promise<ShareResult> {
  const canvas = buildCanvas(health, coaching, design);
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, "image/png"),
  );
  if (!blob) return "error";
  const file = new File([blob], `apex-${design}.png`, { type: "image/png" });

  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "My Apex wellbeing" });
      return "shared";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return "shared";
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `apex-${design}.png`;
  a.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}

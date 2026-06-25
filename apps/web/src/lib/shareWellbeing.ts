import type { HealthResponse } from "@apex/shared";

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export type ShareDesign = "card" | "minimal" | "rings";

const RINGS = [
  { key: "stress", label: "STRESS", from: "#f59e0b", to: "#fb7185" },
  { key: "recovery", label: "RECOVERY", from: "#22c55e", to: "#a3e635" },
  { key: "sleep", label: "SLEEP", from: "#6366f1", to: "#a5b4fc" },
] as const;

function drawArc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  lw: number,
  value: number,
  from: string,
  to: string,
) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
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
  ctx.shadowBlur = 24;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

/** A ring with a cleanly centred "NN%" and a label beneath it. */
function drawRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  lw: number,
  ring: (typeof RINGS)[number],
  value: number | null,
  shadow: boolean,
) {
  drawArc(ctx, cx, cy, r, lw, value ?? 0, ring.from, ring.to);

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

  if (shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 12;
  }
  ctx.font = numFont;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(num, startX, baseY);
  if (value != null) {
    ctx.font = pctFont;
    ctx.fillStyle = shadow ? "#e6e6ee" : "#9393a6";
    ctx.fillText("%", startX + nw + 6, baseY);
  }
  ctx.shadowBlur = 0;

  ctx.textAlign = "center";
  ctx.font = `700 ${Math.round(r * 0.2)}px ${FONT}`;
  if (shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 8;
  }
  ctx.fillStyle = ring.to;
  ctx.fillText(ring.label, cx, cy + r + r * 0.42);
  ctx.shadowBlur = 0;
}

function wrapCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = w;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
}

function scoreOf(health: HealthResponse, key: (typeof RINGS)[number]["key"]) {
  return health.scores[key];
}

function ringRow(
  ctx: CanvasRenderingContext2D,
  health: HealthResponse,
  cy: number,
  r: number,
  lw: number,
  shadow: boolean,
) {
  const xs = [540 - (2 * (r + 24)), 540, 540 + (2 * (r + 24))];
  RINGS.forEach((ring, i) =>
    drawRing(ctx, xs[i], cy, r, lw, ring, scoreOf(health, ring.key), shadow),
  );
}

function buildCanvas(
  health: HealthResponse,
  coaching: string,
  design: ShareDesign,
): HTMLCanvasElement {
  const W = 1080;
  const H = design === "rings" ? 1080 : 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.textAlign = "center";

  if (design === "rings") {
    // Transparent background — a sticker you can drop on a story photo.
    ringRow(ctx, health, 470, 150, 30, true);
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 60px ${FONT}`;
    ctx.fillText("Apex", W / 2, 880);
    ctx.shadowBlur = 0;
    return canvas;
  }

  if (design === "minimal") {
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#9393a6";
    ctx.font = `600 32px ${FONT}`;
    ctx.fillText(
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
      W / 2,
      170,
    );
    ringRow(ctx, health, 620, 150, 30, false);
    ctx.fillStyle = "#7c6bff";
    ctx.font = `800 56px ${FONT}`;
    ctx.fillText("Apex", W / 2, H - 130);
    return canvas;
  }

  // design === "card" — full story card
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b0b12");
  bg.addColorStop(1, "#14141d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 120, 0, W / 2, 120, 700);
  glow.addColorStop(0, "rgba(124,107,255,0.18)");
  glow.addColorStop(1, "rgba(124,107,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 760);

  ctx.fillStyle = "#9393a6";
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText("WELLBEING", W / 2, 150);
  ctx.fillStyle = "#ececf1";
  ctx.font = `700 54px ${FONT}`;
  ctx.fillText(
    new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    }),
    W / 2,
    218,
  );

  ringRow(ctx, health, 560, 128, 24, false);

  const bits: string[] = [];
  if (health.sleepHours != null) bits.push(`${health.sleepHours}h sleep`);
  if (health.restingHr != null) bits.push(`${health.restingHr} bpm RHR`);
  if (health.steps != null) bits.push(`${health.steps.toLocaleString()} steps`);
  if (bits.length) {
    ctx.fillStyle = "#6b6b80";
    ctx.font = `500 28px ${FONT}`;
    ctx.fillText(bits.join("   ·   "), W / 2, 830);
  }

  ctx.fillStyle = "#ececf1";
  ctx.font = `500 38px ${FONT}`;
  wrapCentered(ctx, coaching, W / 2, 930, W - 200, 52);

  ctx.fillStyle = "#7c6bff";
  ctx.font = `800 44px ${FONT}`;
  ctx.fillText("Apex", W / 2, H - 90);
  return canvas;
}

/** A data URL for a small in-app preview of a design. */
export function previewUrl(
  health: HealthResponse,
  coaching: string,
  design: ShareDesign,
): string {
  return buildCanvas(health, coaching, design).toDataURL("image/png");
}

export type ShareResult = "shared" | "downloaded" | "error";

/** Render the chosen design and open the native share sheet (download fallback). */
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

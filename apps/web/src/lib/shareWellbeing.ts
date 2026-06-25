import type { HealthResponse } from "@apex/shared";

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

const RINGS = [
  { key: "stress", label: "STRESS", from: "#f59e0b", to: "#fb7185" },
  { key: "recovery", label: "RECOVERY", from: "#22c55e", to: "#a3e635" },
  { key: "sleep", label: "SLEEP", from: "#6366f1", to: "#a5b4fc" },
] as const;

function drawRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  lw: number,
  value: number,
  from: string,
  to: string,
) {
  // Track
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#23232e";
  ctx.stroke();

  if (value <= 0) return;

  const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, from);
  grad.addColorStop(1, to);
  const start = -Math.PI / 2;
  const end = start + (Math.min(100, value) / 100) * Math.PI * 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, end);
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.strokeStyle = grad;
  ctx.shadowColor = to;
  ctx.shadowBlur = 22;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function wrapCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
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
  return y;
}

/** Render the 3 wellbeing rings to a shareable 1080×1350 PNG (Whoop/Bevel-style). */
function render(health: HealthResponse, coaching: string): Promise<Blob | null> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b0b12");
  bg.addColorStop(1, "#14141d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft violet glow up top
  const glow = ctx.createRadialGradient(W / 2, 120, 0, W / 2, 120, 700);
  glow.addColorStop(0, "rgba(124,107,255,0.18)");
  glow.addColorStop(1, "rgba(124,107,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 700);

  ctx.textAlign = "center";

  // Header
  ctx.fillStyle = "#9393a6";
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText("W E L L B E I N G", W / 2, 150);
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

  // Rings
  const cy = 540;
  const r = 132;
  const lw = 26;
  const xs = [W / 2 - 330, W / 2, W / 2 + 330];
  RINGS.forEach((ring, i) => {
    const raw = health.scores[ring.key];
    const dim = raw == null;
    const val = raw ?? 0;
    drawRing(ctx, xs[i], cy, r, lw, dim ? 0 : val, ring.from, ring.to);

    const numText = dim ? "—" : String(val);
    ctx.fillStyle = "#ececf1";
    ctx.font = `800 84px ${FONT}`;
    const halfW = ctx.measureText(numText).width / 2;
    ctx.textAlign = "left";
    ctx.fillText(numText, xs[i] - halfW, cy + 26);
    if (!dim) {
      ctx.fillStyle = "#9393a6";
      ctx.font = `700 30px ${FONT}`;
      ctx.fillText("%", xs[i] + halfW + 8, cy - 14);
    }

    ctx.textAlign = "center";
    ctx.fillStyle = ring.to;
    ctx.font = `700 28px ${FONT}`;
    ctx.fillText(ring.label, xs[i], cy + r + 62);
  });

  // Supporting stats line
  const bits: string[] = [];
  if (health.sleepHours != null) bits.push(`${health.sleepHours}h sleep`);
  if (health.restingHr != null) bits.push(`${health.restingHr} bpm RHR`);
  if (health.steps != null) bits.push(`${health.steps.toLocaleString()} steps`);
  if (bits.length) {
    ctx.fillStyle = "#6b6b80";
    ctx.font = `500 28px ${FONT}`;
    ctx.fillText(bits.join("   ·   "), W / 2, 800);
  }

  // Coaching
  ctx.fillStyle = "#ececf1";
  ctx.font = `500 38px ${FONT}`;
  wrapCentered(ctx, coaching, W / 2, 900, W - 200, 52);

  // Wordmark
  ctx.fillStyle = "#7c6bff";
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText("APEX", W / 2, H - 90);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export type ShareResult = "shared" | "downloaded" | "error";

/** Share the wellbeing card via the native sheet, falling back to a download. */
export async function shareWellbeing(
  health: HealthResponse,
  coaching: string,
): Promise<ShareResult> {
  const blob = await render(health, coaching);
  if (!blob) return "error";
  const file = new File([blob], "apex-wellbeing.png", { type: "image/png" });

  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: "My Apex wellbeing",
        text: "Today's recovery, sleep & stress.",
      });
      return "shared";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return "shared";
      // otherwise fall through to a download
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "apex-wellbeing.png";
  a.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}

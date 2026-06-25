import { useMemo, useState } from "react";
import type { HealthResponse } from "@apex/shared";
import {
  type ShareDesign,
  previewUrl,
  shareWellbeing,
} from "../../lib/shareWellbeing";
import { Sheet } from "../ui/Sheet";

const DESIGNS: { id: ShareDesign; name: string; desc: string }[] = [
  { id: "card", name: "Full card", desc: "Rings, stats & coaching" },
  { id: "minimal", name: "Minimal", desc: "Clean — just rings" },
  { id: "rings", name: "Rings only", desc: "Transparent overlay" },
];

export function ShareSheet({
  open,
  onClose,
  health,
  coaching,
}: {
  open: boolean;
  onClose: () => void;
  health: HealthResponse;
  coaching: string;
}) {
  const [busy, setBusy] = useState<ShareDesign | null>(null);

  const previews = useMemo(
    () =>
      open
        ? DESIGNS.map((d) => ({ ...d, url: previewUrl(health, coaching, d.id) }))
        : [],
    [open, health, coaching],
  );

  async function pick(id: ShareDesign) {
    if (busy) return;
    setBusy(id);
    try {
      await shareWellbeing(health, coaching, id);
      onClose();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Share your rings">
      <div className="grid grid-cols-3 gap-3">
        {previews.map((d) => (
          <button
            key={d.id}
            onClick={() => pick(d.id)}
            disabled={busy != null}
            className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface-2 p-2 text-center active:opacity-80 disabled:opacity-50"
          >
            <div
              className="flex h-32 w-full items-center justify-center overflow-hidden rounded-xl"
              style={
                d.id === "rings"
                  ? {
                      backgroundImage:
                        "linear-gradient(135deg,#4c1d95,#1e3a8a)",
                    }
                  : { backgroundColor: "#0a0a0f" }
              }
            >
              <img
                src={d.url}
                alt={d.name}
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <div>
              <div className="text-sm font-medium text-text">{d.name}</div>
              <div className="text-[11px] leading-tight text-muted">
                {d.desc}
              </div>
            </div>
            {busy === d.id && (
              <span className="text-[11px] text-accent">Preparing…</span>
            )}
          </button>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-muted">
        Opens your phone’s share sheet — post to Instagram, WhatsApp, and more.
      </p>
    </Sheet>
  );
}

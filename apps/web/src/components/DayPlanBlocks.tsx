import { ChevronDown } from "lucide-react";
import { useState } from "react";

interface Block {
  time: string | null;
  label: string;
}

// "07:00–08:00 — thing", "7:00-8:30 - thing", or a single "07:00 — thing".
const TIME_RE =
  /^(\d{1,2}:\d{2}\s*[–\-—]\s*\d{1,2}:\d{2}|\d{1,2}:\d{2})\s*[—–\-:]\s*(.+)$/;

function parseBlocks(text: string): Block[] {
  return text
    .split("\n")
    .map((l) => l.trim().replace(/^[-•*]\s*/, ""))
    .filter(Boolean)
    .map((line) => {
      const m = line.match(TIME_RE);
      if (m) return { time: m[1].replace(/\s+/g, ""), label: m[2].trim() };
      return { time: null, label: line };
    });
}

const PREVIEW = 5;

/** Renders an AI day-plan as tidy time-blocked rows, collapsing long plans. */
export function DayPlanBlocks({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const blocks = parseBlocks(text);
  if (blocks.length === 0) return null;

  const shown = expanded ? blocks : blocks.slice(0, PREVIEW);
  const hidden = blocks.length - shown.length;

  return (
    <div>
      <ul className="space-y-1.5">
        {shown.map((b, i) => (
          <li
            key={i}
            className="flex gap-3 rounded-xl bg-surface-2 px-3 py-2.5"
          >
            <span className="w-[88px] shrink-0 whitespace-nowrap pt-px text-xs font-semibold tabular-nums text-accent">
              {b.time ?? ""}
            </span>
            <span className="flex-1 text-sm leading-snug text-text">
              {b.label}
            </span>
          </li>
        ))}
      </ul>
      {blocks.length > PREVIEW && (
        <button
          onClick={() => setExpanded((o) => !o)}
          className="mt-2 flex w-full items-center justify-center gap-1 text-xs font-medium text-accent active:opacity-70"
        >
          {expanded ? "Show less" : `Show ${hidden} more`}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
            strokeWidth={2.5}
          />
        </button>
      )}
    </div>
  );
}

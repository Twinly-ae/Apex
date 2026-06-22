import { useState } from "react";

/** Tap a number to edit it inline; saves on Enter/blur. For fast balance edits. */
export function InlineNumber({
  value,
  onSave,
}: {
  value: number;
  onSave: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value));

  function commit() {
    setEditing(false);
    const n = Number(val);
    if (!Number.isNaN(n) && n !== value) onSave(n);
    else setVal(String(value));
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        inputMode="decimal"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setVal(String(value));
            setEditing(false);
          }
        }}
        className="w-24 rounded-lg border border-accent bg-surface-2 px-2 py-1 text-right text-text outline-none"
      />
    );
  }

  return (
    <button
      onClick={() => {
        setVal(String(value));
        setEditing(true);
      }}
      className="tabular-nums text-text underline decoration-line decoration-dotted underline-offset-4"
    >
      {value.toLocaleString()}
    </button>
  );
}

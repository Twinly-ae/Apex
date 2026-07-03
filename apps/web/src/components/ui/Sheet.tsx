import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Mobile bottom-sheet modal with backdrop, used for all quick-log forms. */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
        aria-label="Close"
        tabIndex={-1}
      />
      <div className="relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-line/70 bg-surface p-5 pb-8 shadow-float safe-bottom animate-sheet-up">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line" />
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold tracking-tight text-text">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-muted active:text-text"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Shared input styling — large tap targets, 16px text (no iOS zoom). */
export const inputClass =
  "w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-text placeholder:text-muted/70 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30";

export const primaryButtonClass =
  "w-full rounded-2xl bg-gradient-to-br from-accent to-accent-strong px-4 py-3.5 text-center font-semibold text-white shadow-glow transition active:scale-[0.98] active:opacity-90 disabled:opacity-50 disabled:shadow-none";

/** Select styling: hides the native chevron and draws our own (see index.css). */
export const selectClass = `${inputClass} appearance-none pr-10 select-chevron`;

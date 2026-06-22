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
        className="absolute inset-0 bg-black/60 animate-fade-in"
        onClick={onClose}
        aria-label="Close"
        tabIndex={-1}
      />
      <div className="relative w-full max-w-md rounded-t-2xl border border-line bg-surface p-5 pb-8 safe-bottom animate-sheet-up">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">{title}</h2>
          <button
            onClick={onClose}
            className="-m-2 p-2 text-muted hover:text-text"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Shared input styling — large tap targets, 16px text (no iOS zoom). */
export const inputClass =
  "w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-text placeholder:text-muted outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30";

export const primaryButtonClass =
  "w-full rounded-xl bg-gradient-to-br from-accent to-accent-strong px-4 py-3.5 text-center font-semibold text-white shadow-glow transition active:scale-[0.99] active:opacity-90 disabled:opacity-50 disabled:shadow-none";

/** Select styling: hides the native chevron and draws our own (see index.css). */
export const selectClass = `${inputClass} appearance-none pr-10 select-chevron`;

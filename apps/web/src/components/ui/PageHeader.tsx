import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Consistent page header: bold display title, optional eyebrow, optional
 * back link, and a right-hand action slot.
 */
export function PageHeader({
  title,
  eyebrow,
  backTo,
  action,
}: {
  title: string;
  eyebrow?: string;
  backTo?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {backTo && (
          <Link
            to={backTo}
            aria-label="Back"
            className="pressable -m-1 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-surface text-muted"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
          </Link>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              {eyebrow}
            </div>
          )}
          <h1 className="truncate font-display text-[26px] font-bold leading-tight tracking-tight text-text">
            {title}
          </h1>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

import { useState } from "react";
import type { ReviewType } from "@apex/shared";
import { useGenerateReview, useReview } from "../../lib/queries";

const TYPES: { id: ReviewType; label: string }[] = [
  { id: "twinly", label: "Twinly" },
  { id: "fitness", label: "Fitness" },
  { id: "money", label: "Money" },
];

/** AI weekly review across Twinly, fitness, and money. */
export function WeeklyReview() {
  const [type, setType] = useState<ReviewType>("twinly");
  const review = useReview(type);
  const gen = useGenerateReview();
  const configured = review.data?.configured ?? false;

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
        Weekly review
      </h2>

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
        {TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setType(t.id)}
            className={`rounded-lg py-2 text-xs font-medium ${
              type === t.id ? "bg-accent text-white" : "text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!configured ? (
        <p className="mt-3 text-sm text-muted">
          Set <code className="text-text">ANTHROPIC_API_KEY</code> on the API to
          get Claude's weekly reviews.
        </p>
      ) : (
        <>
          <button
            onClick={() => gen.mutate(type)}
            disabled={gen.isPending}
            className="mt-3 w-full rounded-xl bg-surface-2 px-4 py-2.5 text-sm font-medium text-text active:opacity-80 disabled:opacity-50"
          >
            {gen.isPending
              ? "Reviewing…"
              : review.data?.text
                ? "Regenerate review"
                : "Generate review"}
          </button>
          {review.data?.text ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-text">
              {review.data.text}
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Get a concise weekly read on your {type} with what to do next.
            </p>
          )}
        </>
      )}
    </section>
  );
}

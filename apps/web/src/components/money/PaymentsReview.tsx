import { useGeneratePaymentsReview, usePaymentsReview } from "../../lib/queries";

/** Claude reviews recurring payments/subscriptions from statements + bills. */
export function PaymentsReview() {
  const review = usePaymentsReview();
  const gen = useGeneratePaymentsReview();
  const configured = review.data?.configured ?? false;

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Payments review
        </h2>
        {configured && (
          <button
            onClick={() => gen.mutate()}
            disabled={gen.isPending}
            className="text-xs text-accent active:opacity-70 disabled:opacity-50"
          >
            {gen.isPending
              ? "Reviewing…"
              : review.data?.text
                ? "Refresh"
                : "Review my payments"}
          </button>
        )}
      </div>
      {!configured ? (
        <p className="text-sm text-muted">
          Set <code className="text-text">ANTHROPIC_API_KEY</code> on the API to
          get an AI review of your recurring payments.
        </p>
      ) : review.data?.text ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
          {review.data.text}
        </p>
      ) : (
        <p className="text-sm text-muted">
          Claude scans your imported statements and bills for subscriptions and
          recurring charges — what went up, what overlaps, what to cancel.
        </p>
      )}
      {gen.isError && (
        <p className="mt-2 text-xs text-bad">{(gen.error as Error).message}</p>
      )}
    </section>
  );
}

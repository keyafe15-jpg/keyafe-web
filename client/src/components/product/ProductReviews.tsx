import { useState } from "react";
import { Star } from "lucide-react";
import { useProductReviews, useSubmitProductReview } from "@/hooks/useProductReviews";
import { useAuth } from "@/store/auth";
import { cn } from "@/lib/cn";

const inputClass =
  "w-full rounded-xl border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none placeholder:text-ink-500 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20";

function StarRating({
  value,
  onChange,
  readOnly = false,
  size = "md",
}: {
  value: number;
  onChange?: (n: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md";
}) {
  const iconClass = size === "sm" ? "h-4 w-4" : "h-6 w-6";
  return (
    <div
      className="flex items-center justify-center gap-1"
      role={readOnly ? "img" : "radiogroup"}
      aria-label="Rating"
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        if (readOnly) {
          return (
            <Star
              key={n}
              className={cn(iconClass, filled ? "fill-brand-500 text-brand-500" : "text-cream-200")}
              aria-hidden
            />
          );
        }
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onClick={() => onChange?.(n)}
            className="rounded p-0.5 transition hover:scale-105"
          >
            <Star
              className={cn(iconClass, filled ? "fill-brand-500 text-brand-500" : "text-cream-200")}
            />
          </button>
        );
      })}
    </div>
  );
}

function formatReviewDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ProductReviews({ slug }: { slug: string }) {
  const user = useAuth((s) => s.user);
  const [page, setPage] = useState(1);
  const { data, isLoading } = useProductReviews(slug, page);
  const submit = useSubmitProductReview(slug);

  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const summary = data?.summary ?? { average: 0, count: 0 };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (rating < 1) {
      setFormError("Pick a star rating.");
      return;
    }
    if (displayName.trim().length < 2) {
      setFormError("Please enter your name.");
      return;
    }
    try {
      await submit.mutateAsync({
        rating,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
        displayName: displayName.trim(),
        email: email.trim() || undefined,
      });
      setSubmitted(true);
      setFormOpen(false);
      setRating(0);
      setTitle("");
      setBody("");
      if (!user) {
        setDisplayName("");
        setEmail("");
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not submit review");
    }
  }

  return (
    <section className="mt-14 border-t border-cream-200 pt-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl text-ink-900">Customer reviews</h2>
          <p className="mt-1 text-sm text-ink-500">
            {summary.count === 0
              ? "No published reviews yet — be the first."
              : `${summary.average.toFixed(1)} average · ${summary.count} review${summary.count === 1 ? "" : "s"}`}
          </p>
        </div>
        {summary.count > 0 && <StarRating value={summary.average} readOnly />}
      </div>

      <div className="mb-8 rounded-2xl border border-cream-200 bg-white/70 p-4 sm:p-6">
        {submitted ? (
          <p className="text-center text-sm text-ink-700">
            Thank you for your review! It will be published shortly.
          </p>
        ) : formOpen ? (
          <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="flex-1 text-center text-lg font-semibold text-ink-900">
                Write a review
              </h3>
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  setFormError(null);
                }}
                className="shrink-0 text-xs font-medium text-ink-500 hover:text-ink-900"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-1.5 text-center">
              <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Rating</p>
              <StarRating value={rating} onChange={setRating} />
            </div>

            <div>
              <label
                htmlFor="review-title"
                className="mb-1 block text-center text-xs font-medium text-ink-700"
              >
                Review title
              </label>
              <input
                id="review-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                placeholder="Give your review a title"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="review-body"
                className="mb-1 block text-center text-xs font-medium text-ink-700"
              >
                Review content
              </label>
              <textarea
                id="review-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={2000}
                rows={4}
                placeholder="Start writing here…"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="review-name"
                className="mb-1 block text-center text-xs font-medium text-ink-700"
              >
                Display name
              </label>
              <input
                id="review-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={80}
                required
                placeholder="Enter your name"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="review-email"
                className="mb-1 block text-center text-xs font-medium text-ink-700"
              >
                Email address <span className="font-normal text-ink-500">(optional)</span>
              </label>
              <input
                id="review-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address"
                className={inputClass}
              />
            </div>

            {formError && <p className="text-center text-xs text-red-600">{formError}</p>}

            <button
              type="submit"
              disabled={submit.isPending}
              className="w-full rounded-full bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {submit.isPending ? "Sending…" : "Submit review"}
            </button>
          </form>
        ) : (
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <p className="text-sm text-ink-500">Tried this bake? Tell others how it tasted.</p>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Write us a review
            </button>
          </div>
        )}
      </div>

      {isLoading && <p className="text-sm text-ink-500">Loading reviews…</p>}

      {!isLoading && data && data.items.length > 0 && (
        <ul className="space-y-4">
          {data.items.map((review) => (
            <li
              key={review.id}
              className="rounded-2xl border border-cream-200 bg-white/50 px-4 py-3"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-ink-900">{review.authorName}</span>
                {review.verifiedPurchase && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-700 uppercase">
                    Verified purchase
                  </span>
                )}
                <span className="text-xs text-ink-500">{formatReviewDate(review.createdAt)}</span>
              </div>
              <StarRating value={review.rating} readOnly size="sm" />
              {review.title && (
                <p className="mt-2 text-sm font-medium text-ink-900">{review.title}</p>
              )}
              {review.body && <p className="mt-1 text-sm text-ink-700">{review.body}</p>}
            </li>
          ))}
        </ul>
      )}

      {data && data.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className={cn(
              "rounded-full border border-cream-200 px-3 py-1.5 text-xs font-medium",
              page <= 1 ? "opacity-40" : "hover:bg-cream-50",
            )}
          >
            Previous
          </button>
          <span className="text-xs text-ink-500">
            {page} / {data.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className={cn(
              "rounded-full border border-cream-200 px-3 py-1.5 text-xs font-medium",
              page >= data.totalPages ? "opacity-40" : "hover:bg-cream-50",
            )}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}

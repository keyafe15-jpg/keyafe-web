import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useAdminReviews,
  useUpdateAdminReview,
  type AdminReview,
  type ReviewStatus,
} from "@/hooks/useAdminReviews";
import { cn } from "@/lib/cn";

const TABS: { key: ReviewStatus | "ALL"; label: string }[] = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "HIDDEN", label: "Hidden" },
  { key: "ALL", label: "All" },
];

const STATUS_TONE: Record<ReviewStatus, string> = {
  PENDING: "bg-amber-50 text-amber-800",
  APPROVED: "bg-emerald-50 text-emerald-800",
  HIDDEN: "bg-slate-100 text-slate-600",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="font-medium text-amber-600" aria-label={`${rating} of 5 stars`}>
      {"★".repeat(rating)}
      <span className="text-slate-300">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export function ReviewsListPage() {
  const [tab, setTab] = useState<ReviewStatus | "ALL">("PENDING");
  const { data: reviews = [], isLoading } = useAdminReviews(tab);
  const update = useUpdateAdminReview();

  const counts = useMemo(() => {
    // Counts only reflect the current fetched list (filtered by tab).
    return { shown: reviews.length };
  }, [reviews]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Product reviews</h1>
        <p className="mt-1 text-sm text-slate-500">
          Approve or hide customer reviews before they appear on the storefront.
        </p>
      </div>

      <div className="mb-5">
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-white p-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition",
                tab === t.key
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}

      {!isLoading && reviews.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          No reviews in this tab.
        </div>
      )}

      {!isLoading && reviews.length > 0 && (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <ReviewRow
              key={review.id}
              review={review}
              busy={update.isPending}
              onStatus={(status) => update.mutate({ id: review.id, status })}
            />
          ))}
        </ul>
      )}

      {!isLoading && reviews.length > 0 && (
        <p className="mt-4 text-xs text-slate-400">{counts.shown} shown</p>
      )}
    </div>
  );
}

function ReviewRow({
  review,
  busy,
  onStatus,
}: {
  review: AdminReview;
  busy: boolean;
  onStatus: (status: ReviewStatus) => void;
}) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Stars rating={review.rating} />
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                STATUS_TONE[review.status],
              )}
            >
              {review.status}
            </span>
            {review.verifiedPurchase && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 uppercase">
                Verified
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-slate-900">
            {review.authorName}{" "}
            <span className="font-normal text-slate-500">on</span>{" "}
            <Link
              to={`/products/${review.product.id}`}
              className="text-brand-600 hover:underline"
            >
              {review.product.name}
            </Link>
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {formatDate(review.createdAt)}
            {review.email ? ` · ${review.email}` : ""}
          </p>
          {review.title && (
            <p className="mt-2 text-sm font-semibold text-slate-900">{review.title}</p>
          )}
          {review.body ? (
            <p className="mt-1 text-sm text-slate-700">{review.body}</p>
          ) : (
            <p className="mt-2 text-sm text-slate-400 italic">No written comment</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {review.status !== "APPROVED" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onStatus("APPROVED")}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Approve
            </button>
          )}
          {review.status !== "HIDDEN" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onStatus("HIDDEN")}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Hide
            </button>
          )}
          {review.status !== "PENDING" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onStatus("PENDING")}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Mark pending
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

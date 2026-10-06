import { Star } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { SlideCarousel } from "@/components/ui/SlideCarousel";
import { RailChip } from "@/components/home/ProductRail";
import { useStoreProfile } from "@/hooks/useStoreProfile";
import { HOME_COPY } from "@/content/home";
import {
  googleReviewsConfigured,
  useGooglePlaceReviews,
  type GooglePlaceReview,
} from "@/hooks/useGooglePlaceReviews";
import { cn } from "@/lib/cn";

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "h-3 w-3",
            n <= Math.round(value) ? "fill-brand-500 text-brand-500" : "text-cream-200",
          )}
          aria-hidden
        />
      ))}
    </span>
  );
}

function RatingPill({
  name,
  rating,
  count,
  href,
  accent,
}: {
  name: string;
  rating: number;
  count: number;
  href?: string | null;
  accent: string;
}) {
  const Tag = href ? "a" : "div";
  return (
    <Tag
      {...(href ? { href, target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-cream-200 bg-white px-3 py-1.5 text-xs shadow-sm",
        href && "transition hover:-translate-y-0.5 hover:border-brand-300",
      )}
    >
      <span className="font-semibold" style={{ color: accent }}>
        {name}
      </span>
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
      <span className="font-semibold text-ink-900">{rating.toFixed(1)}</span>
      <span className="text-ink-500">({count.toLocaleString("en-IN")})</span>
    </Tag>
  );
}

function ReviewCard({ review }: { review: GooglePlaceReview }) {
  return (
    <blockquote className="flex h-full flex-col rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2.5">
        {review.photoUri ? (
          <img
            src={review.photoUri}
            alt=""
            className="h-8 w-8 rounded-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
            {review.authorName.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {review.authorUri ? (
            <a
              href={review.authorUri}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-sm font-medium text-ink-900 hover:text-brand-500"
            >
              {review.authorName}
            </a>
          ) : (
            <p className="truncate text-sm font-medium text-ink-900">{review.authorName}</p>
          )}
          <div className="flex items-center gap-1.5">
            <Stars value={review.rating} />
            {review.relativeTime && (
              <span className="text-[11px] text-ink-500">{review.relativeTime}</span>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2.5 line-clamp-4 text-sm leading-6 text-ink-700">“{review.text}”</p>
    </blockquote>
  );
}

/**
 * Compact social proof: Zomato/Swiggy rating pills, plus the live Google
 * rating and review quotes when configured.
 */
export function GoogleReviewsSection() {
  const configured = googleReviewsConfigured();
  const { data, isLoading, isError } = useGooglePlaceReviews();
  const copy = HOME_COPY.googleReviews;
  const profile = useStoreProfile();
  const { zomato, swiggy } = profile.ratings;
  const loadingGoogle = configured && !isError && isLoading;

  if (!data && !zomato && !swiggy && !loadingGoogle) return null;

  return (
    <section className="relative z-10 mx-auto max-w-6xl px-4 py-5 sm:py-7">
      <Reveal>
        <div className="rounded-2xl border border-cream-200 bg-white/60 p-4 shadow-sm backdrop-blur-md sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <RailChip label={copy.eyebrow} />
              <h2 className="mt-1.5 font-display text-lg leading-tight text-ink-900 sm:text-xl">
                {copy.heading}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {data && (
                <RatingPill
                  name="Google"
                  rating={data.rating}
                  count={data.reviewCount}
                  href={data.mapsUri ?? data.writeReviewUri}
                  accent="#4285F4"
                />
              )}
              {zomato && (
                <RatingPill
                  name="Zomato"
                  rating={zomato.rating}
                  count={zomato.count}
                  href={profile.socials.zomato}
                  accent="#E23744"
                />
              )}
              {swiggy && (
                <RatingPill
                  name="Swiggy"
                  rating={swiggy.rating}
                  count={swiggy.count}
                  href={profile.socials.swiggy}
                  accent="#FC8019"
                />
              )}
              {data && (
                <a
                  href={data.writeReviewUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-brand-500 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700"
                >
                  {copy.writeCta}
                </a>
              )}
            </div>
          </div>

          {loadingGoogle && <p className="mt-4 text-sm text-ink-500">Loading Google reviews…</p>}

          {data && data.reviews.length > 0 && (
            <SlideCarousel
              ariaLabel="Guest reviews"
              snapAlign="start"
              className="mt-4"
              slideClassName="w-[min(85%,20rem)] sm:w-[calc((100%-0.75rem)/2)] lg:w-[calc((100%-1.5rem)/3)]"
            >
              {data.reviews.map((review, index) => (
                <ReviewCard key={`${review.authorName}-${index}`} review={review} />
              ))}
            </SlideCarousel>
          )}

          <p className="mt-3 text-[11px] text-ink-500">
            {data && (
              <>
                Review quotes from Google ·{" "}
                {data.mapsUri ? (
                  <a
                    href={data.mapsUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink-700 underline-offset-2 hover:underline"
                  >
                    {copy.seeAllCta}
                  </a>
                ) : (
                  <span className="text-ink-700">{data.placeName}</span>
                )}{" "}
                ·{" "}
              </>
            )}
            Zomato &amp; Swiggy ratings are updated periodically from our listings.
          </p>
        </div>
      </Reveal>
    </section>
  );
}

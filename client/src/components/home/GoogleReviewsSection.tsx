import { Star } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { SlideCarousel } from "@/components/ui/SlideCarousel";
import { BRAND } from "@/content/brand";
import { HOME_COPY } from "@/content/home";
import {
  googleReviewsConfigured,
  useGooglePlaceReviews,
  type GooglePlaceReview,
} from "@/hooks/useGooglePlaceReviews";
import { cn } from "@/lib/cn";

function Stars({ value, size = "md" }: { value: number; size?: "sm" | "md" }) {
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            icon,
            n <= Math.round(value) ? "fill-brand-500 text-brand-500" : "text-cream-200",
          )}
          aria-hidden
        />
      ))}
    </span>
  );
}

function PlatformBadge({
  name,
  rating,
  count,
  href,
  accent,
}: {
  name: string;
  rating: number;
  count: number;
  href: string;
  accent: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-w-[9.5rem] flex-col items-center gap-1 rounded-2xl border border-cream-200 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-md transition hover:-translate-y-0.5 hover:border-brand-300"
    >
      <span className={cn("text-[11px] font-semibold tracking-[0.18em] uppercase", accent)}>
        {name}
      </span>
      <span className="flex items-center gap-1.5">
        <Stars value={rating} size="sm" />
        <span className="text-lg font-semibold text-ink-900">{rating.toFixed(1)}</span>
      </span>
      <span className="text-xs text-ink-500">
        {count.toLocaleString("en-IN")} rating{count === 1 ? "" : "s"}
      </span>
    </a>
  );
}

function ReviewCard({ review }: { review: GooglePlaceReview }) {
  return (
    <blockquote className="flex h-full flex-col rounded-2xl border border-cream-200 bg-white/70 p-5 shadow-sm backdrop-blur-md">
      <Stars value={review.rating} size="sm" />
      <p className="mt-3 flex-1 text-sm leading-6 text-ink-700">
        “{review.text.length > 220 ? `${review.text.slice(0, 220).trim()}…` : review.text}”
      </p>
      <footer className="mt-4 flex items-center gap-3 border-t border-cream-100 pt-3">
        {review.photoUri ? (
          <img
            src={review.photoUri}
            alt=""
            className="h-9 w-9 rounded-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
            {review.authorName.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
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
          {review.relativeTime && <p className="text-xs text-ink-500">{review.relativeTime}</p>}
        </div>
      </footer>
    </blockquote>
  );
}

/**
 * Home social proof: manual Zomato/Swiggy badges + live Google reviews when configured.
 */
export function GoogleReviewsSection() {
  const configured = googleReviewsConfigured();
  const { data, isLoading, isError } = useGooglePlaceReviews();
  const showGoogle = configured && !isError && (isLoading || Boolean(data));
  const copy = HOME_COPY.googleReviews;
  const { zomato, swiggy } = BRAND.platformRatings;

  return (
    <section className="relative z-10 mx-auto max-w-6xl px-4 py-12">
      <Reveal>
        <div className="mx-auto mb-8 max-w-xl rounded-2xl border border-white/50 bg-white/40 px-4 py-4 text-center shadow-sm backdrop-blur-md sm:mb-10">
          <p className="mb-2 text-xs font-semibold tracking-[0.28em] text-brand-500 uppercase">
            {copy.eyebrow}
          </p>
          <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">{copy.heading}</h2>
          <p className="mt-2 text-sm text-ink-500">{copy.sub}</p>
        </div>
      </Reveal>

      <Reveal>
        <div className="mb-8 flex flex-wrap items-stretch justify-center gap-3 sm:gap-4">
          {data && (
            <PlatformBadge
              name="Google"
              rating={data.rating}
              count={data.reviewCount}
              href={data.mapsUri ?? data.writeReviewUri}
              accent="text-[#4285F4]"
            />
          )}
          <PlatformBadge
            name="Zomato"
            rating={zomato.rating}
            count={zomato.count}
            href={BRAND.socials.zomato}
            accent="text-[#E23744]"
          />
          <PlatformBadge
            name="Swiggy"
            rating={swiggy.rating}
            count={swiggy.count}
            href={BRAND.socials.swiggy}
            accent="text-[#FC8019]"
          />
        </div>
      </Reveal>

      {showGoogle && isLoading && (
        <p className="mb-6 text-center text-sm text-ink-500">Loading Google reviews…</p>
      )}

      {data && data.reviews.length > 0 && (
        <Reveal>
          <SlideCarousel
            ariaLabel="Guest reviews"
            snapAlign="start"
            slideClassName="w-[min(100%,22rem)] sm:w-[calc((100%-0.75rem)/2)] lg:w-[calc((100%-1.5rem)/3)]"
          >
            {data.reviews.map((review, index) => (
              <ReviewCard key={`${review.authorName}-${index}`} review={review} />
            ))}
          </SlideCarousel>
        </Reveal>
      )}

      {data && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={data.writeReviewUri}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            {copy.writeCta}
          </a>
          {data.mapsUri && (
            <a
              href={data.mapsUri}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-cream-200 bg-white/70 px-5 py-2.5 text-sm font-medium text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              {copy.seeAllCta}
            </a>
          )}
        </div>
      )}

      {data && (
        <p className="mt-4 text-center text-[11px] text-ink-500">
          Review quotes from Google · <span className="text-ink-700">{data.placeName}</span>
        </p>
      )}
      <p className="mt-2 text-center text-[11px] text-ink-500">
        Zomato &amp; Swiggy ratings are updated periodically from our listings.
      </p>
    </section>
  );
}

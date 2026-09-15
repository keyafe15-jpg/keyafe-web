import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HOME_COPY } from "@/content/home";
import { cn } from "@/lib/cn";

export type CollectionSlide = {
  title: string;
  line: string;
  to: string;
  imageUrl: string | null;
  imageUrlMobile: string | null;
};

const slideFrame =
  "relative aspect-[16/9] min-h-[280px] w-full sm:aspect-auto sm:min-h-0 sm:h-[400px] md:h-[440px] lg:h-[480px]";

function ChevronMark({ direction }: { direction: "prev" | "next" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn(
        "h-[1.15rem] w-[1.15rem] transition-transform duration-300 ease-out",
        direction === "prev"
          ? "group-hover/nav:-translate-x-0.5 group-active/nav:-translate-x-1"
          : "group-hover/nav:translate-x-0.5 group-active/nav:translate-x-1",
      )}
    >
      {direction === "prev" ? (
        <path
          d="M14.5 5.5 8 12l6.5 6.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      ) : (
        <path
          d="M9.5 5.5 16 12l-6.5 6.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      )}
    </svg>
  );
}

function CollectionNavButton({
  direction,
  label,
  onClick,
  variant,
}: {
  direction: "prev" | "next";
  label: string;
  onClick: () => void;
  variant: "overlay" | "compact";
}) {
  const caption = direction === "prev" ? "Prev" : "Next";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "group/nav relative overflow-hidden text-ink-800 transition",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        variant === "overlay" &&
          "pointer-events-auto flex h-[4.25rem] w-12 flex-col items-center justify-center gap-1 border border-white/50 bg-white/55 shadow-[0_10px_30px_rgba(26,33,42,0.18)] backdrop-blur-md hover:border-brand-300/70 hover:bg-white/85 hover:text-brand-700",
        variant === "compact" &&
          "flex h-11 w-11 shrink-0 flex-col items-center justify-center border border-cream-200 bg-white/90 text-ink-800 shadow-sm backdrop-blur-sm hover:border-brand-300 hover:text-brand-700",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 w-[3px] bg-brand-500 transition-transform duration-300 ease-out",
          direction === "prev" ? "left-0 origin-left" : "right-0 origin-right",
          "scale-y-0 group-hover/nav:scale-y-100 group-focus-visible/nav:scale-y-100",
        )}
        aria-hidden="true"
      />
      <ChevronMark direction={direction} />
      {variant === "overlay" && (
        <span className="font-mono text-[8px] uppercase tracking-[0.28em] text-ink-500 transition-colors group-hover/nav:text-brand-600">
          {caption}
        </span>
      )}
    </button>
  );
}

export function HeroSlider({ slides }: { slides: CollectionSlide[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const count = slides.length;

  const goToPrevious = () => {
    if (count === 0) return;
    setSelectedIndex((current) => (current - 1 + count) % count);
  };

  const goToNext = () => {
    if (count === 0) return;
    setSelectedIndex((current) => (current + 1) % count);
  };

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (count < 2 || paused || reduceMotion) return;
    const autoplay = window.setInterval(() => {
      setSelectedIndex((current) => (current + 1) % count);
    }, 5200);
    return () => window.clearInterval(autoplay);
  }, [count, paused, reduceMotion]);

  useEffect(() => {
    if (selectedIndex >= count && count > 0) setSelectedIndex(0);
  }, [count, selectedIndex]);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    setTouchStartX(event.touches[0]?.clientX ?? null);
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null) return;
    const touchEndX = event.changedTouches[0]?.clientX ?? touchStartX;
    const delta = touchEndX - touchStartX;
    if (Math.abs(delta) > 40) {
      if (delta < 0) goToNext();
      else goToPrevious();
    }
    setTouchStartX(null);
  };

  const prevTitle = slides[(selectedIndex - 1 + count) % count]?.title;
  const nextTitle = slides[(selectedIndex + 1) % count]?.title;
 

  if (count === 0) {
    return <div className={cn(slideFrame, "animate-pulse bg-[#f7f2eb]")} />;
  }

  return (
    <div
      className="hero-showcase w-full min-w-0 overflow-x-clip"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setPaused(false);
        }
      }}
    >
      <div className="relative">
        <div
          className="overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ transform: `translateX(${-selectedIndex * 100}%)` }}
          >
            {slides.map((slide, index) => {
              const active = index === selectedIndex;
              return (
                <div
                  key={slide.to}
                  className="w-full shrink-0"
                  aria-hidden={!active}
                >
                  <Link
                    to={slide.to}
                    tabIndex={active ? 0 : -1}
                    className="group relative block overflow-hidden rounded-none outline-offset-4"
                  >
                    <div className={slideFrame}>
                      {slide.imageUrl || slide.imageUrlMobile ? (
                        <picture>
                          {slide.imageUrlMobile && (
                            <source
                              media="(max-width: 639px)"
                              srcSet={slide.imageUrlMobile}
                            />
                          )}
                          <img
                            src={slide.imageUrl ?? slide.imageUrlMobile ?? ""}
                            alt=""
                            className={cn(
                              "h-full w-full object-cover object-center",
                              active && !reduceMotion && "collection-ken",
                            )}
                          />
                        </picture>
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-brand-100 via-cream-100 to-amber-100" />
                      )}

                      {active && (
                        <div className="absolute inset-0 z-[1] flex items-end justify-center p-3 sm:items-center sm:p-4">
                          <div className="w-full max-w-[16rem] text-center sm:max-w-md">
                            <div className="border border-white/25 bg-black/25 px-3.5 py-2.5 shadow-[0_10px_28px_rgba(26,33,42,0.22)] backdrop-blur-md sm:rounded-lg sm:px-7 sm:py-5">
                              <div className="mb-1 flex items-center justify-center sm:mb-2">
                                <span className="inline-flex bg-brand-500/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white sm:rounded-md sm:px-2 sm:text-[10px] sm:tracking-[0.18em]">
                                  {HOME_COPY.collections.badge}
                                </span>
                              </div>
                              <p className="font-display text-lg leading-snug text-white drop-shadow-sm sm:text-3xl sm:leading-tight">
                                {slide.title}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-white/90 drop-shadow-sm sm:mt-1 sm:line-clamp-none sm:text-sm sm:leading-5">
                                {slide.line}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden items-center justify-between px-3 sm:flex md:px-4">
          <CollectionNavButton
            direction="prev"
            variant="overlay"
            onClick={goToPrevious}
            label={
              prevTitle
                ? `Previous collection, ${prevTitle}`
                : "Previous collection"
            }
          />
          <CollectionNavButton
            direction="next"
            variant="overlay"
            onClick={goToNext}
            label={
              nextTitle ? `Next collection, ${nextTitle}` : "Next collection"
            }
          />
        </div>
      </div>

      <div className="mt-4 px-4 sm:mt-5">
        {/* Mobile: current title + prev/next + dots — no horizontal scroll */}
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 sm:hidden">
          <div className="flex w-full items-center gap-2">
            <CollectionNavButton
              direction="prev"
              variant="compact"
              onClick={goToPrevious}
              label={
                prevTitle
                  ? `Previous collection, ${prevTitle}`
                  : "Previous collection"
              }
            />
            <div className="min-w-0 flex-1 text-center">
              <span className="block font-mono text-[10px] tracking-[0.22em] text-brand-500">
                {String(selectedIndex + 1).padStart(2, "0")}
                <span className="text-ink-300"> / {String(count).padStart(2, "0")}</span>
              </span>
              <p className="mt-0.5 truncate text-sm font-medium tracking-wide text-ink-900">
                {slides[selectedIndex]?.title}
              </p>
            </div>
            <CollectionNavButton
              direction="next"
              variant="compact"
              onClick={goToNext}
              label={
                nextTitle ? `Next collection, ${nextTitle}` : "Next collection"
              }
            />
          </div>
          <div
            role="tablist"
            aria-label="Collections"
            className="flex flex-wrap items-center justify-center gap-2"
          >
            {slides.map((slide, index) => {
              const active = index === selectedIndex;
              return (
                <button
                  type="button"
                  key={slide.to}
                  role="tab"
                  aria-selected={active}
                  aria-label={slide.title}
                  onClick={() => setSelectedIndex(index)}
                  className={cn(
                    "h-2.5 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
                    active
                      ? "w-6 bg-brand-500"
                      : "w-2.5 bg-cream-300 hover:bg-brand-300",
                  )}
                />
              );
            })}
          </div>
        </div>

        {/* Desktop / tablet: lookbook tabs that wrap instead of scrolling */}
        <div
          role="tablist"
          aria-label="Collections"
          className="mx-auto hidden w-full max-w-4xl border-b border-cream-200 sm:grid"
          style={{
            gridTemplateColumns: `repeat(${Math.max(count, 1)}, minmax(0, 1fr))`,
          }}
        >
          {slides.map((slide, index) => {
            const active = index === selectedIndex;
            return (
              <button
                type="button"
                key={slide.to}
                role="tab"
                aria-selected={active}
                aria-current={active ? "true" : undefined}
                onClick={() => setSelectedIndex(index)}
                className={cn(
                  "relative min-w-0 px-2 pb-3 pt-1 text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 md:px-3",
                  active ? "text-ink-900" : "text-ink-400 hover:text-ink-700",
                )}
              >
                <span className="block font-mono text-[10px] tracking-[0.22em] text-brand-500">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="mt-0.5 block text-balance text-sm font-medium leading-snug tracking-wide">
                  {slide.title}
                </span>
                <span
                  className={cn(
                    "absolute inset-x-2 -bottom-px h-[2px] origin-center bg-brand-500 transition-transform duration-300 md:inset-x-3",
                    active ? "scale-x-100" : "scale-x-0",
                  )}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

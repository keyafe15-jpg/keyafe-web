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

function ChevronIcon({ direction }: { direction: "prev" | "next" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5 md:h-6 md:w-6">
      <path
        d={direction === "prev" ? "M15 5.5 8.5 12 15 18.5" : "M9 5.5 15.5 12 9 18.5"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NavArrow({
  direction,
  label,
  onClick,
}: {
  direction: "prev" | "next";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full",
        "border border-white/35 bg-white/15 text-white backdrop-blur-md",
        "shadow-[0_8px_24px_rgba(26,33,42,0.18)] transition",
        "hover:border-white/60 hover:bg-white/30 hover:scale-105",
        "active:scale-95",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
        "md:h-11 md:w-11",
      )}
    >
      <ChevronIcon direction={direction} />
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
                <div key={slide.to} className="w-full shrink-0" aria-hidden={!active}>
                  <Link
                    to={slide.to}
                    tabIndex={active ? 0 : -1}
                    className="group relative block overflow-hidden rounded-none outline-offset-4"
                  >
                    <div className={slideFrame}>
                      {slide.imageUrl || slide.imageUrlMobile ? (
                        <picture>
                          {slide.imageUrlMobile && (
                            <source media="(max-width: 639px)" srcSet={slide.imageUrlMobile} />
                          )}
                          <img
                            src={slide.imageUrl ?? slide.imageUrlMobile ?? ""}
                            alt={slide.title}
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
                        <div className="absolute inset-0 z-[1] flex items-end justify-center p-3 pb-10 sm:items-center sm:p-4 sm:pb-12">
                          <div className="w-full max-w-[16rem] text-center sm:max-w-md">
                            <div className="border border-white/25 bg-black/25 px-3.5 py-2.5 shadow-[0_10px_28px_rgba(26,33,42,0.22)] backdrop-blur-md sm:rounded-lg sm:px-7 sm:py-5">
                              <div className="mb-1 flex items-center justify-center sm:mb-2">
                                <span className="inline-flex bg-brand-500/90 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.16em] text-white uppercase sm:rounded-md sm:px-2 sm:text-[10px] sm:tracking-[0.18em]">
                                  {HOME_COPY.collections.badge}
                                </span>
                              </div>
                              <h2 className="font-display text-lg leading-snug text-white drop-shadow-sm sm:text-3xl sm:leading-tight">
                                {slide.title}
                              </h2>
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

        {count > 1 && (
          <>
            <div className="pointer-events-none absolute inset-y-0 right-0 left-0 z-[2] flex items-center justify-between px-2.5 sm:px-4 md:px-5">
              <NavArrow
                direction="prev"
                onClick={goToPrevious}
                label={prevTitle ? `Previous collection, ${prevTitle}` : "Previous collection"}
              />
              <NavArrow
                direction="next"
                onClick={goToNext}
                label={nextTitle ? `Next collection, ${nextTitle}` : "Next collection"}
              />
            </div>

            <div
              role="tablist"
              aria-label="Collections"
              className="pointer-events-none absolute inset-x-0 bottom-3 z-[2] flex items-center justify-center gap-2 sm:bottom-4"
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
                      "pointer-events-auto h-2 rounded-full transition-all duration-300",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                      active
                        ? "w-6 bg-white shadow-sm"
                        : "w-2 bg-white/45 hover:bg-white/75",
                    )}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

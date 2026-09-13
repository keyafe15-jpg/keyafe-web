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

export function HeroSlider({ slides }: { slides: CollectionSlide[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [wideLayout, setWideLayout] = useState(false);
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
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia("(min-width: 640px)");
    const sync = () => {
      setReduceMotion(motion.matches);
      setWideLayout(wide.matches);
    };
    sync();
    motion.addEventListener("change", sync);
    wide.addEventListener("change", sync);
    return () => {
      motion.removeEventListener("change", sync);
      wide.removeEventListener("change", sync);
    };
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
  const indexLabel = String(selectedIndex + 1).padStart(2, "0");
  const totalLabel = String(count).padStart(2, "0");

  if (count === 0) {
    return (
      <div className="aspect-[16/9] min-h-[280px] animate-pulse bg-[#f7f2eb] sm:aspect-auto sm:min-h-0 sm:h-[300px] md:h-[340px] lg:h-[380px]" />
    );
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
            className="flex items-center gap-0 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] sm:gap-4"
            style={{
              transform: wideLayout
                ? `translateX(calc(${-selectedIndex} * (90% + 1rem) + 5%))`
                : `translateX(${-selectedIndex * 100}%)`,
            }}
          >
            {slides.map((slide, index) => {
              const active = index === selectedIndex;
              return (
                <div
                  key={slide.to}
                  className={cn(
                    "w-full shrink-0 transition-all duration-700 sm:w-[90%]",
                    active
                      ? "z-10 scale-100 opacity-100"
                      : "opacity-100 sm:scale-[0.94] sm:opacity-60",
                  )}
                  aria-hidden={!active}
                >
                  <Link
                    to={slide.to}
                    tabIndex={active ? 0 : -1}
                    className={cn(
                      "group relative block overflow-hidden rounded-none outline-offset-4",
                      active && "shadow-none",
                    )}
                  >
                    <div className="relative aspect-[16/9] min-h-[280px] w-full sm:aspect-auto sm:min-h-0 sm:h-[300px] md:h-[340px] lg:h-[380px]">
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
                              "h-full w-full object-cover object-center sm:object-center",
                              active && !reduceMotion && "collection-ken",
                            )}
                          />
                        </picture>
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-brand-100 via-cream-100 to-amber-100" />
                      )}

                      {active && (
                        <div className="absolute inset-x-4 bottom-4 sm:inset-auto sm:bottom-6 sm:left-6 sm:max-w-sm">
                          <div className="rounded-2xl border border-white/50 bg-white/88 p-4 shadow-[0_12px_30px_rgba(26,33,42,0.12)] backdrop-blur-md sm:p-5">
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <span className="inline-flex rounded-full bg-brand-500 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                                {HOME_COPY.collections.badge}
                              </span>
                              <span className="font-mono text-[11px] tracking-[0.2em] text-ink-500">
                                {indexLabel} — {totalLabel}
                              </span>
                            </div>
                            <p className="font-display text-2xl leading-tight text-ink-900 sm:text-3xl">
                              {slide.title}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-ink-600">
                              {slide.line}
                            </p>
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

        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden items-center justify-between px-1 sm:flex">
          <button
            type="button"
            onClick={goToPrevious}
            aria-label={
              prevTitle
                ? `Previous collection, ${prevTitle}`
                : "Previous collection"
            }
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/90 text-xl text-ink-800 shadow-md backdrop-blur transition hover:bg-white hover:text-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={goToNext}
            aria-label={
              nextTitle ? `Next collection, ${nextTitle}` : "Next collection"
            }
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/90 text-xl text-ink-800 shadow-md backdrop-blur transition hover:bg-white hover:text-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-col items-center gap-3 px-4 sm:block">
        <div
          role="tablist"
          aria-label="Collections"
          className="flex flex-wrap justify-center gap-2"
        >
        {slides.map((slide, index) => (
          <button
            type="button"
            key={slide.to}
            role="tab"
            aria-selected={index === selectedIndex}
            aria-current={index === selectedIndex ? "true" : undefined}
            onClick={() => setSelectedIndex(index)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
              index === selectedIndex
                ? "bg-ink-900 text-white shadow-[0_8px_18px_rgba(26,33,42,0.18)]"
                : "bg-white/80 text-ink-600 ring-1 ring-cream-200 hover:text-brand-600",
            )}
          >
            {slide.title}
          </button>
        ))}
        </div>
        <div className="flex items-center gap-2 sm:hidden">
          <button
            type="button"
            onClick={goToPrevious}
            aria-label={
              prevTitle
                ? `Previous collection, ${prevTitle}`
                : "Previous collection"
            }
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg text-ink-800 ring-1 ring-cream-200"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={goToNext}
            aria-label={
              nextTitle ? `Next collection, ${nextTitle}` : "Next collection"
            }
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg text-ink-800 ring-1 ring-cream-200"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}

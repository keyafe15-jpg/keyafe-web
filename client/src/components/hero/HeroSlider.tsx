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
  const indexLabel = String(selectedIndex + 1).padStart(2, "0");
  const totalLabel = String(count).padStart(2, "0");

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
                        <div className="absolute inset-0 z-[1] flex items-center justify-center p-4">
                          <div className="max-w-[20rem] text-center sm:max-w-md">
                            <div className="rounded-lg border border-white/25 bg-black/20 px-5 py-4 shadow-[0_12px_40px_rgba(26,33,42,0.2)] backdrop-blur-md sm:px-7 sm:py-5">
                              <div className="mb-2 flex items-center justify-center gap-3">
                                <span className="inline-flex rounded-md bg-brand-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                                  {HOME_COPY.collections.badge}
                                </span>
                              </div>
                              <p className="font-display text-2xl leading-tight text-white drop-shadow-sm sm:text-3xl">
                                {slide.title}
                              </p>
                              <p className="mt-1 text-sm leading-5 text-white/90 drop-shadow-sm">
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

        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden items-center justify-between px-3 sm:flex">
          <button
            type="button"
            onClick={goToPrevious}
            aria-label={
              prevTitle
                ? `Previous collection, ${prevTitle}`
                : "Previous collection"
            }
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-md border border-white/70 bg-white/80 text-xl text-ink-800 shadow-md backdrop-blur transition hover:bg-white hover:text-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={goToNext}
            aria-label={
              nextTitle ? `Next collection, ${nextTitle}` : "Next collection"
            }
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-md border border-white/70 bg-white/80 text-xl text-ink-800 shadow-md backdrop-blur transition hover:bg-white hover:text-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col items-center gap-3 px-4 sm:mt-5">
        <div
          role="tablist"
          aria-label="Collections"
          className="flex w-full max-w-4xl justify-start gap-0 overflow-x-auto border-b border-cream-200 sm:justify-center"
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
                  "relative shrink-0 px-4 pb-3 pt-1 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:text-center",
                  active ? "text-ink-900" : "text-ink-400 hover:text-ink-700",
                )}
              >
                <span className="block font-mono text-[10px] tracking-[0.22em] text-brand-500">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="mt-0.5 block whitespace-nowrap text-sm font-medium tracking-wide">
                  {slide.title}
                </span>
                <span
                  className={cn(
                    "absolute inset-x-4 -bottom-px h-[2px] origin-center bg-brand-500 transition-transform duration-300",
                    active ? "scale-x-100" : "scale-x-0",
                  )}
                  aria-hidden="true"
                />
              </button>
            );
          })}
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
            className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-lg text-ink-800 ring-1 ring-cream-200"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={goToNext}
            aria-label={
              nextTitle ? `Next collection, ${nextTitle}` : "Next collection"
            }
            className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-lg text-ink-800 ring-1 ring-cream-200"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}

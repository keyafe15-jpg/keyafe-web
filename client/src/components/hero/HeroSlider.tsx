import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";

export type HeroSlideView = {
  key: string;
  mediaType: "IMAGE" | "VIDEO";
  desktopUrl: string | null;
  mobileUrl: string | null;
  posterUrl: string | null;
  title: string | null;
  line: string | null;
  to: string | null;
};

/** Slim promo-banner height, so products start within the first screen. */
export const slideFrame =
  "relative aspect-[21/9] min-h-[150px] w-full sm:aspect-auto sm:min-h-0 sm:h-[240px] md:h-[270px] lg:h-[300px]";

const MOBILE_QUERY = "(max-width: 639px)";

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const sync = () => setMatches(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [query]);
  return matches;
}

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
        "pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full",
        "border border-white/35 bg-white/15 text-white backdrop-blur-md",
        "shadow-[0_8px_24px_rgba(26,33,42,0.18)] transition",
        "hover:border-white/60 hover:bg-white/30 hover:scale-105",
        "active:scale-95",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
        "md:h-10 md:w-10",
      )}
    >
      <ChevronIcon direction={direction} />
    </button>
  );
}

function SlideLink({
  to,
  active,
  children,
}: {
  to: string | null;
  active: boolean;
  children: ReactNode;
}) {
  const className = "group relative block overflow-hidden rounded-none outline-offset-4";
  if (!to) return <div className={className}>{children}</div>;
  if (/^https?:\/\//i.test(to)) {
    return (
      <a
        href={to}
        target="_blank"
        rel="noopener noreferrer"
        tabIndex={active ? 0 : -1}
        className={className}
      >
        {children}
      </a>
    );
  }
  return (
    <Link to={to} tabIndex={active ? 0 : -1} className={className}>
      {children}
    </Link>
  );
}

export function HeroSlider({ slides }: { slides: HeroSlideView[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  // Slide whose video can't autoplay (e.g. iOS Low Power Mode) or failed to
  // load, so the timer takes over instead of waiting for `ended`.
  const [stalledIndex, setStalledIndex] = useState<number | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const isMobile = useMediaQuery(MOBILE_QUERY);
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

  const activeIsVideo = slides[selectedIndex]?.mediaType === "VIDEO";
  // A playing video advances the carousel itself when it ends.
  const videoDrivesTiming = activeIsVideo && !reduceMotion && stalledIndex !== selectedIndex;

  useEffect(() => {
    if (count < 2 || paused || reduceMotion || videoDrivesTiming) return;
    const autoplay = window.setInterval(() => {
      setSelectedIndex((current) => (current + 1) % count);
    }, 5200);
    return () => window.clearInterval(autoplay);
  }, [count, paused, reduceMotion, videoDrivesTiming]);

  useEffect(() => {
    if (selectedIndex >= count && count > 0) setSelectedIndex(0);
  }, [count, selectedIndex]);

  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      if (index === selectedIndex && !reduceMotion) {
        video.currentTime = 0;
        video
          .play()
          .then(() => setStalledIndex((s) => (s === index ? null : s)))
          .catch(() => setStalledIndex(index));
      } else {
        video.pause();
      }
    });
  }, [selectedIndex, reduceMotion, count, isMobile]);

  const handleVideoEnded = (video: HTMLVideoElement) => {
    // Hovering pauses the carousel, so replay instead of moving on.
    if (paused) {
      video.currentTime = 0;
      void video.play().catch(() => setStalledIndex(selectedIndex));
      return;
    }
    goToNext();
  };

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
              const alt = slide.title ?? "Keyafe";
              const videoSrc = isMobile
                ? (slide.mobileUrl ?? slide.desktopUrl)
                : (slide.desktopUrl ?? slide.mobileUrl);
              return (
                <div key={slide.key} className="w-full shrink-0" aria-hidden={!active}>
                  <SlideLink to={slide.to} active={active}>
                    <div className={slideFrame}>
                      {slide.mediaType === "VIDEO" && videoSrc && !(reduceMotion && slide.posterUrl) ? (
                        <video
                          ref={(el) => {
                            videoRefs.current[index] = el;
                          }}
                          src={videoSrc}
                          poster={slide.posterUrl ?? undefined}
                          muted
                          playsInline
                          loop={count < 2}
                          preload={active ? "auto" : "none"}
                          onEnded={(e) => active && handleVideoEnded(e.currentTarget)}
                          onError={() => setStalledIndex(index)}
                          aria-label={alt}
                          className="h-full w-full object-cover object-center"
                        />
                      ) : slide.mediaType === "VIDEO" && slide.posterUrl ? (
                        <img
                          src={slide.posterUrl}
                          alt={alt}
                          className="h-full w-full object-cover object-center"
                        />
                      ) : slide.desktopUrl || slide.mobileUrl ? (
                        <picture>
                          {slide.mobileUrl && (
                            <source media={MOBILE_QUERY} srcSet={slide.mobileUrl} />
                          )}
                          <img
                            src={slide.desktopUrl ?? slide.mobileUrl ?? ""}
                            alt={alt}
                            className={cn(
                              "h-full w-full object-cover object-center",
                              active && !reduceMotion && "collection-ken",
                            )}
                          />
                        </picture>
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-brand-100 via-cream-100 to-amber-100" />
                      )}

                      {active && slide.title && (
                        <div className="absolute inset-0 z-[1] flex items-end justify-center p-3 pb-7 sm:items-center sm:p-4 sm:pb-10">
                          <div className="w-full max-w-[15rem] text-center sm:max-w-md">
                            <div className="hero-caption relative overflow-hidden border border-white/20 bg-[#1a1614]/35 px-4 py-2 shadow-[0_18px_40px_rgba(20,14,10,0.35)] backdrop-blur-md sm:px-8 sm:py-4">
                              <span
                                aria-hidden
                                className="pointer-events-none absolute inset-1 border border-white/15 sm:inset-1.5"
                              />
                              <h2 className="hero-caption-title font-display text-base leading-tight font-medium text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.35)] sm:text-3xl">
                                {slide.title}
                              </h2>
                              {slide.line && (
                                <>
                                  <div
                                    aria-hidden
                                    className="mx-auto my-1.5 hidden w-28 items-center gap-2 sm:my-2.5 sm:flex sm:w-40"
                                  >
                                    <span className="hero-caption-rule hero-caption-rule-left h-px flex-1 bg-gradient-to-r from-transparent to-amber-200/90" />
                                    <span className="hero-caption-gem size-1.5 bg-amber-200 sm:size-2" />
                                    <span className="hero-caption-rule hero-caption-rule-right h-px flex-1 bg-gradient-to-l from-transparent to-amber-200/90" />
                                  </div>
                                  <p className="hero-caption-line hidden text-xs leading-5 font-medium tracking-[0.22em] text-white/90 uppercase sm:line-clamp-2">
                                    {slide.line}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </SlideLink>
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
                label={prevTitle ? `Previous slide, ${prevTitle}` : "Previous slide"}
              />
              <NavArrow
                direction="next"
                onClick={goToNext}
                label={nextTitle ? `Next slide, ${nextTitle}` : "Next slide"}
              />
            </div>

            <div
              role="tablist"
              aria-label="Slides"
              className="pointer-events-none absolute inset-x-0 bottom-2 z-[2] flex items-center justify-center gap-1.5 sm:bottom-3"
            >
              {slides.map((slide, index) => {
                const active = index === selectedIndex;
                return (
                  <button
                    type="button"
                    key={slide.key}
                    role="tab"
                    aria-selected={active}
                    aria-label={slide.title ?? `Slide ${index + 1}`}
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

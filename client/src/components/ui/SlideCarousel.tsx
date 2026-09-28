import { Children, useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const GAP_PX = 12; // gap-3

type HideFrom = "sm" | "md" | "lg";

const hideFromClass: Record<HideFrom, string> = {
  sm: "sm:hidden",
  md: "md:hidden",
  lg: "lg:hidden",
};

type Props = {
  /** Slide content — one child per slide. */
  children: ReactNode;
  /** Accessible name for the scroller. */
  ariaLabel: string;
  /**
   * Hide the carousel from this breakpoint up (pair with a grid elsewhere).
   * Omit to show on all viewports.
   */
  hideFrom?: HideFrom;
  /** Autoplay interval in ms. Pass `0` to disable. Default `5500`. */
  autoPlayMs?: number;
  /** Width class for each slide. */
  slideClassName?: string;
  /** Snap alignment — `start` works better when multiple slides are visible. */
  snapAlign?: "start" | "center";
  className?: string;
};

/**
 * Horizontal snap carousel with dots + optional autoplay.
 * Use `hideFrom` when you only want it on small screens.
 */
export function SlideCarousel({
  children,
  ariaLabel,
  hideFrom,
  autoPlayMs = 5500,
  slideClassName = "w-[min(100%,22rem)]",
  snapAlign = "center",
  className,
}: Props) {
  const slides = Children.toArray(children).filter(Boolean);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  // Last reachable scroll position — less than slides.length - 1 when several slides show at once.
  const [maxIndex, setMaxIndex] = useState(Math.max(0, slides.length - 1));
  const [paused, setPaused] = useState(false);

  const measure = useEffectEvent(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const slide = el.querySelector<HTMLElement>("[data-slide-carousel-item]");
    if (!slide) return;
    const step = slide.offsetWidth + GAP_PX;
    if (step <= 0) return;
    const overflow = el.scrollWidth - el.clientWidth;
    const lastIndex = Math.max(0, Math.min(slides.length - 1, Math.round(overflow / step)));
    const atEnd = overflow > 0 && el.scrollLeft >= overflow - 2;
    const next = atEnd ? lastIndex : Math.round(el.scrollLeft / step);
    setMaxIndex(lastIndex);
    setActive(Math.max(0, Math.min(lastIndex, next)));
  });

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => measure();
    el.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (paused || autoPlayMs <= 0 || maxIndex < 1) return;
    const id = window.setInterval(() => {
      const el = scrollerRef.current;
      if (!el) return;
      const slide = el.querySelector<HTMLElement>("[data-slide-carousel-item]");
      if (!slide) return;
      const step = slide.offsetWidth + GAP_PX;
      const next = active >= maxIndex ? 0 : active + 1;
      el.scrollTo({ left: next * step, behavior: "smooth" });
    }, autoPlayMs);
    return () => window.clearInterval(id);
  }, [active, maxIndex, paused, autoPlayMs]);

  const goTo = (index: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const slide = el.querySelector<HTMLElement>("[data-slide-carousel-item]");
    if (!slide) return;
    el.scrollTo({ left: index * (slide.offsetWidth + GAP_PX), behavior: "smooth" });
  };

  if (slides.length === 0) return null;

  return (
    <div
      className={cn(hideFrom ? hideFromClass[hideFrom] : undefined, className)}
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory [scrollbar-width:none] items-stretch gap-3 overflow-x-auto scroll-smooth pb-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        aria-label={ariaLabel}
      >
        {slides.map((slide, index) => (
          <div
            key={index}
            data-slide-carousel-item
            className={cn(
              "flex shrink-0 flex-col",
              snapAlign === "start" ? "snap-start" : "snap-center",
              slideClassName,
            )}
          >
            {slide}
          </div>
        ))}
      </div>

      {maxIndex > 0 && (
        <div
          className="mt-4 flex items-center justify-center gap-2"
          role="tablist"
          aria-label={`${ariaLabel} slides`}
        >
          {Array.from({ length: maxIndex + 1 }, (_, index) => (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-label={`Slide ${index + 1} of ${maxIndex + 1}`}
              onClick={() => goTo(index)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                index === active ? "w-5 bg-brand-500" : "w-1.5 bg-cream-200 hover:bg-brand-300",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** @deprecated Prefer `SlideCarousel` — same component. */
export const MobileSlideCarousel = SlideCarousel;

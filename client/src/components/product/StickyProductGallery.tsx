import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/cn";
import { ProductGallery } from "./ProductGallery";

/**
 * Gallery that stays pinned beside the details on desktop. On smaller screens,
 * where it scrolls away, a slim bar with a thumbnail, name and price takes its
 * place under the site header.
 */
export function StickyProductGallery({
  images,
  alt,
  subtitle,
  price,
}: {
  images: string[];
  alt: string;
  subtitle?: string | null;
  price: ReactNode;
}) {
  const galleryRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [showBar, setShowBar] = useState(false);

  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const update = () => setHeaderHeight(header.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = galleryRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowBar(!entry.isIntersecting && entry.boundingClientRect.top < headerHeight),
      { rootMargin: `-${headerHeight}px 0px 0px 0px` },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [headerHeight]);

  const backToGallery = () => {
    const el = galleryRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - headerHeight - 12;
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <div className="lg:sticky lg:top-24">
      <div ref={galleryRef}>
        <ProductGallery images={images} alt={alt} />
      </div>

      <button
        type="button"
        onClick={backToGallery}
        aria-hidden={!showBar}
        tabIndex={showBar ? 0 : -1}
        aria-label={`${alt}: back to photos`}
        style={{ top: headerHeight }}
        className={cn(
          "fixed inset-x-0 z-30 border-b border-cream-200 bg-cream-50/95 shadow-sm backdrop-blur transition duration-200 lg:hidden",
          showBar ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0",
        )}
      >
        <span className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 text-left">
          <img
            src={images[0]}
            alt=""
            className="h-11 w-11 shrink-0 rounded-lg border border-cream-200 object-cover"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink-900">{alt}</span>
            {subtitle && <span className="block truncate text-xs text-ink-500">{subtitle}</span>}
          </span>
          <span className="shrink-0 text-sm font-semibold text-ink-900">{price}</span>
          <ChevronUp className="h-4 w-4 shrink-0 text-ink-500" />
        </span>
      </button>
    </div>
  );
}

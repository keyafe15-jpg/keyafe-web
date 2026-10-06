import { useState } from "react";
import { cn } from "@/lib/cn";

export function ProductGallery({
  images,
  alt,
  focusSrc,
}: {
  images: string[];
  alt: string;
  /** Jumps to this photo whenever it changes (e.g. the picked variant's photo). */
  focusSrc?: string | null;
}) {
  const [active, setActive] = useState(() => Math.max(0, focusSrc ? images.indexOf(focusSrc) : 0));
  const [lastFocus, setLastFocus] = useState(focusSrc);
  if (focusSrc !== lastFocus) {
    setLastFocus(focusSrc);
    const index = focusSrc ? images.indexOf(focusSrc) : -1;
    if (index >= 0) setActive(index);
  }
  if (images.length === 0) return null;

  const showThumbs = images.length > 1;
  const current = images[active] ?? images[0];

  return (
    <div className={cn("grid gap-3", showThumbs && "sm:grid-cols-[72px_1fr]")}>
      {showThumbs && (
        <div className="order-2 flex gap-2 overflow-x-auto sm:order-1 sm:flex-col sm:overflow-visible">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "aspect-square h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition sm:h-auto sm:w-full",
                i === active ? "border-brand-500" : "border-cream-200 hover:border-brand-300",
              )}
              aria-label={`View photo ${i + 1}`}
            >
              <img
                src={src}
                alt={`${alt} thumbnail ${i + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      <div className="order-1 overflow-hidden rounded-card border border-cream-200 bg-cream-50 sm:order-2">
        <img src={current} alt={alt} className="aspect-square w-full object-cover" />
      </div>
    </div>
  );
}

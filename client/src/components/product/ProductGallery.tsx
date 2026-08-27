import { useState } from "react";
import { cn } from "@/lib/cn";

export function ProductGallery({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const [active, setActive] = useState(0);
  if (images.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-[80px_1fr]">
      {/* Thumbnails — vertical on desktop, horizontal-scroll on mobile */}
      <div className="order-2 flex gap-2 overflow-x-auto sm:order-1 sm:flex-col sm:overflow-visible">
        {images.map((src, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "aspect-square h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition sm:h-auto sm:w-full",
              i === active
                ? "border-brand-500"
                : "border-cream-200 hover:border-brand-300",
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

      {/* Main image */}
      <div className="order-1 overflow-hidden rounded-card border border-cream-200 bg-cream-50 sm:order-2">
        <img
          src={images[active]}
          alt={alt}
          className="aspect-square w-full object-cover"
        />
      </div>
    </div>
  );
}

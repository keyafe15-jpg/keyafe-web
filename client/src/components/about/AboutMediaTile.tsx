import type { AboutMedia } from "@/content/about";
import { cn } from "@/lib/cn";

type Props = {
  media: AboutMedia;
  className?: string;
  /** Duplicate copies (e.g. in a marquee) should stay out of the accessibility tree. */
  decorative?: boolean;
};

export function AboutMediaTile({ media, className, decorative = false }: Props) {
  if (media.type === "video") {
    return (
      <video
        src={media.src}
        poster={media.poster}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={decorative ? undefined : media.alt}
        aria-hidden={decorative || undefined}
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }
  return (
    <img
      src={media.src}
      alt={decorative ? "" : media.alt}
      loading="lazy"
      decoding="async"
      className={cn("h-full w-full object-cover", className)}
    />
  );
}

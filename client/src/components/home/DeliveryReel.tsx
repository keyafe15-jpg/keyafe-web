import { useEffect, useRef, useState } from "react";
import { HOME_COPY } from "@/content/home";

/**
 * Full-bleed landscape strip — the delivery clip is wide and short,
 * so it sits edge-to-edge under the hero rather than in a tall frame.
 */
export function DeliveryReel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (reduceMotion) {
      video.pause();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          void video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [reduceMotion]);

  const copy = HOME_COPY.delivery;

  return (
    <section className="relative isolate w-full overflow-hidden" aria-label={copy.title}>
      <div className="relative w-full sm:h-[7.5rem] md:h-[11.5rem] lg:h-[25rem]">
        <video
          ref={videoRef}
          src={copy.src}
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
          className="h-full w-full object-cover object-center"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink-900/55 via-ink-900/20 to-transparent"
          aria-hidden
        />
      </div>
    </section>
  );
}

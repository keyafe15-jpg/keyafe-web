import { useEffect, useRef, useState } from "react";
import { HOME_COPY } from "@/content/home";

/** Delivery clip as a short inset band with the same-day pitch overlaid. */
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
    <section className="relative z-10 mx-auto max-w-6xl px-4 py-5 sm:py-7">
      <div className="relative isolate h-[13rem] overflow-hidden rounded-2xl shadow-sm sm:h-[15rem] lg:h-[18rem]">
        <video
          ref={videoRef}
          src={copy.src}
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink-900/80 via-ink-900/45 to-ink-900/5"
          aria-hidden
        />
      </div>
    </section>
  );
}

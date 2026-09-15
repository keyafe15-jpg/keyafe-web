import { useEffect, useRef, useState } from "react";
import { HOME_COPY } from "@/content/home";

export function HomeFilm() {
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
      { threshold: 0.25 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [reduceMotion]);

  return (
    <section
      className="bg-cream-50 py-10 md:py-16"
      aria-labelledby="home-film-heading"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 md:grid-cols-2 md:gap-12 lg:gap-16">
        <video
          ref={videoRef}
          src={HOME_COPY.film.src}
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          className="h-auto w-auto max-w-full justify-self-start"
        />

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-600">
            {HOME_COPY.film.eyebrow}
          </p>
          <h2
            id="home-film-heading"
            className="mt-2 font-display text-3xl leading-tight text-ink-900 md:text-4xl"
          >
            {HOME_COPY.film.title}
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-ink-600">
            {HOME_COPY.film.body}
          </p>
          <ul className="mt-6 space-y-2.5">
            {HOME_COPY.film.points.map((point) => (
              <li
                key={point}
                className="flex items-start gap-2.5 text-sm leading-6 text-ink-800"
              >
                <span
                  className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-sm bg-brand-500"
                  aria-hidden="true"
                />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { ABOUT_FILM } from "@/content/about";

function CountUp({
  value,
  suffix = "",
  active,
  instant,
}: {
  value: number;
  suffix?: string;
  active: boolean;
  instant?: boolean;
}) {
  const [display, setDisplay] = useState(instant ? value : 0);
  const frameRef = useRef<number | null>(null);

  const run = useEffectEvent(() => {
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    if (instant) {
      setDisplay(value);
      return;
    }
    if (!active) {
      setDisplay(0);
      return;
    }

    const duration = 1400;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
  });

  useEffect(() => {
    run();
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    };
  }, [active, value, instant]);

  return (
    <span className="tabular-nums">
      {display.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}

/** "15000+ orders delivered" film with a count-up, after the story timeline. */
export function AboutFilm() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(section);
    return () => observer.disconnect();
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
      ref={sectionRef}
      className="mt-14 bg-cream-50 py-10 md:mt-20 md:py-16"
      aria-labelledby="about-film-heading"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 md:grid-cols-2 md:gap-12 lg:gap-16">
        <Reveal from="left">
          <div className="relative justify-self-start overflow-hidden rounded-[1.25rem] border border-white/60 shadow-[0_22px_50px_-24px_rgba(28,25,23,0.45)] ring-1 ring-ink-900/5">
            <video
              ref={videoRef}
              src={ABOUT_FILM.src}
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden="true"
              className="film-ken h-auto w-auto max-w-full"
            />
          </div>
        </Reveal>

        <Reveal from="right" delay={120}>
          <div>
            <p className="text-sm font-medium tracking-[0.2em] text-brand-500 uppercase">
              {ABOUT_FILM.eyebrow}
            </p>
            <h2
              id="about-film-heading"
              className="mt-2 text-3xl leading-tight text-ink-900 md:text-5xl"
            >
              <CountUp
                value={ABOUT_FILM.orders}
                suffix="+"
                active={inView}
                instant={reduceMotion}
              />{" "}
              {ABOUT_FILM.ordersLabel}
            </h2>
            <p className="mt-4 max-w-md text-base leading-7 text-ink-700">{ABOUT_FILM.body}</p>
            <ul className="mt-6 space-y-2.5">
              {ABOUT_FILM.points.map((point, index) => (
                <li
                  key={point}
                  className="home-list-item flex items-start gap-2.5 text-sm leading-6 text-ink-700"
                  style={{ animationDelay: `${280 + index * 120}ms` }}
                  data-active={inView && !reduceMotion ? "true" : undefined}
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
        </Reveal>
      </div>
    </section>
  );
}

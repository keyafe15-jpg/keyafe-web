import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { HOME_COPY } from "@/content/home";

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

export function HomeFilm() {
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
      className="bg-cream-50 py-10 md:py-16"
      aria-labelledby="home-film-heading"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 md:grid-cols-2 md:gap-12 lg:gap-16">
        <Reveal from="left">
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
        </Reveal>

        <Reveal from="right" delay={120}>
          <div>
            <p className="text-brand-600 text-[11px] font-semibold tracking-[0.28em] uppercase">
              {HOME_COPY.film.eyebrow}
            </p>
            <h2
              id="home-film-heading"
              className="mt-2 font-display text-3xl leading-tight text-ink-900 md:text-4xl"
            >
              <CountUp value={15000} suffix="+" active={inView} instant={reduceMotion} /> orders
              delivered
            </h2>
            <p className="text-ink-600 mt-4 max-w-md text-base leading-7">{HOME_COPY.film.body}</p>
            <ul className="mt-6 space-y-2.5">
              {HOME_COPY.film.points.map((point, index) => (
                <li
                  key={point}
                  className="home-list-item text-ink-800 flex items-start gap-2.5 text-sm leading-6"
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

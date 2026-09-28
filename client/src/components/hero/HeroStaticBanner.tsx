import { Link } from "react-router-dom";
import { HOME_COPY } from "@/content/home";
import { cn } from "@/lib/cn";
import { slideFrame } from "./HeroSlider";

/** Shown in place of the hero slider when no slides are live in admin. */
export function HeroStaticBanner() {
  const { banner, hero } = HOME_COPY;
  return (
    <div
      className={cn(
        slideFrame,
        "flex items-center justify-center overflow-hidden bg-gradient-to-br from-brand-100 via-cream-100 to-amber-100",
      )}
    >
      <div
        className="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-brand-300/40 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-16 -bottom-28 h-80 w-80 rounded-full bg-amber-200/60 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative z-[1] max-w-2xl px-6 text-center">
        <p className="text-brand-600 text-[11px] font-semibold tracking-[0.28em] uppercase sm:text-xs">
          {banner.eyebrow}
        </p>
        <h2 className="mt-2 font-display text-3xl leading-tight text-ink-900 sm:text-5xl">
          {banner.title}
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-ink-700 sm:text-base">
          {banner.line}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            to={hero.primaryCta.to}
            className="home-cta-glow rounded-md bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-brand-700"
          >
            {hero.primaryCta.label}
          </Link>
          <Link
            to={hero.secondaryCta.to}
            className="rounded-md border border-ink-700 bg-white/60 px-5 py-2.5 text-sm font-medium text-ink-700 backdrop-blur-sm transition hover:bg-white/80"
          >
            {hero.secondaryCta.label}
          </Link>
        </div>
      </div>
    </div>
  );
}

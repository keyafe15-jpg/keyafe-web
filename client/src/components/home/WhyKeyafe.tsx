import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChefHat, Heart, Leaf, Wheat, type LucideIcon } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { HOME_COPY } from "@/content/home";

type FreshKey = (typeof HOME_COPY.why.fresh.points)[number]["key"];

const FRESH_ICONS: Record<FreshKey, LucideIcon> = {
  batch: ChefHat,
  pure: Leaf,
  quality: Wheat,
};

/** Why custom orders matter, and why everything else is baked to order. */
export function WhyKeyafe() {
  const { custom, fresh } = HOME_COPY.why;

  return (
    <section className="relative z-10 mx-auto max-w-6xl px-4 py-4 sm:py-6">
      <Reveal>
        <div className="grid overflow-hidden rounded-2xl border border-cream-200 bg-white/75 shadow-sm backdrop-blur-md md:grid-cols-2">
          <article className="relative isolate overflow-hidden bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-4 text-white sm:px-5">
            <span className="absolute -right-3 -bottom-4 -z-10 rotate-12" aria-hidden>
              <Heart className="heartbeat h-20 w-20 fill-white/15 text-white/15" />
            </span>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-white/75 uppercase">
              {custom.eyebrow}
            </p>
            <h2 className="mt-1 font-display text-lg leading-snug sm:text-xl">{custom.title}</h2>
            <p className="mt-1 text-[13px] leading-5 text-white/90">{custom.body}</p>
            <Link
              to={custom.cta.to}
              className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-white underline-offset-4 hover:underline"
            >
              {custom.cta.label}
              <ArrowRight className="nudge-x h-3.5 w-3.5" aria-hidden />
            </Link>
          </article>

          <article className="px-4 py-4 sm:px-5">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-emerald-700 uppercase">
              {fresh.eyebrow}
            </p>
            <h2 className="mt-1 font-display text-lg leading-snug text-ink-900 sm:text-xl">
              {fresh.title}
            </h2>
            <p className="mt-1 text-[13px] leading-5 text-ink-700">{fresh.body}</p>
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {fresh.points.map(({ key, label }, index) => {
                const Icon = FRESH_ICONS[key];
                return (
                  <li
                    key={key}
                    className="pop-on-reveal inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800"
                    style={{ "--i": index } as CSSProperties}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {label}
                  </li>
                );
              })}
            </ul>
          </article>
        </div>
      </Reveal>
    </section>
  );
}

import { Reveal } from "@/components/motion/Reveal";
import { ABOUT_MOMENTS, ABOUT_MOMENTS_COPY, type AboutMoment } from "@/content/about";
import { AboutMediaTile } from "@/components/about/AboutMediaTile";
import { cn } from "@/lib/cn";

const shapeClass: Record<AboutMoment["shape"], string> = {
  tall: "aspect-[3/4]",
  wide: "aspect-[4/3]",
  square: "aspect-square",
};

export function MomentsMarquee() {
  if (ABOUT_MOMENTS.length === 0) return null;
  const mid = Math.ceil(ABOUT_MOMENTS.length / 2);
  const rows = [ABOUT_MOMENTS.slice(0, mid), ABOUT_MOMENTS.slice(mid)].filter((r) => r.length);

  return (
    <section className="mt-14 md:mt-20">
      <Reveal className="mx-auto max-w-6xl px-4">
        <p className="text-sm font-medium tracking-[0.2em] text-brand-500 uppercase">
          {ABOUT_MOMENTS_COPY.eyebrow}
        </p>
        <h2 className="mt-2 text-3xl text-ink-900 md:text-5xl">{ABOUT_MOMENTS_COPY.title}</h2>
      </Reveal>

      <div className="mt-6 space-y-3 md:mt-8">
        {rows.map((row, rowIndex) => (
          <MarqueeRow key={rowIndex} items={row} reverse={rowIndex % 2 === 1} />
        ))}
      </div>
    </section>
  );
}

/** One copy of the row must be wider than the widest screen, or a gap scrolls into view. */
const MIN_TILES_PER_COPY = 10;

function MarqueeRow({ items, reverse }: { items: AboutMoment[]; reverse: boolean }) {
  const repeats = Math.ceil(MIN_TILES_PER_COPY / items.length);
  const tiles = Array.from({ length: repeats }, () => items).flat();

  return (
    <div className="about-marquee overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
      <div
        className={cn("about-marquee-track flex w-max", reverse && "about-marquee-reverse")}
        style={{ animationDuration: `${tiles.length * 6}s` }}
      >
        {[0, 1].map((copy) =>
          tiles.map((item, index) => (
            <figure
              key={`${copy}-${index}`}
              aria-hidden={copy === 1 || index >= items.length || undefined}
              className="group relative mr-3 h-40 shrink-0 overflow-hidden rounded-2xl bg-cream-100 sm:h-56"
            >
              <div className={cn("h-full", shapeClass[item.shape])}>
                <AboutMediaTile
                  media={item}
                  decorative={copy === 1 || index >= items.length}
                  className="transition duration-700 group-hover:scale-105"
                />
              </div>
              {item.caption && (
                <figcaption className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-ink-900/80 to-transparent px-3 pt-6 pb-2.5 text-xs font-medium text-white transition duration-300 group-hover:translate-y-0 sm:text-sm">
                  {item.caption}
                </figcaption>
              )}
            </figure>
          )),
        )}
      </div>
    </div>
  );
}

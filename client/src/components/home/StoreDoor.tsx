import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { HOME_COPY } from "@/content/home";
import { storePath, type CategoryNode } from "@/hooks/useCategories";

export type StoreDoorPalette = {
  accentHex: string;
  softHex: string;
  deepHex: string;
};

const FALLBACK_PALETTE: StoreDoorPalette = {
  accentHex: "#E31C79",
  softHex: "#F8D7E6",
  deepHex: "#B0155F",
};

export function StoreDoor({
  name,
  slug,
  categories,
  palette,
}: {
  name: string;
  slug: string;
  categories: CategoryNode[];
  palette?: StoreDoorPalette | null;
}) {
  const colors = palette ?? FALLBACK_PALETTE;
  const imageUrl = categories.find((c) => c.imageUrl)?.imageUrl ?? null;
  const line =
    slug in HOME_COPY.storeDoors.bySlug
      ? HOME_COPY.storeDoors.bySlug[slug as keyof typeof HOME_COPY.storeDoors.bySlug]
      : HOME_COPY.storeDoors.fallbackLine;
  const href = storePath(slug);
  const doorStyle = {
    "--door-accent": colors.accentHex,
    "--door-soft": colors.softHex,
    "--door-deep": colors.deepHex,
  } as CSSProperties;

  return (
    <article className="mx-auto w-full max-w-[360px] sm:max-w-[400px]">
      <Link to={href} className="storefront group block rounded-[1.5rem] outline-offset-4">
        <div
          className="relative overflow-hidden rounded-[1.5rem] border-2 shadow-[0_18px_36px_rgba(26,33,42,0.12)]"
          style={{
            ...doorStyle,
            borderColor: "color-mix(in srgb, var(--door-deep) 35%, white)",
            backgroundColor: "var(--door-soft)",
          }}
        >
          <div className="relative aspect-[3/4]">
            <Awning accent={colors.accentHex} soft={colors.softHex} deep={colors.deepHex} />
            <div className="absolute top-[12%] left-1/2 z-20 w-[82%] -translate-x-1/2">
              <span className="mx-auto mb-0 block h-2.5 w-[2px] bg-ink-700/35" aria-hidden="true" />
              <div
                className="-rotate-1 rounded-[0.65rem] border-[3px] bg-white px-3 py-2 text-center shadow-[0_8px_0_rgba(26,33,42,0.14)] transition duration-500 group-hover:rotate-1"
                style={{ borderColor: "var(--door-deep)" }}
              >
                <p className="text-[10px] font-semibold tracking-[0.32em] text-ink-500 uppercase">
                  Welcome to
                </p>
                <p
                  className="brand-wordmark mt-0.5 block leading-none"
                  style={{
                    fontSize: "clamp(1.35rem, 5vw, 1.75rem)",
                    color: "var(--door-deep)",
                  }}
                >
                  {name}
                </p>
                <p
                  className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.28em] text-white uppercase"
                  style={{ backgroundColor: "var(--door-accent)" }}
                >
                  Store
                </p>
              </div>
            </div>

            <div className="absolute inset-x-[8%] top-[26%] bottom-[8%] [perspective:900px]">
              <div className="absolute inset-0 overflow-hidden rounded-t-[0.4rem] bg-[#2a1c14] shadow-inner">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={`${name} store`}
                    className="h-full w-full object-cover object-center opacity-90"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-5xl"
                    style={{
                      background: `linear-gradient(to bottom, ${colors.softHex}, ${colors.accentHex})`,
                    }}
                  >
                    🏪
                  </div>
                )}
                <div className="absolute inset-0 bg-amber-200/20 mix-blend-overlay" />
              </div>

              <div className="absolute inset-0 flex [transform-style:preserve-3d]">
                <DoorLeaf side="left" />
                <DoorLeaf side="right" />
              </div>
            </div>

            <div
              className="absolute inset-x-0 bottom-0 h-[8%] border-t"
              style={{
                borderColor: "color-mix(in srgb, var(--door-deep) 40%, white)",
                backgroundColor: "color-mix(in srgb, var(--door-accent) 55%, var(--door-deep))",
              }}
            />
          </div>
        </div>
        <p className="mt-3 text-center text-sm leading-6 text-ink-700">{line}</p>
        <span className="text-brand-600 mt-1 flex items-center justify-center gap-1 text-sm font-semibold">
          {HOME_COPY.storeDoors.enter}
          <span aria-hidden="true">→</span>
        </span>
      </Link>

      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {categories.map((category) => (
          <Link
            key={category.id}
            to={`/category/${category.slug}`}
            className="hover:text-brand-600 rounded-full border border-cream-200 bg-white px-3 py-1.5 text-sm text-ink-700 transition hover:border-brand-300"
          >
            {category.name}
          </Link>
        ))}
      </div>
    </article>
  );
}

function DoorLeaf({ side }: { side: "left" | "right" }) {
  const left = side === "left";
  return (
    <div
      className={`storefront-door relative h-full w-1/2 overflow-hidden border-ink-900/10 ${
        left ? "origin-left rounded-tl-sm border-r" : "origin-right rounded-tr-sm border-l"
      }`}
      style={{
        backgroundColor: "color-mix(in srgb, var(--door-soft) 70%, white)",
      }}
    >
      <div
        className="absolute inset-[10%_14%] rounded-sm border-2 bg-gradient-to-b from-sky-100/80 to-white/40 shadow-inner"
        style={{
          borderColor: "color-mix(in srgb, var(--door-deep) 45%, #e8d4b0)",
        }}
      />
      <span
        className={`absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border shadow-sm ${
          left ? "right-[6%]" : "left-[6%]"
        }`}
        style={{
          borderColor: "var(--door-deep)",
          backgroundColor: "var(--door-accent)",
        }}
      />
    </div>
  );
}

function Awning({ accent, soft, deep }: { accent: string; soft: string; deep: string }) {
  const stripes = [accent, soft, deep, soft, accent, soft, deep];

  return (
    <div className="absolute inset-x-0 top-0 z-10 h-[18%]">
      <div className="flex h-full overflow-hidden rounded-t-[1.35rem]">
        {stripes.map((color, i) => (
          <span key={i} className="h-full flex-1" style={{ backgroundColor: color }} />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex justify-around">
        {stripes.map((color, i) => (
          <span key={i} className="h-2 w-[12%] rounded-b-full" style={{ backgroundColor: color }} />
        ))}
      </div>
    </div>
  );
}

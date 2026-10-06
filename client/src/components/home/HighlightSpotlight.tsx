import { useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { CatalogProductCard } from "@/components/product/CatalogProductCard";
import { RAIL_ITEM_CLASS, RailArrow, RailChip, SeeAllTile } from "@/components/home/ProductRail";
import type { HomeHighlight } from "@/hooks/useProducts";
import { useScrollEdges } from "@/hooks/useScrollEdges";
import { HOME_COPY } from "@/content/home";
import { cn } from "@/lib/cn";

/** Light theme colours need dark text to stay readable. */
function isLight(hex: string) {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(n)) return false;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.7;
}

/**
 * "Trending" spotlight under the home search bar: one tab per live highlight,
 * each with a themed header and a product row. Hidden when nothing is live.
 */
export function HighlightSpotlight({ highlights }: { highlights: HomeHighlight[] }) {
  const baseId = useId();
  const [activeId, setActiveId] = useState<string | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  if (highlights.length === 0) return null;
  const activeIndex = Math.max(
    0,
    highlights.findIndex((h) => h.id === activeId),
  );
  const active = highlights[activeIndex]!;
  const showTabs = highlights.length > 1;

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = highlights.length - 1;
    const next =
      e.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : e.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    setActiveId(highlights[next]!.id);
    tabRefs.current[next]?.focus();
  };

  return (
    <section className="relative z-10 mx-auto max-w-6xl px-4 pt-5 sm:pt-6" data-inview="">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <RailChip label={HOME_COPY.highlights.chip} accent={active.themeColor} />
        {showTabs && (
          <div
            role="tablist"
            aria-label={HOME_COPY.highlights.tabsLabel}
            className="-mx-4 flex min-w-0 flex-1 basis-full [scrollbar-width:none] gap-1.5 overflow-x-auto px-4 py-0.5 sm:mx-0 sm:basis-auto sm:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {highlights.map((h, index) => {
              const selected = index === activeIndex;
              return (
                <button
                  key={h.id}
                  ref={(el) => {
                    tabRefs.current[index] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`${baseId}-tab-${h.id}`}
                  aria-selected={selected}
                  aria-controls={`${baseId}-panel`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveId(h.id)}
                  onKeyDown={(e) => onTabKey(e, index)}
                  className={cn(
                    "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition sm:text-sm",
                    selected
                      ? "shadow-sm"
                      : "border-cream-200 bg-white/80 text-ink-700 hover:border-ink-500/40",
                  )}
                  style={
                    selected
                      ? {
                          backgroundColor: h.themeColor,
                          borderColor: h.themeColor,
                          color: isLight(h.themeColor) ? "#1f2933" : "#fff",
                        }
                      : undefined
                  }
                >
                  {h.title}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <HighlightPanel
        key={active.id}
        id={`${baseId}-panel`}
        labelledBy={showTabs ? `${baseId}-tab-${active.id}` : undefined}
        highlight={active}
        role={showTabs ? "tabpanel" : undefined}
      />
    </section>
  );
}

function HighlightPanel({
  id,
  labelledBy,
  role,
  highlight: h,
}: {
  id: string;
  labelledBy?: string;
  role?: "tabpanel";
  highlight: HomeHighlight;
}) {
  const headingId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const edges = useScrollEdges(trackRef, h.products.length);
  const light = isLight(h.themeColor);
  const text = light ? "#1f2933" : "#ffffff";

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    el?.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div
      id={id}
      role={role}
      aria-labelledby={labelledBy ?? headingId}
      className="mt-3 rounded-3xl border p-2.5 sm:p-3"
      style={{ borderColor: `${h.themeColor}2e`, backgroundColor: `${h.themeColor}0d` }}
    >
      <div
        className="relative overflow-hidden rounded-2xl px-4 py-4 sm:px-6 sm:py-5"
        style={{ backgroundColor: h.themeColor, color: text }}
      >
        {h.bannerImage && (
          <img
            src={h.bannerImage}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: h.bannerImage
              ? `linear-gradient(90deg, ${h.themeColor} 30%, ${h.themeColor}99 65%, ${h.themeColor}33 100%)`
              : `radial-gradient(120% 140% at 100% 0%, rgba(255,255,255,0.22), transparent 55%)`,
          }}
        />
        <div className="relative flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2
              id={headingId}
              className="font-display text-xl leading-tight tracking-tight sm:text-2xl"
            >
              {h.title}
            </h2>
            {h.tagline && (
              <p className="mt-1 line-clamp-2 max-w-xl text-sm" style={{ opacity: 0.88 }}>
                {h.tagline}
              </p>
            )}
          </div>
          {h.seeAllTo && (
            <Link
              to={h.seeAllTo}
              className="group/see inline-flex shrink-0 items-center gap-1 rounded-full bg-white py-1 pr-1 pl-3 text-xs font-semibold shadow-sm transition hover:-translate-y-0.5"
              style={{ color: light ? "#1f2933" : h.themeColor }}
            >
              {HOME_COPY.tagSections.seeAll}
              <span
                aria-hidden
                className="grid h-5 w-5 place-items-center rounded-full transition-transform group-hover/see:translate-x-0.5"
                style={{ backgroundColor: `${h.themeColor}1f` }}
              >
                <ChevronRight className="h-3 w-3" />
              </span>
            </Link>
          )}
        </div>
      </div>

      <div className="relative">
        {(edges.start || edges.end) && (
          <div className="pointer-events-none absolute inset-y-0 -right-1 -left-1 z-10 hidden items-center justify-between sm:flex">
            <span className="pointer-events-auto">
              {edges.start && (
                <RailArrow dir={-1} disabled={false} label={h.title} onClick={() => scrollBy(-1)} />
              )}
            </span>
            <span className="pointer-events-auto">
              {edges.end && (
                <RailArrow dir={1} disabled={false} label={h.title} onClick={() => scrollBy(1)} />
              )}
            </span>
          </div>
        )}
        <div
          ref={trackRef}
          role="list"
          aria-labelledby={headingId}
          className="-mx-2.5 flex snap-x snap-mandatory scroll-px-2.5 [scrollbar-width:none] gap-3 overflow-x-auto px-2.5 pt-3 pb-1 [-ms-overflow-style:none] sm:mx-0 sm:scroll-px-0 sm:gap-4 sm:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {h.products.map((product, index) => (
            <div
              key={product.id}
              role="listitem"
              className={cn(RAIL_ITEM_CLASS, "rail-rise")}
              style={{ "--i": index } as CSSProperties}
            >
              <CatalogProductCard product={product} className="h-full" />
            </div>
          ))}
          {h.seeAllTo && (
            <div
              role="listitem"
              className={cn(RAIL_ITEM_CLASS, "rail-rise pr-px")}
              style={{ "--i": h.products.length } as CSSProperties}
            >
              <SeeAllTile
                to={h.seeAllTo}
                accent={light ? "#1f2933" : h.themeColor}
                label={HOME_COPY.rails.seeAllTile}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

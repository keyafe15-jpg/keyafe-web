import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { CatalogProductCard } from "@/components/product/CatalogProductCard";
import type { ProductCard } from "@/hooks/useProducts";
import { useScrollEdges } from "@/hooks/useScrollEdges";
import { HOME_COPY } from "@/content/home";
import { cn } from "@/lib/cn";

const DEFAULT_ACCENT = "#E31C79";

/** Card width per breakpoint: about 2.2 cards on phones so the next one peeks, then 3 and 4 up. */
export const RAIL_ITEM_CLASS =
  "w-[44%] min-w-[150px] shrink-0 snap-start sm:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/4)]";

export function RailChip({ label, accent = DEFAULT_ACCENT }: { label: string; accent?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.18em] uppercase"
      style={{ borderColor: `${accent}33`, backgroundColor: `${accent}14`, color: accent }}
    >
      <span className="chip-pulse h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
      {label}
    </span>
  );
}

/** Flips to true the first time the element scrolls into view. */
function useSeenOnce(ref: React.RefObject<HTMLElement | null>, deps: unknown) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, seen, deps]);
  return seen;
}

export function RailArrow({
  dir,
  disabled,
  label,
  onClick,
}: {
  dir: 1 | -1;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  const Icon = dir === 1 ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${dir === 1 ? "Next" : "Previous"} ${label}`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-cream-200 bg-white text-ink-700 shadow-sm transition hover:border-ink-500/40 disabled:opacity-35 disabled:shadow-none"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/**
 * Horizontal shelf of items with a heading, "See all" link, desktop arrows
 * and a swipe hint on phones. Renders nothing when there are no items.
 */
export function RailShell({
  chip,
  accent = DEFAULT_ACCENT,
  heading,
  sub,
  seeAllTo,
  headerAction,
  itemCount,
  children,
}: {
  chip?: string;
  accent?: string;
  heading: string;
  sub?: string | null;
  seeAllTo?: string;
  headerAction?: ReactNode;
  itemCount: number;
  children: ReactNode;
}) {
  const headingId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const edges = useScrollEdges(trackRef, itemCount);
  const seen = useSeenOnce(sectionRef, itemCount);

  if (itemCount === 0) return null;

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    el?.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section
      ref={sectionRef}
      aria-labelledby={headingId}
      data-inview={seen ? "" : undefined}
      className="mx-auto max-w-6xl px-4 py-5 sm:py-7"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        {chip ? <RailChip label={chip} accent={accent} /> : <span />}
        <div className="flex shrink-0 items-center gap-2">
          {headerAction}
          {(edges.start || edges.end) && (
            <div className="hidden items-center gap-1.5 sm:flex">
              <RailArrow
                dir={-1}
                disabled={!edges.start}
                label={heading}
                onClick={() => scrollBy(-1)}
              />
              <RailArrow
                dir={1}
                disabled={!edges.end}
                label={heading}
                onClick={() => scrollBy(1)}
              />
            </div>
          )}
          {seeAllTo && (
            <Link
              to={seeAllTo}
              className="group/see inline-flex items-center gap-1 rounded-full border py-1 pr-1 pl-2.5 text-xs font-semibold transition hover:shadow-sm"
              style={{ borderColor: `${accent}33`, color: accent }}
            >
              {HOME_COPY.tagSections.seeAll}
              <span
                aria-hidden="true"
                className="grid h-5 w-5 place-items-center rounded-full transition-transform group-hover/see:translate-x-0.5"
                style={{ backgroundColor: `${accent}1f` }}
              >
                <ChevronRight className="h-3 w-3" />
              </span>
            </Link>
          )}
        </div>
      </div>

      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2
            id={headingId}
            className="font-display text-xl leading-tight tracking-tight text-ink-900 sm:text-2xl"
          >
            {heading}
          </h2>
          {sub && <p className="mt-0.5 line-clamp-1 text-sm text-ink-500">{sub}</p>}
        </div>
        {edges.end && !edges.start && (
          <span
            aria-hidden
            className="flex shrink-0 items-center gap-0.5 text-[11px] font-medium sm:hidden"
            style={{ color: accent }}
          >
            {HOME_COPY.rails.swipeHint}
            <ChevronsRight className="swipe-hint-arrow h-3.5 w-3.5" />
          </span>
        )}
      </div>

      <div
        ref={trackRef}
        role="list"
        aria-labelledby={headingId}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] gap-3 overflow-x-auto px-4 pt-1 pb-3 [-ms-overflow-style:none] sm:mx-0 sm:scroll-px-0 sm:gap-4 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </section>
  );
}

export function SeeAllTile({ to, accent, label }: { to: string; accent: string; label: string }) {
  return (
    <Link
      to={to}
      className="group flex h-full min-h-48 flex-col items-center justify-center gap-2 rounded-card border border-dashed text-sm font-semibold transition hover:shadow-sm"
      style={{ borderColor: `${accent}55`, color: accent, backgroundColor: `${accent}0d` }}
    >
      <span
        className="grid h-10 w-10 place-items-center rounded-full transition-transform group-hover:translate-x-0.5"
        style={{ backgroundColor: `${accent}1f` }}
      >
        <ChevronRight className="h-5 w-5" />
      </span>
      {label}
    </Link>
  );
}

export function ProductRail({
  chip,
  accent = DEFAULT_ACCENT,
  heading,
  sub,
  seeAllTo,
  products,
  omitTagSlug,
}: {
  chip?: string;
  accent?: string;
  heading: string;
  sub?: string | null;
  seeAllTo?: string;
  products: ProductCard[];
  omitTagSlug?: string;
}) {
  return (
    <RailShell
      chip={chip}
      accent={accent}
      heading={heading}
      sub={sub}
      seeAllTo={seeAllTo}
      itemCount={products.length}
    >
      {products.map((product, index) => (
        <div
          key={product.id}
          role="listitem"
          className={cn(RAIL_ITEM_CLASS, "rail-rise")}
          style={{ "--i": index } as CSSProperties}
        >
          <CatalogProductCard product={product} omitTagSlug={omitTagSlug} className="h-full" />
        </div>
      ))}
      {seeAllTo && (
        <div
          role="listitem"
          className={cn(RAIL_ITEM_CLASS, "rail-rise pr-px")}
          style={{ "--i": products.length } as CSSProperties}
        >
          <SeeAllTile to={seeAllTo} accent={accent} label={HOME_COPY.rails.seeAllTile} />
        </div>
      )}
    </RailShell>
  );
}

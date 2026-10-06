import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { VegMark } from "@/components/product/VegMark";
import { RailShell } from "@/components/home/ProductRail";
import { HOME_COPY } from "@/content/home";
import { clearRecentProducts, readRecentProducts } from "@/lib/recentlyViewed";

const MIN_ITEMS = 2;

/** Products this browser opened recently. Shown once there are at least two. */
export function RecentlyViewedRail() {
  const [items, setItems] = useState(readRecentProducts);
  const copy = HOME_COPY.rails.recent;
  const visible = items.length >= MIN_ITEMS ? items : [];

  return (
    <RailShell
      chip={copy.chip}
      accent="#4B5563"
      heading={copy.heading}
      itemCount={visible.length}
      headerAction={
        <button
          type="button"
          onClick={() => {
            clearRecentProducts();
            setItems([]);
          }}
          className="rounded-full px-2 py-1 text-xs font-medium text-ink-500 transition hover:bg-cream-100 hover:text-ink-900"
        >
          {copy.clear}
        </button>
      }
    >
      {visible.map((item, index) => (
        <div
          key={item.slug}
          role="listitem"
          className="rail-rise w-28 shrink-0 snap-start sm:w-36"
          style={{ "--i": index } as CSSProperties}
        >
          <Link to={`/product/${item.slug}`} className="group block">
            <span className="relative block aspect-square overflow-hidden rounded-2xl border border-cream-200 bg-cream-100 shadow-sm">
              {item.image ? (
                <img
                  src={item.image}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <span className="flex h-full items-center justify-center text-[10px] text-ink-500">
                  No image
                </span>
              )}
              {item.isEggless && <VegMark className="absolute top-1.5 left-1.5" />}
            </span>
            <span className="mt-1.5 line-clamp-2 text-xs leading-snug font-medium text-ink-900 group-hover:text-brand-500">
              {item.name}
            </span>
            {item.category && (
              <span className="block truncate text-[10px] text-ink-500">{item.category}</span>
            )}
          </Link>
        </div>
      ))}
    </RailShell>
  );
}

import { Link } from "react-router-dom";
import { ChevronRight, Leaf, Truck, Zap, type LucideIcon } from "lucide-react";
import { HOME_COPY } from "@/content/home";
import { cn } from "@/lib/cn";

type TileKey = (typeof HOME_COPY.quickTiles.tiles)[number]["key"];

const LOOK: Record<TileKey, { icon: LucideIcon; tile: string; badge: string }> = {
  "same-day": {
    icon: Zap,
    tile: "from-brand-100/80 to-white border-brand-500/15",
    badge: "bg-brand-500 text-white",
  },
  healthy: {
    icon: Leaf,
    tile: "from-emerald-100/80 to-white border-emerald-600/15",
    badge: "bg-emerald-600 text-white",
  },
  "pan-india": {
    icon: Truck,
    tile: "from-amber-100/80 to-white border-amber-600/15",
    badge: "bg-amber-600 text-white",
  },
};

/** Shortcuts into the Same-day, Healthy treats and Pan-India collections. */
export function QuickTiles() {
  const copy = HOME_COPY.quickTiles;
  return (
    <section aria-label={copy.heading} className="mx-auto max-w-6xl px-4 py-4 sm:py-6">
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {copy.tiles.map((tile) => {
          const look = LOOK[tile.key];
          const Icon = look.icon;
          return (
            <Link
              key={tile.key}
              to={tile.to}
              className={cn(
                "group flex flex-col gap-2 rounded-2xl border bg-gradient-to-br p-3 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:gap-3 sm:p-4",
                look.tile,
              )}
            >
              <span
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-xl shadow-sm sm:h-11 sm:w-11",
                  look.badge,
                )}
              >
                <Icon className="tile-bounce h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs leading-tight font-semibold text-ink-900 sm:text-base">
                  {tile.title}
                </span>
                <span className="mt-0.5 hidden text-xs text-ink-500 sm:block">{tile.line}</span>
              </span>
              <ChevronRight
                aria-hidden
                className="hidden h-4 w-4 shrink-0 text-ink-500 transition-transform group-hover:translate-x-0.5 sm:block"
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

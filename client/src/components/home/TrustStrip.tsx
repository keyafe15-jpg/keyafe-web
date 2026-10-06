import type { CSSProperties } from "react";
import { ChefHat, Leaf, PackageCheck, type LucideIcon } from "lucide-react";
import { HOME_COPY } from "@/content/home";

type TrustKey = (typeof HOME_COPY.trust)[number]["key"];

const ICONS: Record<TrustKey, LucideIcon> = {
  batch: ChefHat,
  pure: Leaf,
  packed: PackageCheck,
};

/** One-line brand promises, replacing the old "Why Keyafe" cards. */
export function TrustStrip() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-4 py-4">
      <ul className="grid grid-cols-3 gap-2 rounded-2xl border border-cream-200 bg-white/60 px-3 py-3 backdrop-blur-md sm:px-6">
        {HOME_COPY.trust.map(({ key, label }, index) => {
          const Icon = ICONS[key];
          return (
            <li
              key={key}
              className="flex flex-col items-center gap-1.5 text-center text-[11px] font-medium text-ink-700 sm:flex-row sm:justify-center sm:gap-2 sm:text-sm"
            >
              <span
                className="soft-bob flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-500"
                style={{ "--i": index } as CSSProperties}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              {label}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

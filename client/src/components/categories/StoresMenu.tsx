import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/cn";
import { HOME_COPY } from "@/content/home";
import { storePath, useDepartments } from "@/hooks/useCategories";

export function StoresMenu() {
  const { data: stores = [] } = useDepartments();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const onStorePage = pathname.startsWith("/store/");

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  if (stores.length === 0) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition",
          open || onStorePage ? "bg-cream-100 text-ink-900" : "text-ink-700 hover:bg-cream-100",
        )}
      >
        Stores
        <svg
          width={12}
          height={12}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn("transition-transform", open && "rotate-180")}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div
        role="menu"
        className={cn(
          "absolute top-full left-0 z-40 mt-2 w-72 origin-top-left rounded-xl border border-cream-200 bg-white p-2 shadow-lg transition",
          open
            ? "pointer-events-auto scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0",
        )}
      >
        {stores.map((store) => {
          const line =
            store.slug in HOME_COPY.storeDoors.bySlug
              ? HOME_COPY.storeDoors.bySlug[store.slug as keyof typeof HOME_COPY.storeDoors.bySlug]
              : null;
          const active = pathname === storePath(store.slug);
          return (
            <Link
              key={store.id}
              to={storePath(store.slug)}
              onClick={() => setOpen(false)}
              role="menuitem"
              className={cn(
                "flex items-start gap-3 rounded-lg px-3 py-2 transition hover:bg-cream-100",
                active && "bg-cream-50",
              )}
            >
              <span
                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: store.accentHex }}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink-900">{store.name} store</span>
                {line && <span className="block text-xs text-ink-500">{line}</span>}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

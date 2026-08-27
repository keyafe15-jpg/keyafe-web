import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";
import { useCategories, type CategoryNode } from "@/hooks/useCategories";

export function CategoriesMenu() {
  const { data: categories = [], isLoading } = useCategories();
  const [open, setOpen] = useState(false);
  const [hoveredParent, setHoveredParent] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setHoveredParent(null);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setHoveredParent(null);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const closeAll = () => {
    setOpen(false);
    setHoveredParent(null);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition",
          open
            ? "bg-cream-100 text-ink-900"
            : "text-ink-700 hover:bg-cream-100",
        )}
      >
        Categories
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
          "absolute left-0 top-full z-40 mt-2 min-w-[240px] origin-top-left rounded-xl border border-cream-200 bg-white p-2 shadow-lg transition",
          open
            ? "pointer-events-auto scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0",
        )}
        onMouseLeave={() => setHoveredParent(null)}
      >
        {isLoading && (
          <p className="px-3 py-2 text-xs text-ink-500">Loading…</p>
        )}
        {!isLoading && categories.length === 0 && (
          <p className="px-3 py-2 text-xs text-ink-500">No categories yet.</p>
        )}
        {categories.map((cat) => (
          <CategoryRow
            key={cat.id}
            category={cat}
            isSubOpen={hoveredParent === cat.id}
            onHover={() => setHoveredParent(cat.id)}
            onNavigate={closeAll}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  isSubOpen,
  onHover,
  onNavigate,
}: {
  category: CategoryNode;
  isSubOpen: boolean;
  onHover: () => void;
  onNavigate: () => void;
}) {
  const hasChildren = category.children.length > 0;
  return (
    <div className="relative" onMouseEnter={onHover}>
      <Link
        to={`/category/${category.slug}`}
        onClick={onNavigate}
        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-ink-700 transition hover:bg-cream-100 hover:text-brand-500"
        role="menuitem"
      >
        <span>{category.name}</span>
        {hasChildren && (
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
      </Link>

      {hasChildren && isSubOpen && (
        <div
          role="menu"
          className="absolute left-full top-0 z-40 ml-1 min-w-[220px] rounded-xl border border-cream-200 bg-white p-2 shadow-lg"
        >
          {category.children.map((child) => (
            <Link
              key={child.id}
              to={`/category/${child.slug}`}
              onClick={onNavigate}
              className="block rounded-lg px-3 py-2 text-sm text-ink-700 transition hover:bg-cream-100 hover:text-brand-500"
              role="menuitem"
            >
              {child.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

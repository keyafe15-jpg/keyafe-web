import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;

type CatalogSearchBarProps = {
  className?: string;
  placeholder?: string;
  /**
   * `bar` — always-visible input (catalog pages, home, mobile drawer).
   * `icon` — compact header control: icon expands into an input.
   */
  variant?: "bar" | "icon";
  /** Glass styling for the header over the home hero. */
  overlay?: boolean;
  /** Called after navigating to /search (e.g. close the mobile drawer). */
  onNavigate?: () => void;
};

/**
 * Shared product search — debounces into /search?q=….
 * Used on catalog pages, home, and the site header.
 */
export function CatalogSearchBar({
  className,
  placeholder = "Search cakes, cookies, pizzas…",
  variant = "bar",
  overlay = false,
  onNavigate,
}: CatalogSearchBarProps) {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(variant === "bar");
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  useEffect(() => {
    if (variant === "icon" && open) inputRef.current?.focus();
  }, [open, variant]);

  useEffect(() => {
    const q = value.trim();
    if (q.length < MIN_QUERY) return;

    const timer = window.setTimeout(() => {
      navigate(`/search?q=${encodeURIComponent(q)}`);
      setValue("");
      if (variant === "icon") setOpen(false);
      onNavigateRef.current?.();
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [value, navigate, variant]);

  function goNow() {
    const q = value.trim();
    if (q.length < MIN_QUERY) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
    setValue("");
    if (variant === "icon") setOpen(false);
    onNavigateRef.current?.();
  }

  function closeIcon() {
    setOpen(false);
    setValue("");
  }

  if (variant === "icon" && !open) {
    return (
      <button
        type="button"
        aria-label="Search products"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition",
          overlay
            ? "text-ink-800 border border-white/50 bg-white/40 backdrop-blur-md hover:bg-white/60"
            : "border border-[#e7d6b4] bg-white text-ink-700 shadow-sm hover:bg-cream-50",
          className,
        )}
      >
        <Search className="h-4 w-4" />
      </button>
    );
  }

  if (variant === "icon") {
    return (
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          goNow();
        }}
        className={cn(
          "flex h-10 items-center gap-1 rounded-full border bg-white pr-1 pl-3 shadow-sm",
          overlay ? "border-white/60" : "border-[#e7d6b4]",
          className,
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-ink-500" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeIcon();
          }}
          placeholder="Search…"
          aria-label="Search products"
          className="w-28 min-w-0 bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-500 sm:w-40"
        />
        <button
          type="button"
          onClick={closeIcon}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-cream-100 hover:text-ink-700"
          aria-label="Close search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </form>
    );
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        goNow();
      }}
      className={cn(
        "flex items-center gap-2 rounded-full border border-cream-200 bg-white px-3 py-2 shadow-sm",
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-ink-500" aria-hidden="true" />
      <label className="sr-only" htmlFor={inputId}>
        Search products
      </label>
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-500"
      />
    </form>
  );
}

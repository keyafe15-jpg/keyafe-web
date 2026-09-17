import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Compact header search: icon expands into an input; Enter navigates to
 * /search?q=…. Used in the sticky bar (desktop + mobile) so search is
 * available from every page without crowding the FeaturePill row.
 */
export function HeaderSearch({
  overlay = false,
  onNavigate,
  className,
}: {
  overlay?: boolean;
  /** Called after a successful navigate (e.g. close the mobile drawer). */
  onNavigate?: () => void;
  className?: string;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function submit() {
    const q = value.trim();
    if (q.length < 2) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
    setValue("");
    setOpen(false);
    onNavigate?.();
  }

  function close() {
    setOpen(false);
    setValue("");
  }

  const iconButton = cn(
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition",
    overlay
      ? "text-ink-800 border border-white/50 bg-white/40 backdrop-blur-md hover:bg-white/60"
      : "border border-[#e7d6b4] bg-white text-ink-700 shadow-sm hover:bg-cream-50",
  );

  if (!open) {
    return (
      <button
        type="button"
        aria-label="Search products"
        onClick={() => setOpen(true)}
        className={cn(iconButton, className)}
      >
        <Search className="h-4 w-4" />
      </button>
    );
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
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
          if (e.key === "Escape") close();
        }}
        placeholder="Search…"
        aria-label="Search products"
        className="w-28 min-w-0 bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-500 sm:w-40"
      />
      <button
        type="button"
        onClick={close}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-cream-100 hover:text-ink-700"
        aria-label="Close search"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}

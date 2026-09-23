import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { inputClass } from "@/components/form/Field";

export const SEARCH_DEBOUNCE_MS = 300;

type DebouncedSearchInputProps = {
  /** Called with the trimmed query after debounce (or immediately on clear). */
  onDebouncedChange: (query: string) => void;
  placeholder?: string;
  /** Debounce delay in ms. Default 300. Use 0 for instant (local filters). */
  delayMs?: number;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  /** Optional initial value (uncontrolled after mount). */
  defaultValue?: string;
};

/**
 * Shared list-page search: icon, clear button, and debounced `onDebouncedChange`.
 * Keep search on the page that owns the list — not in the top bar — so filters
 * stay in context (scope tabs, date ranges, etc.).
 */
export function DebouncedSearchInput({
  onDebouncedChange,
  placeholder = "Search…",
  delayMs = SEARCH_DEBOUNCE_MS,
  className,
  inputClassName,
  autoFocus,
  defaultValue = "",
}: DebouncedSearchInputProps) {
  const [value, setValue] = useState(defaultValue);
  const onChangeRef = useRef(onDebouncedChange);
  onChangeRef.current = onDebouncedChange;

  useEffect(() => {
    const trimmed = value.trim();
    // Clear should feel instant so empty results don't lag behind.
    const wait = trimmed.length === 0 ? 0 : delayMs;
    const timer = window.setTimeout(() => {
      onChangeRef.current(trimmed);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return (
    <div className={cn("relative w-full min-w-[14rem]", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(inputClass, "pr-9 pl-9", inputClassName)}
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => setValue("")}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

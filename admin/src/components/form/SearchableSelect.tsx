import { useEffect, useId, useMemo, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { inputClass } from "@/components/form/Field";

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Extra text included in search (e.g. price). */
  keywords?: string;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "— Choose —",
  searchPlaceholder = "Search…",
  emptyMessage = "No matches",
  disabled = false,
  allowEmpty = true,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  allowEmpty?: boolean;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = normalize(query);
    return options.filter((o) => matches(o, q));
  }, [options, query]);

  const rows = useMemo(() => {
    if (!allowEmpty) return filtered;
    if (query.trim()) return filtered;
    return [{ value: "", label: placeholder }, ...filtered];
  }, [allowEmpty, filtered, placeholder, query]);

  useEffect(() => {
    if (!open) return;
    const idx = rows.findIndex((r) => r.value === value);
    setHighlighted(idx >= 0 ? idx : 0);
  }, [open, query, rows, value]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[highlighted]?.scrollIntoView({ block: "nearest" });
  }, [highlighted, open]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const move = (delta: number) => {
    if (rows.length === 0) return;
    setHighlighted((i) => (i + delta + rows.length) % rows.length);
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setQuery("");
      }}
    >
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          disabled={disabled}
          className={cn(
            inputClass,
            "flex items-center justify-between gap-2 text-left",
            !selected && "text-slate-400",
            disabled && "cursor-not-allowed bg-slate-100 text-slate-500",
          )}
        >
          <span className="min-w-0 truncate">
            {selected?.label ?? placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[16rem] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          <div className="relative border-b border-slate-100">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              aria-autocomplete="list"
              aria-controls={listId}
              aria-activedescendant={
                rows[highlighted]
                  ? `${listId}-opt-${highlighted}`
                  : undefined
              }
              className="w-full border-0 bg-transparent py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  move(1);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  move(-1);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const row = rows[highlighted];
                  if (row) pick(row.value);
                } else if (e.key === "Home") {
                  e.preventDefault();
                  setHighlighted(0);
                } else if (e.key === "End") {
                  e.preventDefault();
                  setHighlighted(Math.max(0, rows.length - 1));
                }
              }}
            />
          </div>
          <div
            id={listId}
            role="listbox"
            className="max-h-64 overflow-y-auto py-1"
          >
            {rows.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-slate-500">
                {emptyMessage}
              </p>
            ) : (
              rows.map((row, idx) => {
                const active = row.value === value && row.value !== "";
                const hi = idx === highlighted;
                return (
                  <button
                    key={`${row.value || "empty"}-${idx}`}
                    id={`${listId}-opt-${idx}`}
                    ref={(el) => {
                      itemRefs.current[idx] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setHighlighted(idx)}
                    onClick={() => pick(row.value)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                      hi ? "bg-brand-50 text-brand-800" : "text-slate-800",
                    )}
                  >
                    <Check
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        active ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="min-w-0 truncate">{row.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
}

function matches(opt: SearchableSelectOption, q: string) {
  if (!q) return true;
  const hay = normalize(`${opt.label} ${opt.keywords ?? ""}`);
  return q.split(/\s+/).every((part) => hay.includes(part));
}

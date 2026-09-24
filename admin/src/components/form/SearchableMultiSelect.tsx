import { useMemo, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { inputClass } from "@/components/form/Field";

export type SearchableMultiSelectItem = {
  value: string;
  label: string;
  /** Extra text included in search (e.g. price). */
  keywords?: string;
  imageUrl?: string | null;
};

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
}

function matches(item: SearchableMultiSelectItem, q: string) {
  if (!q) return true;
  const hay = normalize(`${item.label} ${item.keywords ?? ""}`);
  return q.split(/\s+/).every((part) => hay.includes(part));
}

/**
 * Compact searchable multi-select dropdown.
 * Optional `allowSelectAll` / `allowClearAll` for bulk selection controls.
 */
export function SearchableMultiSelect({
  items,
  selected,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyMessage = "No matches",
  allowSelectAll = false,
  allowClearAll = false,
  className,
  triggerClassName,
}: {
  items: SearchableMultiSelectItem[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  allowSelectAll?: boolean;
  allowClearAll?: boolean;
  className?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const labelByValue = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) map.set(item.value, item.label);
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    return items.filter((item) => matches(item, q));
  }, [items, query]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((item) => selectedSet.has(item.value));

  const toggle = (value: string) => {
    onChange(
      selectedSet.has(value) ? selected.filter((id) => id !== value) : [...selected, value],
    );
  };

  const selectAllFiltered = () => {
    const next = new Set(selected);
    for (const item of filtered) next.add(item.value);
    onChange([...next]);
  };

  const clearAll = () => {
    if (query.trim()) {
      const drop = new Set(filtered.map((i) => i.value));
      onChange(selected.filter((id) => !drop.has(id)));
    } else {
      onChange([]);
    }
  };

  const remove = (value: string) => {
    onChange(selected.filter((id) => id !== value));
  };

  const summary =
    selected.length === 0
      ? null
      : selected.length === 1
        ? (labelByValue.get(selected[0]!) ?? "1 selected")
        : `${selected.length} selected`;

  if (items.length === 0) {
    return <p className="text-xs text-slate-500">Nothing to choose yet.</p>;
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            className={cn(
              inputClass,
              "flex min-h-[2.5rem] items-center justify-between gap-2 py-1.5 text-left text-sm",
              !summary && "text-slate-400",
              triggerClassName,
            )}
          >
            <span className="min-w-0 truncate">{summary ?? placeholder}</span>
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
            className="z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
          >
            <div className="relative border-b border-slate-100">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full border-0 bg-transparent py-2.5 pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            {(allowSelectAll || allowClearAll) && (
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-1.5">
                <span className="text-[11px] text-slate-500">
                  {filtered.length === items.length
                    ? `${items.length} options`
                    : `${filtered.length} of ${items.length}`}
                </span>
                <div className="flex items-center gap-2">
                  {allowSelectAll && (
                    <button
                      type="button"
                      disabled={allFilteredSelected || filtered.length === 0}
                      onClick={selectAllFiltered}
                      className="text-[11px] font-medium text-brand-700 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Select all{query.trim() ? " matches" : ""}
                    </button>
                  )}
                  {allowClearAll && (
                    <button
                      type="button"
                      disabled={selected.length === 0}
                      onClick={clearAll}
                      className="text-[11px] font-medium text-slate-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Clear{query.trim() ? " matches" : " all"}
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="max-h-64 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-slate-500">{emptyMessage}</p>
              ) : (
                filtered.map((item) => {
                  const checked = selectedSet.has(item.value);
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => toggle(item.value)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50",
                        checked && "bg-brand-50/70",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          checked
                            ? "border-brand-500 bg-brand-500 text-white"
                            : "border-slate-300 bg-white",
                        )}
                      >
                        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="h-5 w-5 shrink-0 rounded-full object-cover"
                        />
                      )}
                      <span className="min-w-0 truncate text-slate-800">{item.label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((id) => (
            <span
              key={id}
              className="inline-flex max-w-full items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-800 ring-1 ring-brand-200"
            >
              <span className="truncate">{labelByValue.get(id) ?? id}</span>
              <button
                type="button"
                onClick={() => remove(id)}
                className="shrink-0 rounded p-0.5 text-brand-600 hover:bg-brand-100"
                aria-label={`Remove ${labelByValue.get(id) ?? "item"}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

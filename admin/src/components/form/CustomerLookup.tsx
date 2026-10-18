import { useEffect, useId, useRef, useState } from "react";
import { useOrderCustomerLookup, type OrderCustomerLookupHit } from "@/hooks/useAdminCustomers";
import { inputClass } from "@/components/form/Field";
import { cn } from "@/lib/cn";

/**
 * Same look as a normal text field, with a match list while staff type a
 * name or phone. Picking a row fills the rest of the form; the input stays
 * editable afterwards.
 */
export function CustomerLookupField({
  value,
  onChange,
  onSelect,
  placeholder,
  type = "text",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (hit: OrderCustomerLookupHit) => void;
  placeholder?: string;
  type?: "text" | "tel";
  className?: string;
}) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState(value);
  const [highlighted, setHighlighted] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), 220);
    return () => window.clearTimeout(t);
  }, [value]);

  const { data: hits = [], isFetching } = useOrderCustomerLookup(debounced);

  useEffect(() => {
    setHighlighted(0);
  }, [hits]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (hit: OrderCustomerLookupHit) => {
    onSelect(hit);
    setOpen(false);
  };

  const showList = open && (hits.length > 0 || isFetching);

  return (
    <div ref={wrapRef} className="relative">
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        className={cn(inputClass, className)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showList || hits.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlighted((i) => (i + 1) % hits.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlighted((i) => (i - 1 + hits.length) % hits.length);
          } else if (e.key === "Enter") {
            const hit = hits[highlighted];
            if (hit) {
              e.preventDefault();
              pick(hit);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {hits.length === 0 ? (
            <li className="px-3 py-2 text-xs text-slate-400">Looking up…</li>
          ) : (
            hits.map((hit, idx) => (
              <li key={hit.id} role="option" aria-selected={idx === highlighted}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlighted(idx)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(hit)}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm",
                    idx === highlighted ? "bg-brand-50 text-brand-800" : "text-slate-800",
                  )}
                >
                  <span className="truncate font-medium">
                    {hit.name} · {hit.phone}
                  </span>
                  {hit.gstin && (
                    <span className="font-mono text-[11px] text-slate-500">GSTIN {hit.gstin}</span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

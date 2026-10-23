import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { inputClass } from "@/components/form/Field";

export function SearchCreate({
  query,
  onQuery,
  options,
  placeholder,
  createLabel,
  onSelect,
  onCreate,
}: {
  query: string;
  onQuery: (q: string) => void;
  options: { id: string; label: string; hint?: string }[];
  placeholder: string;
  createLabel?: string | null;
  onSelect: (id: string) => void;
  onCreate?: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const showCreate = Boolean(createLabel && query.trim() && onCreate);

  return (
    <div ref={box} className="relative">
      <input
        value={query}
        onChange={(e) => {
          onQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={inputClass}
      />
      {open && (options.length > 0 || showCreate) && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {options.map((opt) => (
            <li key={opt.id}>
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col items-start px-3 py-1.5 text-left text-sm hover:bg-slate-50",
                )}
                onClick={() => {
                  onSelect(opt.id);
                  setOpen(false);
                }}
              >
                <span className="text-slate-900">{opt.label}</span>
                {opt.hint && <span className="text-[11px] text-slate-500">{opt.hint}</span>}
              </button>
            </li>
          ))}
          {showCreate && (
            <li>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-sm font-medium text-brand-700 hover:bg-brand-50"
                onClick={() => {
                  onCreate?.(query.trim());
                  setOpen(false);
                }}
              >
                {createLabel}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

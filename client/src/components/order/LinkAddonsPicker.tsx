import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import type { PublicAddon } from "@/hooks/useAddons";

export function LinkAddonsPicker({
  addons,
  selected,
  onToggle,
}: {
  addons: PublicAddon[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const groups = useMemo(() => {
    const map = new Map<string, PublicAddon[]>();
    for (const addon of addons) {
      const key = addon.group?.trim() || "Add-ons";
      const list = map.get(key) ?? [];
      list.push(addon);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [addons]);

  const [open, setOpen] = useState(selected.length > 0);
  const picked = addons.filter((a) => selectedSet.has(a.id));
  const pickedTotal = picked.reduce((s, a) => s + Number(a.priceDelta), 0);
  const summary =
    picked.length === 0
      ? `${addons.length} optional extra${addons.length === 1 ? "" : "s"}`
      : `${picked.length} added${pickedTotal > 0 ? ` · +₹${pickedTotal.toFixed(0)}` : ""}`;

  if (addons.length === 0) return null;

  return (
    <div className="mt-2 rounded-xl border border-cream-200 bg-cream-100/70">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-ink-900">Extras</span>
          <span
            className={cn(
              "mt-0.5 block truncate text-[11px]",
              picked.length > 0 ? "font-medium text-brand-700" : "text-ink-500",
            )}
          >
            {summary}
          </span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-ink-500 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="flex flex-wrap gap-1.5 border-t border-cream-200 px-3 py-2">
          {groups.flatMap(([, items]) =>
            items.map((addon) => {
              const on = selectedSet.has(addon.id);
              const delta = Number(addon.priceDelta);
              return (
                <button
                  key={addon.id}
                  type="button"
                  onClick={() => onToggle(addon.id)}
                  aria-pressed={on}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                    on
                      ? "border-brand-500 bg-brand-100 text-brand-700"
                      : "border-cream-200 bg-white text-ink-700 hover:border-brand-300",
                  )}
                >
                  {addon.name}
                  {delta > 0 ? ` · +₹${delta.toFixed(0)}` : ""}
                </button>
              );
            }),
          )}
        </div>
      )}
    </div>
  );
}

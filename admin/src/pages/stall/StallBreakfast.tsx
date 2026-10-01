import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  type StallBreakfastEntry,
  type StallBreakfastInput,
  type StallMenuItem,
} from "@/hooks/useStalls";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/cn";

const fieldClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none";

const labelClass = "mb-1 block text-xs font-medium tracking-wide text-slate-500 uppercase";

/** Adds or removes one name in a comma-separated plate list. */
function toggleItem(items: string, name: string) {
  const list = items
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const has = list.some((s) => s.toLowerCase() === name.toLowerCase());
  return (has ? list.filter((s) => s.toLowerCase() !== name.toLowerCase()) : [...list, name]).join(
    ", ",
  );
}

const MENU_SEARCH_AT = 12;

function ItemChips({
  names,
  items,
  onToggle,
  className,
}: {
  names: string[];
  items: string;
  onToggle: (name: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {names.map((name) => {
        const on = items.split(",").some((s) => s.trim().toLowerCase() === name.toLowerCase());
        return (
          <button
            key={name}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(name)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition",
              on
                ? "bg-brand-50 border-brand-500 text-brand-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            )}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}

export function breakfastLine(e: Pick<StallBreakfastEntry, "plates" | "platePrice">) {
  return `${e.plates} plate${e.plates === 1 ? "" : "s"} × ${formatINR(e.platePrice)}`;
}

/** Plates, the round per-plate price, and what was on the plate. */
export function BreakfastForm({
  initial,
  menu = [],
  itemNames = [],
  withDate,
  maxDate,
  saving,
  submitLabel = "Add breakfast",
  onSubmit,
}: {
  initial?: Partial<StallBreakfastInput> | null;
  /** The stall's menu, offered as quick picks for what was on the plate. */
  menu?: StallMenuItem[];
  /** Names typed into earlier breakfasts. */
  itemNames?: string[];
  withDate?: boolean;
  maxDate?: string;
  saving: boolean;
  submitLabel?: string;
  onSubmit: (input: StallBreakfastInput) => Promise<void>;
}) {
  const [date, setDate] = useState(initial?.date ?? maxDate ?? "");
  const [plates, setPlates] = useState(String(initial?.plates ?? 1));
  const [price, setPrice] = useState(initial?.platePrice ? String(initial.platePrice) : "");
  const [items, setItems] = useState(initial?.items ?? "");
  const [touched, setTouched] = useState(false);

  // The last entry can arrive after mount; prefill until the user types.
  useEffect(() => {
    if (touched || !initial) return;
    if (initial.plates) setPlates(String(initial.plates));
    if (initial.platePrice) setPrice(String(initial.platePrice));
    if (initial.items) setItems(initial.items);
  }, [initial, touched]);

  const [menuSearch, setMenuSearch] = useState("");
  const needle = menuSearch.trim().toLowerCase();
  const menuNames = menu
    .filter((m) => m.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((m) => m.name);
  const onMenu = new Set(menuNames.map((n) => n.toLowerCase()));
  const usedBefore = itemNames.filter((n) => !onMenu.has(n.toLowerCase()));

  const plateCount = Math.max(Math.floor(Number(plates) || 0), 0);
  const platePrice = Math.max(Number(price) || 0, 0);
  const total = plateCount * platePrice;
  const ready =
    plateCount >= 1 && platePrice >= 1 && items.trim() !== "" && (!withDate || date !== "");

  const edit =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      setTouched(true);
      set(v);
    };

  const submit = async () => {
    try {
      await onSubmit({
        ...(withDate ? { date } : {}),
        plates: plateCount,
        platePrice,
        items: items.trim(),
      });
    } catch {
      return; // caller shows the error; keep the figures so they can retry
    }
    setTouched(false);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready && !saving) void submit();
      }}
      className="space-y-3"
    >
      <div className={cn("grid gap-2 sm:gap-3", withDate ? "grid-cols-3" : "grid-cols-2")}>
        {withDate && (
          <label className="block">
            <span className={labelClass}>Date</span>
            <input
              type="date"
              value={date}
              max={maxDate}
              onChange={(e) => edit(setDate)(e.target.value)}
              className={fieldClass}
            />
          </label>
        )}
        <label className="block">
          <span className={labelClass}>Plates</span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              aria-label="One plate fewer"
              onClick={() => edit(setPlates)(String(Math.max(plateCount - 1, 1)))}
              className="rounded-lg border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={200}
              value={plates}
              onChange={(e) => edit(setPlates)(e.target.value)}
              aria-label="Plates"
              className={cn(fieldClass, "text-center tabular-nums")}
            />
            <button
              type="button"
              aria-label="One plate more"
              onClick={() => edit(setPlates)(String(plateCount + 1))}
              className="rounded-lg border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
            </button>
          </span>
        </label>
        <label className="block">
          <span className={labelClass}>Per plate</span>
          <span className="relative block">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400">
              ₹
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              step="any"
              value={price}
              onChange={(e) => edit(setPrice)(e.target.value)}
              placeholder="85"
              aria-label="Price per plate"
              className={cn(fieldClass, "pl-7 tabular-nums")}
            />
          </span>
        </label>
      </div>
      <label className="block">
        <span className={labelClass}>On the plate</span>
        <input
          value={items}
          onChange={(e) => edit(setItems)(e.target.value)}
          maxLength={300}
          placeholder="Poha, boiled egg, toast, tea"
          className={fieldClass}
        />
      </label>
      {menuNames.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className={cn(labelClass, "mb-0")}>From the menu</span>
            {menuNames.length > MENU_SEARCH_AT && (
              <input
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                placeholder="Find an item"
                aria-label="Find a menu item"
                className="ml-auto w-36 rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
              />
            )}
          </div>
          <ItemChips
            names={menuNames.filter((n) => !needle || n.toLowerCase().includes(needle))}
            items={items}
            onToggle={(name) => edit(setItems)(toggleItem(items, name))}
            className="max-h-36 overflow-y-auto"
          />
        </div>
      )}
      {usedBefore.length > 0 && (
        <div>
          {menuNames.length > 0 && <span className={labelClass}>Used before</span>}
          <ItemChips
            names={usedBefore}
            items={items}
            onToggle={(name) => edit(setItems)(toggleItem(items, name))}
          />
        </div>
      )}
      <button
        type="submit"
        disabled={!ready || saving}
        className="w-full rounded-xl bg-brand-500 px-4 py-3 text-base font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : total > 0 ? `${submitLabel} · ${formatINR(total)}` : submitLabel}
      </button>
    </form>
  );
}

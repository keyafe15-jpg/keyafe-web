import type { AdminAddon } from "@/hooks/useAddons";
import { cn } from "@/lib/cn";

/** Add-on chips bucketed by their free-text group (Candles, Toppers…). */
export function AddonGroupPicker({
  addons,
  selected,
  onToggle,
}: {
  addons: AdminAddon[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const groups = new Map<string, AdminAddon[]>();
  for (const addon of addons) {
    const key = addon.group?.trim() || "Add-ons";
    const list = groups.get(key) ?? [];
    list.push(addon);
    groups.set(key, list);
  }

  return (
    <div className="space-y-3">
      {[...groups.entries()].map(([group, items]) => (
        <div key={group}>
          <p className="mb-1.5 text-xs font-medium tracking-wide text-slate-500 uppercase">
            {group}{" "}
            <span className="font-normal tracking-normal text-slate-400 normal-case">
              (optional)
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {items.map((addon) => {
              const on = selected.includes(addon.id);
              const delta = Number(addon.priceDelta);
              return (
                <button
                  key={addon.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggle(addon.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border py-1 text-xs font-medium transition",
                    addon.imageUrl ? "pr-2.5 pl-1" : "px-2.5",
                    on
                      ? "border-brand-500 bg-brand-100 text-brand-700"
                      : "hover:border-brand-300 border-slate-200 bg-white text-slate-600",
                  )}
                >
                  {addon.imageUrl && (
                    <img
                      src={addon.imageUrl}
                      alt=""
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  )}
                  {addon.name}
                  {delta > 0 && <span className="text-slate-500">+₹{delta.toFixed(0)}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

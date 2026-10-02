import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { AdminAddon } from "@/hooks/useAddons";
import { cn } from "@/lib/cn";

function groupAddons(addons: AdminAddon[]): [string, AdminAddon[]][] {
  const groups = new Map<string, AdminAddon[]>();
  for (const addon of addons) {
    const key = addon.group?.trim() || "Add-ons";
    const list = groups.get(key) ?? [];
    list.push(addon);
    groups.set(key, list);
  }
  return [...groups.entries()];
}

function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      inert={!open}
      className={cn(
        "grid transition-[grid-template-rows] duration-200",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

/** Add-on chips bucketed by their free-text group (Candles, Toppers…), each group foldable. */
export function AddonGroupPicker({
  addons,
  selected,
  onToggle,
}: {
  addons: AdminAddon[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const groups = groupAddons(addons);
  // Start with groups that already have picks open, or the only group there is.
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () =>
      new Set(
        groups
          .filter(([, items]) => groups.length === 1 || items.some((a) => selected.includes(a.id)))
          .map(([group]) => group),
      ),
  );
  const toggleGroup = (group: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (!next.delete(group)) next.add(group);
      return next;
    });

  return (
    <div className="divide-y divide-slate-200/80">
      {groups.map(([group, items]) => {
        const open = openGroups.has(group);
        const picked = items.filter((a) => selected.includes(a.id)).length;
        return (
          <div key={group}>
            <button
              type="button"
              onClick={() => toggleGroup(group)}
              aria-expanded={open}
              className="flex w-full items-center gap-2 py-2 text-left"
            >
              <span className="min-w-0 flex-1 truncate text-xs font-medium tracking-wide text-slate-600 uppercase">
                {group}
              </span>
              <span
                className={cn(
                  "shrink-0 text-[11px]",
                  picked > 0 ? "font-medium text-brand-700" : "text-slate-400",
                )}
              >
                {picked > 0 ? `${picked} added` : items.length}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-slate-400 transition-transform",
                  open && "rotate-180",
                )}
              />
            </button>
            <Collapse open={open}>
              <div className="flex flex-wrap gap-1.5 pb-2.5">
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
            </Collapse>
          </div>
        );
      })}
    </div>
  );
}

/** The add-ons picker in its own tinted box that folds away, showing what's picked. */
export function AddonsPanel({
  addons,
  selected,
  onToggle,
  hint,
}: {
  addons: AdminAddon[];
  selected: string[];
  onToggle: (id: string) => void;
  hint?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const picked = addons.filter((a) => selected.includes(a.id));
  const pickedTotal = picked.reduce((s, a) => s + Number(a.priceDelta), 0);
  const summary =
    picked.length === 0
      ? `${addons.length} optional`
      : `${picked.length} added${pickedTotal > 0 ? ` · +₹${pickedTotal.toFixed(0)}` : ""}`;

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/70">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className="text-xs font-semibold text-slate-800">Add-ons</span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[11px]",
            picked.length > 0 ? "font-medium text-brand-700" : "text-slate-500",
          )}
        >
          {summary}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-500 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      <Collapse open={open}>
        <div className="border-t border-violet-200 px-3 pt-1">
          {hint && <p className="pt-1.5 text-[11px] text-slate-500">{hint}</p>}
          <AddonGroupPicker addons={addons} selected={selected} onToggle={onToggle} />
        </div>
      </Collapse>
    </div>
  );
}

import { useState } from "react";
import { Check, ChevronDown, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  useDeleteFlavourGroup,
  useUpdateFlavourGroup,
  type AdminFlavour,
  type FlavourGroup,
} from "@/hooks/useFlavours";
import {
  ReorderHandle,
  ReorderList,
  type ReorderItemContext,
} from "@/components/reorder/ReorderList";
import { cn } from "@/lib/cn";
import { AddFlavourRow, FlavourRow, flavourInputClass } from "./FlavourRow";

const PREVIEW_COUNT = 4;

export function FlavourGroupCard({
  group,
  flavours,
  groups,
  endSortOrder,
  reorder,
  onReorderFlavours,
  reorderDisabled,
  collapsed,
  onToggleCollapsed,
}: {
  /** `null` = the Ungrouped card. */
  group: FlavourGroup | null;
  flavours: AdminFlavour[];
  groups: FlavourGroup[];
  endSortOrder: number;
  reorder?: ReorderItemContext;
  onReorderFlavours: (next: AdminFlavour[]) => void;
  reorderDisabled: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const updateGroup = useUpdateFlavourGroup();
  const deleteGroup = useDeleteFlavourGroup();
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(group?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const preview =
    flavours
      .slice(0, PREVIEW_COUNT)
      .map((f) => f.name)
      .join(", ") + (flavours.length > PREVIEW_COUNT ? ` +${flavours.length - PREVIEW_COUNT}` : "");

  const saveName = async () => {
    if (!group) return;
    const next = name.trim();
    if (!next) return setError("Group name is required");
    if (next === group.name) return setRenaming(false);
    setError(null);
    try {
      await updateGroup.mutateAsync({ id: group.id, name: next });
      setRenaming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename");
    }
  };

  const onDelete = async () => {
    if (!group) return;
    const note =
      flavours.length > 0
        ? `\n\nIts ${flavours.length} flavour${flavours.length === 1 ? "" : "s"} will move to Ungrouped.`
        : "";
    if (!confirm(`Delete group “${group.name}”?${note}`)) return;
    setError(null);
    try {
      await deleteGroup.mutateAsync(group.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <section
      ref={reorder?.setNodeRef}
      style={reorder?.style}
      className={cn(
        "overflow-hidden rounded-card border border-slate-200 bg-white",
        reorder?.isDragging && "shadow-lg",
      )}
    >
      <header
        className={cn(
          "flex items-center gap-2 bg-slate-50/70 px-2 py-2 md:px-3",
          !collapsed && "border-b border-slate-200",
        )}
      >
        {reorder ? (
          <ReorderHandle {...reorder.handleProps} aria-label="Drag to reorder group" />
        ) : (
          <span className="w-1" />
        )}
        {renaming && group ? (
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <input
              autoFocus
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void saveName();
                }
                if (e.key === "Escape") {
                  setName(group.name);
                  setRenaming(false);
                  setError(null);
                }
              }}
              aria-label="Group name"
              className={cn(flavourInputClass, "max-w-xs")}
            />
            <button
              type="button"
              onClick={() => void saveName()}
              disabled={updateGroup.isPending}
              title="Save name"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-500 text-white hover:bg-brand-700 disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setName(group.name);
                setRenaming(false);
                setError(null);
              }}
              title="Cancel"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <h2 className="flex min-w-0 flex-1">
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-expanded={!collapsed}
              title={collapsed ? "Expand group" : "Collapse group"}
              className="group flex min-w-0 flex-1 items-center gap-2 rounded-md py-0.5 text-left"
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-slate-700",
                  collapsed && "-rotate-90",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="truncate text-sm font-semibold text-slate-900">
                    {group ? group.name : "Ungrouped"}
                  </span>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {flavours.length} {flavours.length === 1 ? "flavour" : "flavours"}
                  </span>
                  {!group && (
                    <span className="text-xs text-slate-400">· shown under “More flavours”</span>
                  )}
                </span>
                {collapsed && preview && (
                  <span className="mt-0.5 block truncate text-xs font-normal text-slate-400">
                    {preview}
                  </span>
                )}
              </span>
            </button>
          </h2>
        )}
        {group && !renaming && (
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => {
                setName(group.name);
                setRenaming(true);
              }}
              title="Rename group"
              aria-label={`Rename ${group.name}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void onDelete()}
              disabled={deleteGroup.isPending}
              title="Delete group"
              aria-label={`Delete ${group.name}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </header>
      {error && (
        <p className="border-b border-slate-100 bg-brand-100/40 px-4 py-2 text-xs text-brand-700">
          {error}
        </p>
      )}

      {!collapsed && flavours.length === 0 && !adding && (
        <p className="px-4 py-5 text-center text-sm text-slate-500">
          No flavours here yet. Add one below, or use <span className="font-medium">Move to</span>{" "}
          on any flavour.
        </p>
      )}

      {!collapsed && (flavours.length > 0 || adding) && (
        <table className="w-full text-left text-sm">
          {flavours.length > 0 && (
            <thead className="hidden border-b border-slate-100 text-xs tracking-wide text-slate-500 uppercase md:table-header-group">
              <tr>
                <th className="w-10 px-2 py-2 font-medium">
                  <span className="sr-only">Reorder</span>
                </th>
                <th className="px-4 py-2 font-medium">Flavour</th>
                <th className="w-44 px-4 py-2 font-medium">Move to</th>
                <th className="px-4 py-2 font-medium">Tags</th>
                <th className="w-40 px-4 py-2 text-right font-medium">Additional (₹)</th>
                <th className="w-24 px-4 py-2 text-center font-medium">Active</th>
                <th className="w-16 px-4 py-2 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
          )}
          {flavours.length > 0 && (
            <ReorderList
              as="tbody"
              className="divide-y divide-slate-100"
              items={flavours}
              onReorder={onReorderFlavours}
              disabled={reorderDisabled}
            >
              {(flavour, ctx) => (
                <FlavourRow
                  key={flavour.id}
                  flavour={flavour}
                  groups={groups}
                  endSortOrder={endSortOrder}
                  reorder={ctx}
                />
              )}
            </ReorderList>
          )}
          {adding && (
            <AddFlavourRow
              groupId={group?.id ?? null}
              sortOrder={endSortOrder}
              onDone={() => setAdding(false)}
            />
          )}
        </table>
      )}

      {!collapsed && !adding && (
        <footer className="border-t border-slate-100 px-3 py-2">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100/50"
          >
            <Plus className="h-4 w-4" /> Add flavour{group ? ` to ${group.name}` : ""}
          </button>
        </footer>
      )}
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown, Plus, X } from "lucide-react";
import {
  useAdminFlavours,
  useCreateFlavourGroup,
  useFlavourGroups,
  useReorderFlavourGroups,
  useReorderFlavours,
  type AdminFlavour,
  type FlavourGroup,
} from "@/hooks/useFlavours";
import { ReorderList } from "@/components/reorder/ReorderList";
import { FlavourGroupCard } from "./FlavourGroupCard";
import { flavourInputClass } from "./FlavourRow";

const SUGGESTED_GROUPS = ["Classic", "Chocolate", "Fruity", "Cheesecake & mousse", "Indian fusion"];

const NO_FLAVOURS: AdminFlavour[] = [];
const NO_GROUPS: FlavourGroup[] = [];

const COLLAPSED_STORAGE_KEY = "keyafe-admin-flavour-groups-collapsed";
const UNGROUPED_KEY = "ungrouped";

function readCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function useCollapsedGroups() {
  const [collapsed, setCollapsed] = useState<Set<string>>(readCollapsed);
  const save = (next: Set<string>) => {
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      // Private mode / quota: collapsing still works for this visit.
    }
  };
  const toggle = (key: string) => {
    const next = new Set(collapsed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    save(next);
  };
  return { collapsed, toggle, setAll: (keys: string[]) => save(new Set(keys)) };
}

export function FlavoursPage() {
  const { data: flavours = NO_FLAVOURS, isLoading: flavoursLoading } = useAdminFlavours();
  const { data: groups = NO_GROUPS, isLoading: groupsLoading } = useFlavourGroups();
  const reorderFlavours = useReorderFlavours();
  const reorderGroups = useReorderFlavourGroups();
  const [items, setItems] = useState<AdminFlavour[]>([]);
  const [groupItems, setGroupItems] = useState<FlavourGroup[]>([]);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const isLoading = flavoursLoading || groupsLoading;
  const { collapsed, toggle, setAll } = useCollapsedGroups();

  useEffect(() => {
    setItems(flavours);
  }, [flavours]);
  useEffect(() => {
    setGroupItems(groups);
  }, [groups]);

  const groupIds = useMemo(() => new Set(groupItems.map((g) => g.id)), [groupItems]);
  const keyOf = (f: AdminFlavour) => (f.groupId && groupIds.has(f.groupId) ? f.groupId : null);
  const flavoursIn = (key: string | null) => items.filter((f) => keyOf(f) === key);
  const ungrouped = flavoursIn(null);
  const endSortOrder = items.reduce((max, f) => Math.max(max, f.sortOrder), 0) + 10;
  const hiddenCount = items.filter((f) => !f.isActive).length;

  const onReorderWithin = (key: string | null, next: AdminFlavour[]) => {
    const prev = items;
    const ordered = [...groupItems.map((g) => g.id), null].flatMap((k) =>
      k === key ? next : flavoursIn(k),
    );
    setItems(ordered);
    setReorderError(null);
    void reorderFlavours.mutateAsync(ordered.map((f) => f.id)).catch((err) => {
      setItems(prev);
      setReorderError(err instanceof Error ? err.message : "Failed to save order");
    });
  };

  const onReorderGroups = (next: FlavourGroup[]) => {
    const prev = groupItems;
    setGroupItems(next);
    setReorderError(null);
    void reorderGroups.mutateAsync(next.map((g) => g.id)).catch((err) => {
      setGroupItems(prev);
      setReorderError(err instanceof Error ? err.message : "Failed to save group order");
    });
  };

  const reorderDisabled = reorderFlavours.isPending || reorderGroups.isPending;
  const showUngrouped = ungrouped.length > 0 || groupItems.length === 0;
  const cardKeys = [...groupItems.map((g) => g.id), ...(showUngrouped ? [UNGROUPED_KEY] : [])];
  const allCollapsed = cardKeys.length > 0 && cardKeys.every((k) => collapsed.has(k));

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold text-slate-900">Flavours</h1>
            {!isLoading && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 tabular-nums">
                {items.length} {items.length === 1 ? "flavour" : "flavours"}
                {groupItems.length > 0 && (
                  <>
                    {" "}
                    · {groupItems.length} {groupItems.length === 1 ? "group" : "groups"}
                  </>
                )}
                {hiddenCount > 0 && <span className="text-slate-400"> · {hiddenCount} hidden</span>}
              </span>
            )}
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Each card is a group, shown as a heading on the cake page in this order. Drag cards to
            reorder groups and rows to reorder flavours; use{" "}
            <span className="font-medium">Move to</span> to put a flavour in another group. The{" "}
            <span className="font-medium">Additional amount</span> is added on top of the product
            base price (per pound) whenever a customer picks this flavour. Delete only works when no
            products offer the flavour — otherwise turn Active off.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-start gap-2 self-start">
          {cardKeys.length > 1 && (
            <button
              type="button"
              onClick={() => setAll(allCollapsed ? [] : cardKeys)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {allCollapsed ? (
                <ChevronsUpDown className="h-4 w-4" />
              ) : (
                <ChevronsDownUp className="h-4 w-4" />
              )}
              {allCollapsed ? "Expand all" : "Collapse all"}
            </button>
          )}
          <AddGroupButton existing={groupItems} />
        </div>
      </div>

      {reorderError && (
        <div className="mb-4 rounded-lg border border-brand-500/40 bg-brand-100/50 px-4 py-3 text-sm text-brand-700">
          {reorderError}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-card border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Loading…
        </div>
      ) : (
        <div className="space-y-4">
          {groupItems.length > 0 && (
            <ReorderList
              items={groupItems}
              onReorder={onReorderGroups}
              disabled={reorderDisabled}
              className="space-y-4"
            >
              {(group, ctx) => (
                <FlavourGroupCard
                  key={group.id}
                  group={group}
                  flavours={flavoursIn(group.id)}
                  groups={groupItems}
                  endSortOrder={endSortOrder}
                  reorder={ctx}
                  onReorderFlavours={(next) => onReorderWithin(group.id, next)}
                  reorderDisabled={reorderDisabled}
                  collapsed={collapsed.has(group.id)}
                  onToggleCollapsed={() => toggle(group.id)}
                />
              )}
            </ReorderList>
          )}
          {showUngrouped && (
            <FlavourGroupCard
              group={null}
              flavours={ungrouped}
              groups={groupItems}
              endSortOrder={endSortOrder}
              onReorderFlavours={(next) => onReorderWithin(null, next)}
              reorderDisabled={reorderDisabled}
              collapsed={collapsed.has(UNGROUPED_KEY)}
              onToggleCollapsed={() => toggle(UNGROUPED_KEY)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function AddGroupButton({ existing }: { existing: FlavourGroup[] }) {
  const createGroup = useCreateFlavourGroup();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const taken = new Set(existing.map((g) => g.name.toLowerCase()));
  const suggestions = SUGGESTED_GROUPS.filter((s) => !taken.has(s.toLowerCase()));

  const close = () => {
    setOpen(false);
    setName("");
    setError(null);
  };

  const create = async (value: string, keepOpen = false) => {
    const next = value.trim();
    if (!next) return setError("Group name is required");
    setError(null);
    try {
      await createGroup.mutateAsync(next);
      if (!keepOpen) close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
      >
        <Plus className="h-4 w-4" /> Add group
      </button>
    );
  }

  return (
    <div className="w-full shrink-0 rounded-card border border-slate-200 bg-white p-3 sm:w-80">
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void create(name);
            }
            if (e.key === "Escape") close();
          }}
          placeholder="Group name, e.g. Chocolate"
          aria-label="New group name"
          className={flavourInputClass}
        />
        <button
          type="button"
          onClick={() => void create(name)}
          disabled={createGroup.isPending}
          className="shrink-0 rounded-md bg-brand-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {createGroup.isPending ? "Adding…" : "Add"}
        </button>
        <button
          type="button"
          onClick={close}
          title="Cancel"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-brand-700">{error}</p>}
      {suggestions.length > 0 && (
        <div className="mt-2.5">
          <p className="mb-1.5 text-[11px] text-slate-500">Quick add</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                disabled={createGroup.isPending}
                onClick={() => void create(s, true)}
                className="hover:border-brand-300 inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-brand-100/40 disabled:opacity-60"
              >
                <Plus className="h-3 w-3" /> {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

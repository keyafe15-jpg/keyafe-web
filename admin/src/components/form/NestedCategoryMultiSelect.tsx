import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronRight, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { inputClass } from "@/components/form/Field";

/** Flat category row or a node with nested `children`. */
export type NestedCategoryItem = {
  id: string;
  name: string;
  parentId?: string | null;
  children?: NestedCategoryItem[];
};

type TreeNode = {
  id: string;
  name: string;
  children: TreeNode[];
};

type SubmenuPos = { top: number; left: number; maxHeight: number };

function buildTree(categories: NestedCategoryItem[]): TreeNode[] {
  const hasNested = categories.some((c) => (c.children?.length ?? 0) > 0);
  if (hasNested) {
    return categories
      .filter((c) => !c.parentId)
      .map((c) => ({
        id: c.id,
        name: c.name,
        children: (c.children ?? []).map((ch) => ({
          id: ch.id,
          name: ch.name,
          children: [],
        })),
      }));
  }

  const tops = categories.filter((c) => !c.parentId);
  return tops.map((parent) => ({
    id: parent.id,
    name: parent.name,
    children: categories
      .filter((c) => c.parentId === parent.id)
      .map((ch) => ({ id: ch.id, name: ch.name, children: [] })),
  }));
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
}

function placeSubmenu(anchor: DOMRect): SubmenuPos {
  const gap = 4;
  const width = 208; // w-52
  const pad = 8;
  const vh = window.innerHeight;
  const vw = window.innerWidth;

  let left = anchor.right + gap;
  if (left + width > vw - pad) {
    left = Math.max(pad, anchor.left - width - gap);
  }

  const maxHeight = Math.min(320, vh - pad * 2);
  let top = anchor.top;
  if (top + maxHeight > vh - pad) {
    top = Math.max(pad, vh - pad - maxHeight);
  }
  if (top < pad) top = pad;

  return { top, left, maxHeight };
}

/**
 * Multi-select category picker with search and classic hierarchical flyouts:
 * hover (or click) a parent with children to open a submenu of subcategories.
 * Submenus are portaled + fixed so they are never clipped by parents.
 */
export function NestedCategoryMultiSelect({
  categories,
  selected,
  onChange,
  placeholder = "Select categories",
  searchPlaceholder = "Search categories…",
  className,
  triggerClassName,
}: {
  categories: NestedCategoryItem[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hoveredParentId, setHoveredParentId] = useState<string | null>(null);
  const [pinnedParentId, setPinnedParentId] = useState<string | null>(null);
  const [submenuPos, setSubmenuPos] = useState<SubmenuPos | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  const tree = useMemo(() => buildTree(categories), [categories]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const parent of tree) {
      map.set(parent.id, parent.name);
      for (const child of parent.children) {
        map.set(child.id, `${parent.name} → ${child.name}`);
      }
    }
    for (const c of categories) {
      if (!map.has(c.id)) map.set(c.id, c.name);
    }
    return map;
  }, [categories, tree]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const searchHits = useMemo(() => {
    const q = normalize(query);
    if (!q) return null;
    const hits: { id: string; label: string; parentId: string | null }[] = [];
    for (const parent of tree) {
      const parentMatch = normalize(parent.name).includes(q);
      if (parentMatch) {
        hits.push({ id: parent.id, label: parent.name, parentId: null });
      }
      for (const child of parent.children) {
        const label = `${parent.name} → ${child.name}`;
        if (parentMatch || normalize(child.name).includes(q) || normalize(label).includes(q)) {
          hits.push({ id: child.id, label, parentId: parent.id });
        }
      }
    }
    return hits;
  }, [query, tree]);

  const activeSubmenuId = pinnedParentId ?? hoveredParentId;
  const activeParent = tree.find((p) => p.id === activeSubmenuId) ?? null;

  const clearLeaveTimer = () => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  };

  const scheduleCloseSubmenu = () => {
    clearLeaveTimer();
    leaveTimer.current = setTimeout(() => {
      if (!pinnedParentId) {
        setHoveredParentId(null);
        setSubmenuPos(null);
      }
    }, 140);
  };

  const openSubmenuFor = (parentId: string) => {
    clearLeaveTimer();
    setHoveredParentId(parentId);
    const el = rowRefs.current.get(parentId);
    if (el) setSubmenuPos(placeSubmenu(el.getBoundingClientRect()));
  };

  useLayoutEffect(() => {
    if (!activeSubmenuId) {
      setSubmenuPos(null);
      return;
    }
    const el = rowRefs.current.get(activeSubmenuId);
    if (!el) return;
    const update = () => setSubmenuPos(placeSubmenu(el.getBoundingClientRect()));
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [activeSubmenuId, open]);

  useEffect(() => () => clearLeaveTimer(), []);

  const toggle = (id: string) => {
    onChange(selectedSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  const remove = (id: string) => {
    onChange(selected.filter((x) => x !== id));
  };

  const resetMenus = () => {
    setQuery("");
    setHoveredParentId(null);
    setPinnedParentId(null);
    setSubmenuPos(null);
  };

  if (categories.length === 0) {
    return <p className="text-xs text-slate-500">No categories yet — add one first.</p>;
  }

  const submenu =
    open &&
    activeParent &&
    activeParent.children.length > 0 &&
    submenuPos &&
    createPortal(
      <div
        data-category-submenu
        style={{
          position: "fixed",
          top: submenuPos.top,
          left: submenuPos.left,
          maxHeight: submenuPos.maxHeight,
          zIndex: 80,
        }}
        className="w-52 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        onMouseEnter={() => {
          clearLeaveTimer();
          setHoveredParentId(activeParent.id);
        }}
        onMouseLeave={scheduleCloseSubmenu}
      >
        <p className="truncate px-3 py-1.5 text-[10px] font-medium tracking-wide text-slate-400 uppercase">
          {activeParent.name}
        </p>
        {activeParent.children.map((child) => (
          <CheckRow
            key={child.id}
            name={child.name}
            checked={selectedSet.has(child.id)}
            onToggle={() => toggle(child.id)}
            nested
          />
        ))}
      </div>,
      document.body,
    );

  return (
    <div className={cn("space-y-1.5", className)}>
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetMenus();
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            className={cn(
              inputClass,
              "flex min-h-[2.5rem] items-center justify-between gap-2 py-1.5 text-left text-sm",
              selected.length === 0 && "text-slate-400",
              triggerClassName,
            )}
          >
            <span className="min-w-0 truncate">
              {selected.length === 0
                ? placeholder
                : selected.length === 1
                  ? (nameById.get(selected[0]!) ?? "1 category")
                  : `${selected.length} categories selected`}
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
            onCloseAutoFocus={(e) => e.preventDefault()}
            // Keep submenu hover from dismissing the popover when pointer leaves content briefly.
            onInteractOutside={(e) => {
              const target = e.target as HTMLElement | null;
              if (target?.closest("[data-category-submenu]")) {
                e.preventDefault();
              }
            }}
            className="z-50 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white shadow-lg"
          >
            <div className="relative border-b border-slate-100">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHoveredParentId(null);
                  setPinnedParentId(null);
                  setSubmenuPos(null);
                }}
                placeholder={searchPlaceholder}
                className="w-full border-0 bg-transparent py-2.5 pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            {searchHits ? (
              <div className="max-h-72 overflow-y-auto py-1">
                {searchHits.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-slate-500">No matches</p>
                ) : (
                  searchHits.map((hit) => (
                    <CheckRow
                      key={hit.id}
                      name={hit.label}
                      checked={selectedSet.has(hit.id)}
                      onToggle={() => toggle(hit.id)}
                    />
                  ))
                )}
              </div>
            ) : (
              <div
                className="max-h-72 overflow-y-auto py-1"
                onMouseLeave={() => {
                  if (!pinnedParentId) scheduleCloseSubmenu();
                }}
              >
                {tree.map((parent) => {
                  const hasChildren = parent.children.length > 0;
                  const submenuOpen = activeSubmenuId === parent.id;
                  return (
                    <div
                      key={parent.id}
                      ref={(el) => {
                        if (el) rowRefs.current.set(parent.id, el);
                        else rowRefs.current.delete(parent.id);
                      }}
                      onMouseEnter={() => {
                        if (hasChildren) openSubmenuFor(parent.id);
                        else {
                          clearLeaveTimer();
                          setHoveredParentId(null);
                          if (!pinnedParentId) setSubmenuPos(null);
                        }
                      }}
                    >
                      <div
                        className={cn(
                          "flex items-center gap-0.5 pr-1",
                          submenuOpen && "bg-slate-50",
                        )}
                      >
                        <CheckRow
                          name={parent.name}
                          checked={selectedSet.has(parent.id)}
                          onToggle={() => toggle(parent.id)}
                        />
                        {hasChildren && (
                          <button
                            type="button"
                            aria-label={`Show ${parent.name} subcategories`}
                            aria-expanded={submenuOpen}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setPinnedParentId((prev) => {
                                const next = prev === parent.id ? null : parent.id;
                                if (next) openSubmenuFor(parent.id);
                                else {
                                  setHoveredParentId(null);
                                  setSubmenuPos(null);
                                }
                                return next;
                              });
                            }}
                            className={cn(
                              "mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700",
                              submenuOpen && "bg-slate-100 text-slate-700",
                            )}
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {submenu}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((id) => (
            <span
              key={id}
              className="inline-flex max-w-full items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-800 ring-1 ring-brand-200"
            >
              <span className="truncate">{nameById.get(id) ?? id}</span>
              <button
                type="button"
                onClick={() => remove(id)}
                className="shrink-0 rounded p-0.5 text-brand-600 hover:bg-brand-100"
                aria-label={`Remove ${nameById.get(id) ?? "category"}`}
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

function CheckRow({
  name,
  checked,
  onToggle,
  nested = false,
}: {
  name: string;
  checked: boolean;
  onToggle: () => void;
  nested?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-slate-50",
        checked && "bg-brand-50/70",
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
          checked ? "border-brand-500 bg-brand-500 text-white" : "border-slate-300 bg-white",
        )}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span
        className={cn(
          "min-w-0 truncate",
          nested ? "text-xs text-slate-600" : "text-sm font-medium text-slate-800",
        )}
      >
        {name}
      </span>
    </button>
  );
}

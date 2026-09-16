import { useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, ChevronRight, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { inputClass } from "@/components/form/Field";
import type { AdminCategory } from "@/hooks/useAdminCategories";

export function NestedCategoryMultiSelect({
  categories,
  selected,
  onChange,
  placeholder = "Select categories",
}: {
  categories: AdminCategory[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const tree = useMemo(() => {
    const tops = categories.filter((c) => !c.parentId);
    return tops.map((parent) => ({
      ...parent,
      children: categories.filter((c) => c.parentId === parent.id),
    }));
  }, [categories]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) map.set(c.id, c.name);
    return map;
  }, [categories]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const summary = useMemo(() => {
    if (selected.length === 0) return null;
    const first = nameById.get(selected[0]) ?? "1 category";
    if (selected.length === 1) return first;
    return `${first} + ${selected.length - 1} more`;
  }, [nameById, selected]);

  const toggle = (id: string) => {
    onChange(selectedSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (categories.length === 0) {
    return (
      <p className="text-xs text-slate-500">Create categories first, then assign defaults here.</p>
    );
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          const openParents = new Set<string>();
          for (const parent of tree) {
            if (
              selectedSet.has(parent.id) ||
              parent.children.some((child) => selectedSet.has(child.id))
            ) {
              openParents.add(parent.id);
            }
          }
          setExpanded(openParents);
        }
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            inputClass,
            "flex max-w-sm items-center justify-between gap-2 py-1.5 text-left text-xs",
            !summary && "text-slate-400",
          )}
        >
          <span className="min-w-0 truncate">{summary ?? placeholder}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          className="z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          <div className="max-h-72 overflow-y-auto py-1">
            {tree.map((parent) => {
              const hasChildren = parent.children.length > 0;
              const isOpen = expanded.has(parent.id);
              return (
                <div key={parent.id}>
                  <div className="flex items-center gap-0.5 px-1">
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(parent.id)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-expanded={isOpen}
                        aria-label={
                          isOpen ? `Collapse ${parent.name}` : `Show ${parent.name} subcategories`
                        }
                      >
                        {isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </button>
                    ) : (
                      <span className="w-7 shrink-0" />
                    )}
                    <CategoryCheckRow
                      name={parent.name}
                      checked={selectedSet.has(parent.id)}
                      onToggle={() => toggle(parent.id)}
                    />
                  </div>
                  {hasChildren && isOpen && (
                    <div className="pb-1">
                      {parent.children.map((child) => (
                        <div key={child.id} className="flex items-center pr-1 pl-8">
                          <CategoryCheckRow
                            name={child.name}
                            checked={selectedSet.has(child.id)}
                            onToggle={() => toggle(child.id)}
                            nested
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function CategoryCheckRow({
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
        "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-50",
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

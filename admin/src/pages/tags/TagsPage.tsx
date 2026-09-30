import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  useAdminTags,
  useCreateTag,
  useDeleteTag,
  useReorderTags,
  useUpdateTag,
  type AdminTag,
} from "@/hooks/useTags";
import { cn } from "@/lib/cn";
import { Field, inputClass, submitClass } from "@/components/form/Field";
import {
  ReorderHandle,
  ReorderList,
  type ReorderItemContext,
} from "@/components/reorder/ReorderList";
import { ActiveSwitch } from "@/components/ui/ActiveSwitch";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const DEFAULT_COLORS = ["#E31C79", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6"];

const NO_TAGS: AdminTag[] = [];

export function TagsPage() {
  const { data: tags = NO_TAGS, isLoading } = useAdminTags();
  const reorderTags = useReorderTags();
  const [items, setItems] = useState<AdminTag[]>([]);
  const [reorderError, setReorderError] = useState<string | null>(null);

  useEffect(() => {
    setItems(tags);
  }, [tags]);

  const onReorder = (next: AdminTag[]) => {
    const prev = items;
    setItems(next);
    setReorderError(null);
    void reorderTags.mutateAsync(next.map((t) => t.id)).catch((err) => {
      setItems(prev);
      setReorderError(err instanceof Error ? err.message : "Failed to save order");
    });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Product tags</h1>
        <p className="mt-1 text-sm text-slate-500">
          Labels like &ldquo;New launch&rdquo; and &ldquo;Best seller&rdquo;. Assign them on each
          product; they show as badges on the storefront. Turn on{" "}
          <span className="font-medium">On homepage</span> to give a tag its own product row on the
          landing page — drag rows to set the order those rows appear in. Delete only works when no
          products use the tag — otherwise remove it from those products first.
        </p>
      </div>

      <NewTagRow nextSortOrder={Math.min(999, Math.max(0, ...tags.map((t) => t.sortOrder)) + 10)} />

      {reorderError && (
        <div className="mt-4 rounded-lg border border-brand-500/40 bg-brand-100/50 px-4 py-3 text-sm text-brand-700">
          {reorderError}
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-card border border-slate-200 bg-white">
        {isLoading && <div className="p-8 text-center text-sm text-slate-500">Loading…</div>}
        {!isLoading && items.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            No tags yet — add your first one above.
          </div>
        )}
        {!isLoading && items.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="hidden border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase md:table-header-group">
              <tr>
                <th className="w-10 px-2 py-2 font-medium">
                  <span className="sr-only">Reorder</span>
                </th>
                <th className="px-4 py-2 font-medium">Tag</th>
                <th className="w-36 px-4 py-2 font-medium">Color</th>
                <th className="w-32 px-4 py-2 text-center font-medium">On homepage</th>
                <th className="w-28 px-4 py-2 text-right font-medium">Products</th>
                <th className="w-14 px-4 py-2 text-right font-medium">
                  <span className="sr-only">Delete</span>
                </th>
              </tr>
            </thead>
            <ReorderList
              as="tbody"
              className="divide-y divide-slate-100"
              items={items}
              onReorder={onReorder}
              disabled={reorderTags.isPending}
            >
              {(tag, ctx) => <TagRow key={tag.id} tag={tag} reorder={ctx} />}
            </ReorderList>
          </table>
        )}
      </div>
    </div>
  );
}

function NewTagRow({ nextSortOrder }: { nextSortOrder: number }) {
  const create = useCreateTag();
  const [name, setName] = useState("");
  const [colorHex, setColorHex] = useState(DEFAULT_COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0;

  const submit = async () => {
    setError(null);
    try {
      await create.mutateAsync({
        name: name.trim(),
        slug: slugify(name),
        colorHex: colorHex || null,
        sortOrder: nextSortOrder,
      });
      setName("");
      setColorHex(DEFAULT_COLORS[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  return (
    <div className="rounded-card border border-slate-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
        <Field label="New tag">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Best seller"
            className={inputClass}
          />
        </Field>
        <Field label="Badge color">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={colorHex}
              onChange={(e) => setColorHex(e.target.value)}
              className="h-10 w-12 cursor-pointer rounded border border-slate-200 bg-white"
            />
            <input
              value={colorHex}
              onChange={(e) => setColorHex(e.target.value)}
              placeholder="#E31C79"
              className={cn(inputClass, "font-mono text-xs")}
            />
          </div>
        </Field>
        <div className="self-end">
          <button
            type="button"
            disabled={!canSubmit || create.isPending}
            onClick={submit}
            className={cn(submitClass, "inline-flex items-center gap-1")}
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>
      {error && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

function TagRow({ tag, reorder }: { tag: AdminTag; reorder: ReorderItemContext }) {
  const update = useUpdateTag();
  const del = useDeleteTag();
  const [name, setName] = useState(tag.name);
  const [colorHex, setColorHex] = useState(tag.colorHex ?? "#E31C79");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inUse = tag.productCount > 0;

  const commit = async () => {
    await update.mutateAsync({
      id: tag.id,
      name: name.trim(),
      colorHex: colorHex || null,
    });
    setDirty(false);
  };

  const onDelete = async () => {
    setError(null);
    if (inUse) {
      setError(
        `Used by ${tag.productCount} product${tag.productCount === 1 ? "" : "s"}. Remove it from those products first.`,
      );
      return;
    }
    if (!confirm(`Delete tag “${tag.name}”? This cannot be undone.`)) return;
    try {
      await del.mutateAsync(tag.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <tr
      ref={reorder.setNodeRef}
      style={reorder.style}
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1 py-2 pr-2 pl-1 hover:bg-slate-50 md:table-row md:p-0",
        reorder.isDragging && "bg-white shadow-md",
      )}
    >
      <td className="col-[1] row-[1/3] md:table-cell md:px-2 md:py-3 md:align-middle">
        <ReorderHandle {...reorder.handleProps} />
      </td>
      <td className="col-[2] row-[1] min-w-0 md:table-cell md:px-4 md:py-3">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setDirty(true);
          }}
          onBlur={() => dirty && commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-label="Tag name"
          className="w-full truncate rounded-md border border-transparent bg-transparent py-0.5 font-medium text-slate-900 outline-none focus:border-slate-200 focus:bg-white focus:px-2 md:py-1"
        />
        <p className="hidden text-xs text-slate-500 md:block">/{tag.slug}</p>
        {error && <p className="mt-1 text-xs text-brand-700">{error}</p>}
      </td>
      <td className="col-[2/5] row-[2] min-w-0 md:table-cell md:px-4 md:py-3">
        <div className="flex items-center justify-between gap-2 md:justify-start">
          <span className="min-w-0 truncate text-xs text-slate-500 md:hidden">
            /{tag.slug} · {tag.productCount} product{tag.productCount === 1 ? "" : "s"}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <input
              type="color"
              value={colorHex}
              onChange={(e) => {
                setColorHex(e.target.value);
                setDirty(true);
              }}
              onBlur={() => dirty && commit()}
              aria-label="Badge color"
              className="h-7 w-8 cursor-pointer rounded border border-slate-200 bg-white md:h-8 md:w-10"
            />
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: `${colorHex}22`,
                color: colorHex,
              }}
            >
              Preview
            </span>
          </div>
        </div>
      </td>
      <td className="col-[3] row-[1] md:table-cell md:px-4 md:py-3 md:text-center">
        <div className="flex items-center gap-1.5 md:justify-center">
          <span className="text-[11px] font-medium text-slate-500 md:hidden">Home</span>
          <ActiveSwitch
            checked={tag.showOnHome}
            label={`Show ${tag.name} on homepage`}
            title={
              tag.showOnHome
                ? "Shown as a homepage section — tap to remove"
                : "Tap to show this tag as a section on the homepage"
            }
            onChange={(showOnHome) => update.mutate({ id: tag.id, showOnHome })}
          />
        </div>
      </td>
      <td className="hidden md:table-cell md:px-4 md:py-3 md:text-right">
        <span className="text-slate-600 tabular-nums">{tag.productCount}</span>
      </td>
      <td className="col-[4] row-[1] text-right md:table-cell md:px-4 md:py-3">
        <button
          type="button"
          onClick={() => void onDelete()}
          disabled={del.isPending}
          title={
            inUse
              ? `Used by ${tag.productCount} product(s) — remove from products first`
              : `Delete “${tag.name}”`
          }
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-md transition disabled:opacity-50",
            inUse
              ? "text-slate-300 hover:bg-slate-50 hover:text-slate-500"
              : "text-red-500 hover:bg-red-50 hover:text-red-700",
          )}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

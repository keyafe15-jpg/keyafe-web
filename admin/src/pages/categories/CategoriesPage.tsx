import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, X, ChevronDown, ChevronRight } from "lucide-react";
import {
  useAdminCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useReorderCategories,
  type AdminCategory,
} from "@/hooks/useAdminCategories";
import { useAdminDepartments } from "@/hooks/useAdminDepartments";
import {
  ReorderHandle,
  ReorderList,
  type ReorderItemContext,
} from "@/components/reorder/ReorderList";
import { ActiveSwitch } from "@/components/ui/ActiveSwitch";
import { uploadImage } from "@/lib/uploads";
import { inputClass, textareaClass, submitClass, selectClass } from "@/components/form/Field";
import { cn } from "@/lib/cn";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const NO_CATEGORIES: AdminCategory[] = [];

// Mirrors the server's `orderBy: [sortOrder, name]` so optimistic updates land where a refetch would.
const bySortThenName = (a: AdminCategory, b: AdminCategory) =>
  a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

const nextSortOrder = (all: AdminCategory[], parentId: string | null) =>
  Math.max(0, ...all.filter((c) => c.parentId === parentId).map((c) => c.sortOrder)) + 10;

export function CategoriesPage() {
  const { data: categories = NO_CATEGORIES, isLoading } = useAdminCategories();
  const reorderCategories = useReorderCategories();
  const [items, setItems] = useState<AdminCategory[]>([]);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [creating, setCreating] = useState<null | { parentId: string | null }>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setItems(categories);
  }, [categories]);

  const topLevel = items.filter((c) => !c.parentId);

  const onReorderSiblings = (next: AdminCategory[]) => {
    const prev = items;
    const rank = new Map(next.map((c, i) => [c.id, (i + 1) * 10]));
    setItems(
      items
        .map((c) => (rank.has(c.id) ? { ...c, sortOrder: rank.get(c.id)! } : c))
        .sort(bySortThenName),
    );
    setReorderError(null);
    void reorderCategories.mutateAsync(next.map((c) => c.id)).catch((err) => {
      setItems(prev);
      setReorderError(err instanceof Error ? err.message : "Failed to save order");
    });
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Categories</h1>
          <p className="mt-1 text-sm text-slate-500">
            Main catalogue taxonomy. Two levels supported — top-level and sub-categories. Assign
            each top-level to a store. Drag rows to set their order.
          </p>
        </div>
        <button
          onClick={() => setCreating({ parentId: null })}
          className={cn(
            submitClass,
            "inline-flex shrink-0 items-center gap-1.5 self-start whitespace-nowrap",
          )}
        >
          <Plus className="h-4 w-4" /> New top-level
        </button>
      </div>

      {reorderError && (
        <div className="mb-4 rounded-lg border border-brand-500/40 bg-brand-100/50 px-4 py-3 text-sm text-brand-700">
          {reorderError}
        </div>
      )}

      {isLoading && (
        <div className="rounded-card border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Loading…
        </div>
      )}

      {!isLoading && topLevel.length === 0 && !creating && (
        <div className="rounded-card border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No categories yet. Click <span className="font-medium">New top-level</span> to create the
          first one.
        </div>
      )}

      {creating?.parentId === null && (
        <div className="mb-4">
          <CategoryForm parentId={null} allCategories={items} onClose={() => setCreating(null)} />
        </div>
      )}

      <ReorderList
        className="space-y-3 sm:space-y-4"
        items={topLevel}
        onReorder={onReorderSiblings}
        disabled={reorderCategories.isPending}
      >
        {(top, ctx) => (
          <CategoryCard
            category={top}
            children={items.filter((c) => c.parentId === top.id)}
            reorder={ctx}
            reorderDisabled={reorderCategories.isPending}
            onReorderChildren={onReorderSiblings}
            editingId={editingId}
            creating={creating}
            onEdit={setEditingId}
            onAddSub={() => setCreating({ parentId: top.id })}
            onCloseCreate={() => setCreating(null)}
            onCloseEdit={() => setEditingId(null)}
            allCategories={items}
          />
        )}
      </ReorderList>
    </div>
  );
}

function CategoryCard({
  category,
  children,
  reorder,
  reorderDisabled,
  onReorderChildren,
  editingId,
  creating,
  onEdit,
  onAddSub,
  onCloseCreate,
  onCloseEdit,
  allCategories,
}: {
  category: AdminCategory;
  children: AdminCategory[];
  reorder: ReorderItemContext;
  reorderDisabled: boolean;
  onReorderChildren: (next: AdminCategory[]) => void;
  editingId: string | null;
  creating: null | { parentId: string | null };
  onEdit: (id: string | null) => void;
  onAddSub: () => void;
  onCloseCreate: () => void;
  onCloseEdit: () => void;
  allCategories: AdminCategory[];
}) {
  const [expanded, setExpanded] = useState(true);
  const isEditing = editingId === category.id;

  return (
    <section
      ref={reorder.setNodeRef}
      style={reorder.style}
      className={cn(
        "overflow-hidden rounded-card border border-slate-200 bg-white",
        reorder.isDragging && "shadow-lg",
      )}
    >
      <CategoryRow
        category={category}
        isTop
        handleProps={reorder.handleProps}
        expanded={expanded}
        toggleExpanded={() => setExpanded(!expanded)}
        showToggle={children.length > 0}
        isEditing={isEditing}
        onEdit={() => onEdit(isEditing ? null : category.id)}
      />

      {isEditing && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-3 sm:p-4">
          <CategoryForm existing={category} allCategories={allCategories} onClose={onCloseEdit} />
        </div>
      )}

      {expanded && (
        <div className="border-t border-slate-100">
          <ReorderList
            className="divide-y divide-slate-100"
            items={children}
            onReorder={onReorderChildren}
            disabled={reorderDisabled}
          >
            {(child, ctx) => {
              const childEditing = editingId === child.id;
              return (
                <div
                  ref={ctx.setNodeRef}
                  style={ctx.style}
                  className={cn(ctx.isDragging && "bg-white shadow-md")}
                >
                  <CategoryRow
                    category={child}
                    isTop={false}
                    handleProps={ctx.handleProps}
                    isEditing={childEditing}
                    onEdit={() => onEdit(childEditing ? null : child.id)}
                  />
                  {childEditing && (
                    <div className="bg-slate-50/60 p-3 sm:p-4">
                      <CategoryForm
                        existing={child}
                        allCategories={allCategories}
                        onClose={onCloseEdit}
                      />
                    </div>
                  )}
                </div>
              );
            }}
          </ReorderList>

          {creating?.parentId === category.id ? (
            <div className="border-t border-slate-100 bg-slate-50/60 p-3 sm:p-4">
              <CategoryForm
                parentId={category.id}
                allCategories={allCategories}
                onClose={onCloseCreate}
              />
            </div>
          ) : (
            <button
              onClick={onAddSub}
              className={cn(
                "flex w-full items-center gap-1.5 px-4 py-2 text-left text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-brand-500",
                children.length > 0 && "border-t border-slate-100",
              )}
            >
              <Plus className="h-3.5 w-3.5" /> Add sub-category
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function CategoryRow({
  category,
  isTop,
  handleProps,
  expanded,
  toggleExpanded,
  showToggle,
  isEditing,
  onEdit,
}: {
  category: AdminCategory;
  isTop: boolean;
  handleProps: ReorderItemContext["handleProps"];
  expanded?: boolean;
  toggleExpanded?: () => void;
  showToggle?: boolean;
  isEditing: boolean;
  onEdit: () => void;
}) {
  const update = useUpdateCategory();
  const del = useDeleteCategory();

  return (
    // Phones: name + switch on the first line, details + edit/delete underneath.
    <div
      className={cn(
        "grid grid-cols-[auto_auto_auto_minmax(0,1fr)_auto_auto_auto] items-center gap-x-1.5 gap-y-0.5 py-2 pr-2 pl-1 transition sm:gap-x-3 sm:py-3 sm:pr-4 sm:pl-2",
        isTop ? "bg-slate-50/40" : "pl-3 sm:pl-8",
        isEditing && "bg-brand-100/30",
      )}
    >
      <div className="col-[1] row-[1/3]">
        <ReorderHandle {...handleProps} />
      </div>

      <div className="col-[2] row-[1/3]">
        {isTop && (
          <button
            type="button"
            onClick={toggleExpanded}
            aria-label={expanded ? "Collapse" : "Expand"}
            className={cn(
              "rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700",
              !showToggle && "invisible",
            )}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )}
      </div>

      <div className="col-[3] row-[1/3]">
        <Thumbnail url={category.imageUrl} />
      </div>

      <p
        className={cn(
          "col-[4/7] row-[1] truncate font-medium text-slate-900 sm:col-[4]",
          isTop ? "text-sm sm:text-base" : "text-sm",
          !category.isActive && "text-slate-400",
        )}
      >
        {category.name}
      </p>
      <p className="col-[4/6] row-[2] truncate text-xs text-slate-500 sm:col-[4]">
        <span className="hidden sm:inline">/{category.slug} · </span>
        {category.department && (
          <span>
            {category.department.name}
            {!isTop && <span className="hidden sm:inline"> (from parent)</span>}
          </span>
        )}
        {category.productCount > 0 && (
          <span>
            {" "}
            · {category.productCount} product
            {category.productCount === 1 ? "" : "s"}
          </span>
        )}
        {isTop && category.childCount > 0 && (
          <span>
            {" "}
            · {category.childCount} sub{category.childCount === 1 ? "" : "s"}
          </span>
        )}
      </p>

      <div className="col-[7] row-[1] justify-self-end sm:col-[5] sm:row-[1/3]">
        <ActiveSwitch
          checked={category.isActive}
          label={`${category.name} active`}
          onChange={(isActive) => update.mutate({ id: category.id, isActive })}
        />
      </div>

      <button
        onClick={onEdit}
        className={cn(
          "col-[6] row-[2] rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-500 sm:row-[1/3]",
          isEditing && "bg-brand-100/60 text-brand-500",
        )}
        title="Edit"
      >
        <Pencil className="h-4 w-4" />
      </button>

      <button
        onClick={() => {
          if (
            confirm(
              category.productCount + category.childCount > 0
                ? `"${category.name}" has ${category.productCount} product(s) and ${category.childCount} sub(s). Delete anyway?`
                : `Delete "${category.name}"?`,
            )
          ) {
            del.mutate(category.id, {
              onError: (err) => alert(err instanceof Error ? err.message : "Delete failed"),
            });
          }
        }}
        className="col-[7] row-[2] rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-500 sm:row-[1/3]"
        title="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function Thumbnail({ url }: { url: string | null }) {
  return url ? (
    <img
      src={url}
      alt=""
      className="h-9 w-9 shrink-0 rounded-md object-cover ring-1 ring-slate-200 sm:h-10 sm:w-10"
    />
  ) : (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-center text-[9px] leading-tight font-medium text-slate-400 uppercase sm:h-10 sm:w-10 sm:text-[10px]">
      No img
    </span>
  );
}

// Inline edit / create form. `existing` present → edit mode; otherwise create.
function CategoryForm({
  existing,
  parentId,
  allCategories,
  onClose,
}: {
  existing?: AdminCategory;
  parentId?: string | null;
  allCategories: AdminCategory[];
  onClose: () => void;
}) {
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const { data: stores = [] } = useAdminDepartments();

  const [name, setName] = useState(existing?.name ?? "");
  const [slug, setSlug] = useState(existing?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!existing);
  const [description, setDescription] = useState(existing?.description ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(existing?.imageUrl ?? null);
  const [selectedParent, setSelectedParent] = useState<string | null>(
    existing ? existing.parentId : (parentId ?? null),
  );
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [departmentId, setDepartmentId] = useState(existing?.departmentId ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autoSlug = slugify(name);
  if (!slugTouched && autoSlug !== slug) {
    setTimeout(() => setSlug(autoSlug), 0);
  }

  const topLevelOptions = allCategories.filter((c) => !c.parentId && c.id !== existing?.id);

  const handleImage = async (file: File | null) => {
    if (!file) {
      setImageUrl(null);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const res = await uploadImage(file, "category");
      setImageUrl(res.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Name is too short");
    if (!/^[a-z0-9-]+$/.test(slug))
      return setError("Slug: lowercase letters, digits, hyphens only");

    if (!selectedParent && !departmentId) {
      return setError("Pick a store for a top-level category");
    }

    // New rows, and rows moved under a different parent, go to the end of their sibling list.
    const sortOrder =
      existing && existing.parentId === selectedParent
        ? existing.sortOrder
        : nextSortOrder(allCategories, selectedParent);

    const payload = {
      name: name.trim(),
      slug,
      description: description.trim() || null,
      imageUrl,
      parentId: selectedParent,
      departmentId: selectedParent ? null : departmentId,
      sortOrder,
      isActive,
    };

    try {
      if (existing) {
        await update.mutateAsync({ id: existing.id, ...payload });
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  const inheritedStore =
    existing?.department ?? allCategories.find((c) => c.id === selectedParent)?.department ?? null;
  const saving = create.isPending || update.isPending;

  return (
    <form
      onSubmit={submit}
      className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          {existing
            ? "Edit category"
            : selectedParent
              ? "New sub-category"
              : "New top-level category"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          title="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Name <span className="text-brand-500">*</span>
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Slug</span>
          <input
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            className={inputClass}
            required
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={textareaClass}
          placeholder="Shown on the category landing page."
        />
      </label>

      {!selectedParent ? (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Store <span className="text-brand-500">*</span>
          </span>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className={selectClass}
            required
          >
            <option value="">— Pick one —</option>
            {stores
              .filter((s) => s.isActive || s.id === existing?.departmentId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
          <span className="mt-1 block text-[11px] text-slate-500">
            Sub-categories inherit this. Manage stores under Catalog → Stores.
          </span>
        </label>
      ) : (
        <p className="text-xs text-slate-500">
          Store is inherited from the parent category
          {inheritedStore ? ` (${inheritedStore.name})` : ""}.
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Parent</span>
          <select
            value={selectedParent ?? ""}
            onChange={(e) => setSelectedParent(e.target.value || null)}
            className={inputClass}
            disabled={!!existing && existing.childCount > 0}
          >
            <option value="">— None (top-level) —</option>
            {topLevelOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {!!existing && existing.childCount > 0 && (
            <span className="mt-1 block text-[11px] text-slate-500">
              Move sub-categories away before changing this to a sub itself.
            </span>
          )}
        </label>

        <div className="flex flex-col items-start">
          <span className="mb-1 block text-xs font-medium text-slate-600">Active</span>
          <div className="flex h-9.5 items-center">
            <ActiveSwitch checked={isActive} label="Active" onChange={setIsActive} />
          </div>
        </div>
      </div>

      <div>
        <span className="mb-1 block text-xs font-medium text-slate-600">Image</span>
        <div className="flex flex-wrap items-center gap-3">
          <Thumbnail url={imageUrl} />
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => handleImage(e.target.files?.[0] ?? null)}
            className="block min-w-0 text-xs text-slate-600 file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-slate-200 file:bg-white file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-50"
          />
          {imageUrl && (
            <button
              type="button"
              onClick={() => setImageUrl(null)}
              className="text-xs text-slate-500 hover:text-brand-500"
            >
              Remove
            </button>
          )}
          {uploading && <span className="text-xs text-slate-500">Uploading…</span>}
        </div>
      </div>

      {error && <p className="text-xs text-brand-700">{error}</p>}

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || uploading}
          className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : existing ? "Save changes" : "Create"}
        </button>
      </div>
    </form>
  );
}

import { useState } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  useAdminCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  type AdminCategory,
} from "@/hooks/useAdminCategories";
import { uploadImage } from "@/lib/uploads";
import {
  inputClass,
  textareaClass,
  submitClass,
} from "@/components/form/Field";
import { cn } from "@/lib/cn";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function CategoriesPage() {
  const { data: categories = [], isLoading } = useAdminCategories();
  const [creating, setCreating] = useState<null | { parentId: string | null }>(
    null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);

  const topLevel = categories.filter((c) => !c.parentId);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Categories</h1>
          <p className="mt-1 text-sm text-slate-500">
            Main catalogue taxonomy. Two levels supported — top-level and
            sub-categories.
          </p>
        </div>
        <button
          onClick={() => setCreating({ parentId: null })}
          className={cn(submitClass, "inline-flex items-center gap-1.5")}
        >
          <Plus className="h-4 w-4" /> New top-level
        </button>
      </div>

      {isLoading && (
        <div className="rounded-card border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Loading…
        </div>
      )}

      {!isLoading && topLevel.length === 0 && !creating && (
        <div className="rounded-card border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No categories yet. Click{" "}
          <span className="font-medium">New top-level</span> to create the first
          one.
        </div>
      )}

      <div className="space-y-4">
        {creating?.parentId === null && (
          <CategoryForm
            parentId={null}
            allCategories={categories}
            onClose={() => setCreating(null)}
          />
        )}

        {topLevel.map((top) => {
          const children = categories.filter((c) => c.parentId === top.id);
          return (
            <CategoryCard
              key={top.id}
              category={top}
              children={children}
              editingId={editingId}
              creating={creating}
              onEdit={setEditingId}
              onAddSub={() => setCreating({ parentId: top.id })}
              onCloseCreate={() => setCreating(null)}
              onCloseEdit={() => setEditingId(null)}
              allCategories={categories}
            />
          );
        })}
      </div>
    </div>
  );
}

function CategoryCard({
  category,
  children,
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
    <section className="overflow-hidden rounded-card border border-slate-200 bg-white">
      <CategoryRow
        category={category}
        isTop
        expanded={expanded}
        toggleExpanded={() => setExpanded(!expanded)}
        showToggle={children.length > 0}
        isEditing={isEditing}
        onEdit={() => onEdit(isEditing ? null : category.id)}
      />

      {isEditing && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-4">
          <CategoryForm
            existing={category}
            allCategories={allCategories}
            onClose={onCloseEdit}
          />
        </div>
      )}

      {expanded && (
        <div className="divide-y divide-slate-100 border-t border-slate-100">
          {children.map((child) => {
            const childEditing = editingId === child.id;
            return (
              <div key={child.id}>
                <CategoryRow
                  category={child}
                  isTop={false}
                  isEditing={childEditing}
                  onEdit={() => onEdit(childEditing ? null : child.id)}
                />
                {childEditing && (
                  <div className="bg-slate-50/60 p-4">
                    <CategoryForm
                      existing={child}
                      allCategories={allCategories}
                      onClose={onCloseEdit}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {creating?.parentId === category.id ? (
            <div className="bg-slate-50/60 p-4">
              <CategoryForm
                parentId={category.id}
                allCategories={allCategories}
                onClose={onCloseCreate}
              />
            </div>
          ) : (
            <button
              onClick={onAddSub}
              className="flex w-full items-center gap-1.5 px-4 py-2 text-left text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-brand-500"
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
  expanded,
  toggleExpanded,
  showToggle,
  isEditing,
  onEdit,
}: {
  category: AdminCategory;
  isTop: boolean;
  expanded?: boolean;
  toggleExpanded?: () => void;
  showToggle?: boolean;
  isEditing: boolean;
  onEdit: () => void;
}) {
  const update = useUpdateCategory();
  const del = useDeleteCategory();

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 transition",
        isTop ? "bg-slate-50/40" : "pl-12",
        isEditing && "bg-brand-100/30",
      )}
    >
      {isTop && (
        <button
          type="button"
          onClick={toggleExpanded}
          className={cn(
            "-ml-1 rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700",
            !showToggle && "invisible",
          )}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      )}

      <Thumbnail url={category.imageUrl} />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate font-medium text-slate-900",
            isTop ? "text-base" : "text-sm",
          )}
        >
          {category.name}
        </p>
        <p className="truncate text-xs text-slate-500">
          /{category.slug}
          {category.productCount > 0 && (
            <span className="ml-2">
              · {category.productCount} product
              {category.productCount === 1 ? "" : "s"}
            </span>
          )}
          {isTop && category.childCount > 0 && (
            <span className="ml-2">
              · {category.childCount} sub{category.childCount === 1 ? "" : "s"}
            </span>
          )}
        </p>
      </div>

      <label
        className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex"
        title="Active"
      >
        <input
          type="checkbox"
          checked={category.isActive}
          onChange={(e) =>
            update.mutate({ id: category.id, isActive: e.target.checked })
          }
          className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
        />
        Active
      </label>

      <input
        type="number"
        defaultValue={category.sortOrder}
        onBlur={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n) && n !== category.sortOrder) {
            update.mutate({ id: category.id, sortOrder: n });
          }
        }}
        className={cn(inputClass, "w-16 py-1.5 text-center text-xs")}
        title="Sort order"
      />

      <button
        onClick={onEdit}
        className={cn(
          "rounded-md border border-slate-200 p-1.5 text-slate-500 transition hover:border-brand-500 hover:text-brand-500",
          isEditing && "border-brand-500 text-brand-500",
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
              onError: (err) =>
                alert(err instanceof Error ? err.message : "Delete failed"),
            });
          }
        }}
        className="rounded-md border border-slate-200 p-1.5 text-slate-500 transition hover:border-brand-500 hover:text-brand-500"
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
      className="h-10 w-10 shrink-0 rounded-md object-cover ring-1 ring-slate-200"
    />
  ) : (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-medium uppercase text-slate-400">
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

  const [name, setName] = useState(existing?.name ?? "");
  const [slug, setSlug] = useState(existing?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!existing);
  const [description, setDescription] = useState(existing?.description ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(
    existing?.imageUrl ?? null,
  );
  const [selectedParent, setSelectedParent] = useState<string | null>(
    existing ? existing.parentId : (parentId ?? null),
  );
  const [sortOrder, setSortOrder] = useState(existing?.sortOrder ?? 0);
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autoSlug = slugify(name);
  if (!slugTouched && autoSlug !== slug) {
    setTimeout(() => setSlug(autoSlug), 0);
  }

  const topLevelOptions = allCategories.filter(
    (c) => !c.parentId && c.id !== existing?.id,
  );

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

    const payload = {
      name: name.trim(),
      slug,
      description: description.trim() || null,
      imageUrl,
      parentId: selectedParent,
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
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Slug
          </span>
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
        <span className="mb-1 block text-xs font-medium text-slate-600">
          Description
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={textareaClass}
          placeholder="Shown on the category landing page."
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Parent
          </span>
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

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Sort
          </span>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className={cn(inputClass, "w-20")}
          />
        </label>

        <label className="flex flex-col items-start">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Active
          </span>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="mt-2 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
          />
        </label>
      </div>

      <div>
        <span className="mb-1 block text-xs font-medium text-slate-600">
          Image
        </span>
        <div className="flex items-center gap-3">
          <Thumbnail url={imageUrl} />
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => handleImage(e.target.files?.[0] ?? null)}
            className="block text-xs text-slate-600 file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-slate-200 file:bg-white file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-50"
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
          {uploading && (
            <span className="text-xs text-slate-500">Uploading…</span>
          )}
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

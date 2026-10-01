import { useMemo, useRef, useState } from "react";
import { Check, ImagePlus, Plus, Trash2, X } from "lucide-react";
import {
  useAdminAddons,
  useCreateAddon,
  useDeleteAddon,
  useUpdateAddon,
  type AdminAddon,
} from "@/hooks/useAddons";
import { useAdminCategories, type AdminCategory } from "@/hooks/useAdminCategories";
import type { ProductTemplate } from "@/hooks/useAdminProducts";
import { NestedCategoryMultiSelect } from "@/components/form/NestedCategoryMultiSelect";
import { uploadImage } from "@/lib/uploads";
import { cn } from "@/lib/cn";
import { Field, inputClass, submitClass } from "@/components/form/Field";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function AddonsPage() {
  const { data: addons = [], isLoading } = useAdminAddons();
  const { data: categories = [] } = useAdminCategories();
  const [adding, setAdding] = useState(false);
  const groups = useMemo(() => {
    const map = new Map<string, AdminAddon[]>();
    for (const addon of addons) {
      const key = addon.group || "Other";
      const list = map.get(key) ?? [];
      list.push(addon);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [addons]);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-slate-900">Add-ons</h1>
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className={cn(submitClass, "inline-flex shrink-0 items-center gap-1.5")}
            >
              <Plus className="h-4 w-4" /> Add add-on
            </button>
          )}
        </div>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Extras like candles and toppers. Default categories pre-select them on new products.
          &ldquo;Offline custom items&rdquo; picks which custom Cake / Pizza / Other items in
          offline orders can add them; types marked &ldquo;auto&rdquo; come from the products
          they&rsquo;re linked to.
        </p>
      </div>

      {adding && (
        <div className="mb-6">
          <NewAddonRow categories={categories} onClose={() => setAdding(false)} />
        </div>
      )}

      <div className="space-y-6">
        {isLoading && (
          <div className="rounded-card border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Loading…
          </div>
        )}
        {!isLoading && addons.length === 0 && (
          <div className="rounded-card border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            No add-ons yet.
          </div>
        )}
        {groups.map(([group, rows]) => (
          <div
            key={group}
            className="overflow-hidden rounded-card border border-slate-200 bg-white"
          >
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium tracking-wide text-slate-500 uppercase">
              {group}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="w-16 px-4 py-2 font-medium">Photo</th>
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="w-32 px-4 py-2 text-right font-medium">Price (₹)</th>
                    <th className="w-24 px-4 py-2 text-center font-medium">Active</th>
                    <th className="w-14 px-4 py-2 text-right font-medium">
                      <span className="sr-only">Delete</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((addon) => (
                    <AddonRow key={addon.id} addon={addon} categories={categories} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewAddonRow({
  categories,
  onClose,
}: {
  categories: AdminCategory[];
  onClose: () => void;
}) {
  const create = useCreateAddon();
  const [name, setName] = useState("");
  const [group, setGroup] = useState("Candles");
  const [priceDelta, setPriceDelta] = useState("0");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [customTemplates, setCustomTemplates] = useState<ProductTemplate[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && group.trim().length > 0;

  const submit = async () => {
    setError(null);
    try {
      await create.mutateAsync({
        name: name.trim(),
        slug: slugify(name),
        group: group.trim(),
        priceDelta: Number(priceDelta) || 0,
        imageUrl,
        categoryIds,
        customTemplates,
      });
      setName("");
      setPriceDelta("0");
      setImageUrl(null);
      setCategoryIds([]);
      setCustomTemplates([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  const addButton = (
    <button
      type="button"
      disabled={!canSubmit || create.isPending || uploading}
      onClick={submit}
      className={cn(submitClass, "inline-flex w-full items-center justify-center gap-1 sm:w-auto")}
    >
      <Plus className="h-4 w-4" /> Add
    </button>
  );

  return (
    <div className="rounded-card border border-slate-200 bg-white p-4 shadow-md">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">New add-on</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-[auto_1.2fr_2fr_1fr_auto]">
        <div>
          <span className="mb-1 block text-xs font-medium tracking-wide text-slate-500 uppercase">
            Photo
          </span>
          <AddonPhotoPicker
            url={imageUrl}
            uploading={uploading}
            onUploading={setUploading}
            onChange={setImageUrl}
            onError={setError}
          />
        </div>
        <Field label="Group">
          <input
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            placeholder="Candles"
            className={inputClass}
          />
        </Field>
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Number candle 5"
            className={inputClass}
          />
        </Field>
        <Field label="Price (₹)">
          <input
            type="number"
            min={0}
            step="0.01"
            value={priceDelta}
            onChange={(e) => setPriceDelta(e.target.value)}
            className={inputClass}
          />
        </Field>
        <div className="hidden self-end sm:block">{addButton}</div>
      </div>
      <div className="mt-3">
        <span className="mb-1.5 block text-xs font-medium tracking-wide text-slate-500 uppercase">
          Default for categories
        </span>
        <NestedCategoryMultiSelect
          categories={categories}
          selected={categoryIds}
          onChange={setCategoryIds}
        />
      </div>
      <CustomItemTypes
        className="mt-3"
        selected={customTemplates}
        auto={[]}
        onChange={setCustomTemplates}
      />
      <div className="mt-4 sm:hidden">{addButton}</div>
      {error && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

function AddonRow({ addon, categories }: { addon: AdminAddon; categories: AdminCategory[] }) {
  const update = useUpdateAddon();
  const del = useDeleteAddon();
  const [amount, setAmount] = useState<string>(Number(addon.priceDelta).toString());
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inUse = addon.productCount > 0;

  const commit = async () => {
    const parsed = Number(amount);
    if (Number.isNaN(parsed) || parsed < 0) return;
    await update.mutateAsync({ id: addon.id, priceDelta: parsed });
    setDirty(false);
  };

  const onDelete = async () => {
    setError(null);
    if (inUse) {
      setError(
        `Used by ${addon.productCount} product${addon.productCount === 1 ? "" : "s"}. Remove it from those products first, or turn Active off.`,
      );
      return;
    }
    if (!confirm(`Delete add-on “${addon.name}”? This cannot be undone.`)) return;
    try {
      await del.mutateAsync(addon.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-2 align-top">
        <AddonPhotoPicker
          url={addon.imageUrl}
          uploading={uploading}
          onUploading={setUploading}
          onChange={(url) => update.mutate({ id: addon.id, imageUrl: url })}
          onError={() => undefined}
        />
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-slate-900">{addon.name}</p>
        <p className="text-xs text-slate-500">/{addon.slug}</p>
        {inUse && (
          <p className="mt-0.5 text-[11px] text-slate-400">
            On {addon.productCount} product{addon.productCount === 1 ? "" : "s"}
          </p>
        )}
        {error && <p className="mt-1 text-xs text-brand-700">{error}</p>}
        <div className="mt-2">
          <NestedCategoryMultiSelect
            categories={categories}
            selected={addon.categoryIds ?? []}
            onChange={(categoryIds) => update.mutate({ id: addon.id, categoryIds })}
          />
        </div>
        <CustomItemTypes
          className="mt-2"
          selected={addon.customTemplates ?? []}
          auto={addon.autoTemplates ?? []}
          disabled={update.isPending}
          onChange={(customTemplates) => update.mutate({ id: addon.id, customTemplates })}
        />
      </td>
      <td className="px-4 py-2 text-right">
        <input
          type="number"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setDirty(true);
          }}
          onBlur={() => dirty && commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="w-24 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-right text-sm text-slate-900 tabular-nums outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
      </td>
      <td className="px-4 py-3 text-center">
        <label className="inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={addon.isActive}
            onChange={(e) => update.mutate({ id: addon.id, isActive: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
          />
        </label>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={() => void onDelete()}
          disabled={del.isPending}
          title={
            inUse
              ? `Used by ${addon.productCount} product(s) — remove from products or deactivate`
              : `Delete “${addon.name}”`
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

const CUSTOM_TYPES: { key: ProductTemplate; label: string }[] = [
  { key: "CAKE", label: "Cake" },
  { key: "PIZZA", label: "Pizza" },
  { key: "OTHER", label: "Other" },
];

/** Which offline custom-item types (Cake / Pizza / Other) can pick this add-on. */
function CustomItemTypes({
  selected,
  auto,
  onChange,
  disabled,
  className,
}: {
  selected: ProductTemplate[];
  /** Already offered through linked products; shown ticked and locked. */
  auto: ProductTemplate[];
  onChange: (next: ProductTemplate[]) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span
        className="mr-0.5 text-[11px] font-medium tracking-wide text-slate-500 uppercase"
        title="Staff can pick this add-on on custom items of these types in offline orders"
      >
        Offline custom items
      </span>
      {CUSTOM_TYPES.map(({ key, label }) => {
        const isAuto = auto.includes(key);
        const on = isAuto || selected.includes(key);
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            disabled={disabled || isAuto}
            title={
              isAuto
                ? `Already offered — it's linked to ${label.toLowerCase()} products`
                : on
                  ? `Stop offering on custom ${label.toLowerCase()} items`
                  : `Offer on custom ${label.toLowerCase()} items`
            }
            onClick={() => onChange(on ? selected.filter((t) => t !== key) : [...selected, key])}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition",
              on
                ? "border-brand-500 bg-brand-100 text-brand-700"
                : "hover:border-brand-300 border-slate-200 bg-white text-slate-600",
              isAuto && "cursor-default opacity-70",
              disabled && !isAuto && "opacity-60",
            )}
          >
            {on && <Check className="h-3 w-3" />}
            {label}
            {isAuto && <span className="text-[10px] font-normal text-brand-600/80">auto</span>}
          </button>
        );
      })}
    </div>
  );
}

function AddonPhotoPicker({
  url,
  uploading,
  onUploading,
  onChange,
  onError,
}: {
  url: string | null;
  uploading: boolean;
  onUploading: (v: boolean) => void;
  onChange: (url: string | null) => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = async (file: File | null) => {
    if (!file) return;
    onUploading(true);
    try {
      const res = await uploadImage(file, "addon");
      onChange(res.publicUrl);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      onUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title={url ? "Replace photo" : "Upload photo"}
        className="hover:border-brand-300 relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-slate-400 transition hover:text-brand-500 disabled:opacity-60"
      >
        {url ? (
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <ImagePlus className="h-4 w-4" />
          </span>
        )}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-[10px] font-medium text-slate-600">
            …
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0] ?? null)}
      />
      {url && (
        <button
          type="button"
          onClick={() => onChange(null)}
          title="Remove photo"
          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

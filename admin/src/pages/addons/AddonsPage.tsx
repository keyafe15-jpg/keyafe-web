import { useMemo, useRef, useState } from "react";
import { ImagePlus, Plus, X } from "lucide-react";
import {
  useAdminAddons,
  useCreateAddon,
  useUpdateAddon,
  type AdminAddon,
} from "@/hooks/useAddons";
import { useAdminCategories, type AdminCategory } from "@/hooks/useAdminCategories";
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
        <h1 className="text-2xl font-semibold text-slate-900">Add-ons</h1>
        <p className="mt-1 text-sm text-slate-500">
          Shared extras (candles, toppers, pizza extras). Assign default
          categories so new products in those categories get the add-on
          pre-selected.
        </p>
      </div>

      <NewAddonRow categories={categories} />

      <div className="mt-4 space-y-6">
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
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              {group}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-16 px-4 py-2 font-medium">Photo</th>
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="w-32 px-4 py-2 text-right font-medium">
                      Price (₹)
                    </th>
                    <th className="w-24 px-4 py-2 text-center font-medium">
                      Active
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((addon) => (
                    <AddonRow
                      key={addon.id}
                      addon={addon}
                      categories={categories}
                    />
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
}: {
  categories: AdminCategory[];
}) {
  const create = useCreateAddon();
  const [name, setName] = useState("");
  const [group, setGroup] = useState("Candles");
  const [priceDelta, setPriceDelta] = useState("0");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
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
      });
      setName("");
      setPriceDelta("0");
      setImageUrl(null);
      setCategoryIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  return (
    <div className="rounded-card border border-slate-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-[auto_1.2fr_2fr_1fr_auto]">
        <div>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
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
        <Field label="New add-on">
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
        <div className="self-end">
          <button
            type="button"
            disabled={!canSubmit || create.isPending || uploading}
            onClick={submit}
            className={cn(submitClass, "inline-flex items-center gap-1")}
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>
      <div className="mt-3">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
          Default for categories
        </span>
        <NestedCategoryMultiSelect
          categories={categories}
          selected={categoryIds}
          onChange={setCategoryIds}
        />
      </div>
      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function AddonRow({
  addon,
  categories,
}: {
  addon: AdminAddon;
  categories: AdminCategory[];
}) {
  const update = useUpdateAddon();
  const [amount, setAmount] = useState<string>(
    Number(addon.priceDelta).toString(),
  );
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);

  const commit = async () => {
    const parsed = Number(amount);
    if (Number.isNaN(parsed) || parsed < 0) return;
    await update.mutateAsync({ id: addon.id, priceDelta: parsed });
    setDirty(false);
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
        <div className="mt-2">
          <NestedCategoryMultiSelect
            categories={categories}
            selected={addon.categoryIds ?? []}
            onChange={(categoryIds) =>
              update.mutate({ id: addon.id, categoryIds })
            }
          />
        </div>
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
          className="w-24 rounded-md border border-slate-200 bg-white py-1.5 px-2 text-right text-sm tabular-nums text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
      </td>
      <td className="px-4 py-3 text-center">
        <label className="inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={addon.isActive}
            onChange={(e) =>
              update.mutate({ id: addon.id, isActive: e.target.checked })
            }
            className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
          />
        </label>
      </td>
    </tr>
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
        className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-slate-400 transition hover:border-brand-300 hover:text-brand-500 disabled:opacity-60"
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

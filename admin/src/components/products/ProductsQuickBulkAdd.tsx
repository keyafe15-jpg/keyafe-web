import { useId, useMemo, useState } from "react";
import { Cake, Pizza, Plus, Sparkles, Trash2 } from "lucide-react";
import { Field, inputClass, selectClass, submitClass } from "@/components/form/Field";
import { MultiImageUpload } from "@/components/form/MultiImageUpload";
import { NestedCategoryMultiSelect } from "@/components/form/NestedCategoryMultiSelect";
import { CategoryQuickAdd } from "@/components/products/ProductQuickAdds";
import {
  useBulkCreateProducts,
  type BulkProductImportRow,
  type ProductOptionInput,
  type ProductTemplate,
} from "@/hooks/useAdminProducts";
import { useAdminCategories } from "@/hooks/useAdminCategories";
import { uploadImages } from "@/lib/uploads";
import { cn } from "@/lib/cn";

type QuickRow = {
  key: string;
  name: string;
  slug: string;
  categoryIds: string[];
  basePrice: string;
  template: ProductTemplate;
  productType: "FIXED_VARIANTS" | "CONFIGURABLE";
  shortDescription: string;
  imageFiles: File[];
  sizeOptions: ProductOptionInput[];
  crustOptions: ProductOptionInput[];
  isEggless: boolean;
  isSpicy: boolean;
  sellByPound: boolean;
  allowCustomSize: boolean;
  supportsMessageOnCake: boolean;
  supportsSameDayDelivery: boolean;
  canBeDeliveredPanIndia: boolean;
  isActive: boolean;
  isAvailable: boolean;
  isFeatured: boolean;
  gstRate: string;
};

function emptyOption(sortOrder: number): ProductOptionInput {
  return {
    key: "",
    label: "",
    price: 0,
    diameterMm: null,
    isDefault: sortOrder === 0,
    isActive: true,
    sortOrder,
  };
}

function defaultPizzaSizes(): ProductOptionInput[] {
  return [
    { key: "6in", label: '6"', price: 0, diameterMm: 152, isDefault: true, isActive: true, sortOrder: 0 },
    { key: "8in", label: '8"', price: 0, diameterMm: 203, isDefault: false, isActive: true, sortOrder: 1 },
    { key: "10in", label: '10"', price: 0, diameterMm: 254, isDefault: false, isActive: true, sortOrder: 2 },
  ];
}

function newRow(): QuickRow {
  return {
    key: crypto.randomUUID(),
    name: "",
    slug: "",
    categoryIds: [],
    basePrice: "",
    template: "CAKE",
    productType: "CONFIGURABLE",
    shortDescription: "",
    imageFiles: [],
    sizeOptions: [],
    crustOptions: [],
    isEggless: true,
    isSpicy: false,
    sellByPound: true,
    allowCustomSize: false,
    supportsMessageOnCake: false,
    supportsSameDayDelivery: false,
    canBeDeliveredPanIndia: false,
    isActive: true,
    isAvailable: true,
    isFeatured: false,
    gstRate: "5",
  };
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function sizeKeyFromLabel(label: string): string {
  const m = label.match(/(\d+)/);
  if (m) return `${m[1]}in`;
  return slugify(label) || "size";
}

function crustKeyFromLabel(label: string): string {
  return slugify(label) || "crust";
}

function Flag({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500/30"
      />
      {label}
    </label>
  );
}

function TemplateChip({
  active,
  onClick,
  icon,
  title,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold transition",
        active
          ? "border-brand-500 bg-brand-50 text-brand-800 ring-1 ring-brand-500/30"
          : "border-slate-200 bg-white text-slate-600 hover:border-brand-300",
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded",
          active ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-500",
        )}
      >
        {icon}
      </span>
      {title}
    </button>
  );
}

function patchForTemplate(template: ProductTemplate): Partial<QuickRow> {
  if (template === "CAKE") {
    return {
      template,
      sellByPound: true,
      allowCustomSize: false,
      supportsMessageOnCake: false,
      isSpicy: false,
      sizeOptions: [],
      crustOptions: [],
      basePrice: "",
    };
  }
  if (template === "PIZZA") {
    return {
      template,
      sellByPound: false,
      allowCustomSize: false,
      supportsMessageOnCake: false,
      isEggless: true,
      sizeOptions: defaultPizzaSizes(),
      crustOptions: [],
      basePrice: "0",
    };
  }
  return {
    template,
    sellByPound: false,
    allowCustomSize: false,
    supportsMessageOnCake: false,
    sizeOptions: [],
    crustOptions: [],
  };
}

function normalizeOptions(options: ProductOptionInput[], suggestKey: (label: string) => string) {
  return options
    .filter((o) => o.label.trim())
    .map((o, i) => ({
      ...o,
      label: o.label.trim(),
      key: o.key.trim() || suggestKey(o.label),
      price: Number.isFinite(o.price) ? o.price : 0,
      sortOrder: i,
      isDefault: i === 0 ? true : o.isDefault,
      isActive: true,
    }));
}

function CompactOptions({
  title,
  priceLabel,
  options,
  onChange,
  labelPlaceholder,
  suggestKey,
  showDiameter,
}: {
  title: string;
  priceLabel: string;
  options: ProductOptionInput[];
  onChange: (next: ProductOptionInput[]) => void;
  labelPlaceholder: string;
  suggestKey: (label: string) => string;
  showDiameter?: boolean;
}) {
  const patch = (idx: number, partial: Partial<ProductOptionInput>) => {
    onChange(options.map((o, i) => (i === idx ? { ...o, ...partial } : o)));
  };

  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">
          {title}
        </span>
        <button
          type="button"
          onClick={() => onChange([...options, emptyOption(options.length)])}
          className="text-[11px] font-medium text-brand-700 hover:underline"
        >
          + Add
        </button>
      </div>
      {options.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-400">
          None yet
        </p>
      ) : (
        <div className="space-y-1">
          <div
            className={cn(
              "grid gap-1 px-0.5 text-[9px] font-medium tracking-wide text-slate-400 uppercase",
              showDiameter ? "grid-cols-[1fr_4.5rem_3.5rem_1.5rem]" : "grid-cols-[1fr_4.5rem_1.5rem]",
            )}
          >
            <span>Label</span>
            <span>{priceLabel}</span>
            {showDiameter && <span>mm</span>}
            <span />
          </div>
          {options.map((opt, idx) => (
            <div
              key={idx}
              className={cn(
                "grid items-center gap-1",
                showDiameter
                  ? "grid-cols-[1fr_4.5rem_3.5rem_1.5rem]"
                  : "grid-cols-[1fr_4.5rem_1.5rem]",
              )}
            >
              <input
                value={opt.label}
                onChange={(e) => {
                  const label = e.target.value;
                  const next: Partial<ProductOptionInput> = { label };
                  if (!opt.key || opt.key === suggestKey(opt.label)) {
                    next.key = suggestKey(label);
                  }
                  patch(idx, next);
                }}
                placeholder={labelPlaceholder}
                className={cn(inputClass, "px-2 py-1 text-xs")}
              />
              <input
                type="number"
                min={0}
                step="1"
                value={opt.price || ""}
                onChange={(e) =>
                  patch(idx, { price: e.target.value === "" ? 0 : Number(e.target.value) })
                }
                placeholder="0"
                className={cn(inputClass, "px-2 py-1 text-xs tabular-nums")}
              />
              {showDiameter && (
                <input
                  type="number"
                  min={1}
                  value={opt.diameterMm ?? ""}
                  onChange={(e) =>
                    patch(idx, {
                      diameterMm: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="—"
                  className={cn(inputClass, "px-2 py-1 text-xs tabular-nums")}
                />
              )}
              <button
                type="button"
                onClick={() => onChange(options.filter((_, i) => i !== idx))}
                className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                aria-label="Remove option"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function rowToImport(
  row: QuickRow,
  imageUrls: string[],
  slugById: Map<string, string>,
): BulkProductImportRow | { error: string } {
  const name = row.name.trim();
  if (name.length < 2) return { error: "Name is required (min 2 characters)" };
  if (row.categoryIds.length === 0) return { error: "Pick at least one category" };
  const categorySlugs: string[] = [];
  for (const id of row.categoryIds) {
    const slug = slugById.get(id);
    if (!slug) return { error: "Unknown category selected — refresh and try again" };
    if (!categorySlugs.includes(slug)) categorySlugs.push(slug);
  }
  const basePrice = Number(row.basePrice || 0);
  if (!Number.isFinite(basePrice) || basePrice < 0) return { error: "Enter a valid price" };
  const slug = row.slug.trim() || slugify(name);
  if (slug && !/^[a-z0-9-]+$/.test(slug)) {
    return { error: "Slug must be lowercase letters, digits, hyphens" };
  }
  const gstRate = Number(row.gstRate);
  const isCake = row.template === "CAKE";
  const isPizza = row.template === "PIZZA";
  const sizeOptions = isPizza
    ? normalizeOptions(row.sizeOptions, sizeKeyFromLabel)
    : undefined;
  const crustOptions = isPizza
    ? normalizeOptions(row.crustOptions, crustKeyFromLabel)
    : undefined;
  if (isPizza && (!sizeOptions || sizeOptions.length === 0)) {
    return { error: "Add at least one pizza size" };
  }
  return {
    name,
    slug: slug || null,
    categorySlugs,
    basePrice,
    template: row.template,
    productType: row.productType,
    shortDescription: row.shortDescription.trim() || null,
    images: imageUrls,
    gstRate: Number.isFinite(gstRate) ? gstRate : 5,
    hsnCode: "1905",
    isEggless: row.isEggless,
    isSpicy: row.isSpicy,
    sellByPound: isCake ? row.sellByPound : false,
    allowCustomSize: isCake ? row.allowCustomSize : false,
    supportsMessageOnCake: isCake ? row.supportsMessageOnCake : false,
    supportsSameDayDelivery: row.supportsSameDayDelivery,
    canBeDeliveredPanIndia: row.canBeDeliveredPanIndia,
    isActive: row.isActive,
    isAvailable: row.isAvailable,
    isFeatured: row.isFeatured,
    sizeOptions,
    crustOptions,
  };
}

export function ProductsQuickBulkAdd({ onDone }: { onDone?: () => void }) {
  const formId = useId();
  const { data: categories = [] } = useAdminCategories();
  const slugById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.slug] as const)),
    [categories],
  );
  const bulk = useBulkCreateProducts();
  const [rows, setRows] = useState<QuickRow[]>(() => [newRow()]);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const update = (key: string, patch: Partial<QuickRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const remove = (key: string) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)));
  };

  const submit = async () => {
    setResultMsg(null);
    setErrorMsg(null);
    const filled = rows.filter(
      (r) =>
        r.name.trim() ||
        r.basePrice.trim() ||
        r.categoryIds.length ||
        r.imageFiles.length ||
        r.sizeOptions.some((o) => o.label.trim()),
    );
    if (filled.length === 0) {
      setErrorMsg("Add at least one product.");
      return;
    }

    const parsed: BulkProductImportRow[] = [];
    try {
      setUploading(true);
      for (let i = 0; i < filled.length; i++) {
        const row = filled[i]!;
        let imageUrls: string[] = [];
        if (row.imageFiles.length > 0) {
          const uploaded = await uploadImages(row.imageFiles, "product");
          imageUrls = uploaded.map((u) => u.publicUrl);
        }
        const out = rowToImport(row, imageUrls, slugById);
        if ("error" in out) {
          setErrorMsg(`Product ${i + 1}: ${out.error}`);
          return;
        }
        parsed.push(out);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Image upload failed");
      return;
    } finally {
      setUploading(false);
    }

    try {
      const result = await bulk.mutateAsync({ rows: parsed, mode: "create" });
      const hint =
        result.errors.length > 0
          ? ` ${result.errors.length} issue(s): ${result.errors
              .slice(0, 3)
              .map((e) => `row ${e.row} ${e.message}`)
              .join("; ")}${result.errors.length > 3 ? "…" : ""}`
          : "";
      setResultMsg(`Created ${result.created}, skipped ${result.skipped}.${hint}`);
      if (result.created > 0) {
        setRows([newRow()]);
        onDone?.();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not create products");
    }
  };

  const busy = bulk.isPending || uploading;

  return (
    <div className="space-y-2.5">
      <div className="space-y-2.5">
        {rows.map((row, index) => (
          <div
            key={row.key}
            className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500">#{index + 1}</span>
                <TemplateChip
                  active={row.template === "CAKE"}
                  onClick={() => update(row.key, patchForTemplate("CAKE"))}
                  icon={<Cake className="h-3 w-3" />}
                  title="Cake"
                />
                <TemplateChip
                  active={row.template === "PIZZA"}
                  onClick={() => update(row.key, patchForTemplate("PIZZA"))}
                  icon={<Pizza className="h-3 w-3" />}
                  title="Pizza"
                />
                <TemplateChip
                  active={row.template === "OTHER"}
                  onClick={() => update(row.key, patchForTemplate("OTHER"))}
                  icon={<Sparkles className="h-3 w-3" />}
                  title="Other"
                />
              </div>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(row.key)}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-12">
              <Field label="Name" required className="col-span-2 lg:col-span-5">
                <input
                  className={cn(inputClass, "py-1.5")}
                  value={row.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const patch: Partial<QuickRow> = { name };
                    if (!row.slug || row.slug === slugify(row.name)) {
                      patch.slug = slugify(name);
                    }
                    update(row.key, patch);
                  }}
                  placeholder={
                    row.template === "PIZZA"
                      ? "e.g. Margherita"
                      : row.template === "OTHER"
                        ? "e.g. Brownie Box"
                        : "e.g. Chocolate Truffle Cake"
                  }
                />
              </Field>
              <Field label="Slug" className="col-span-1 lg:col-span-3">
                <input
                  className={cn(inputClass, "py-1.5")}
                  value={row.slug}
                  onChange={(e) => update(row.key, { slug: e.target.value })}
                  placeholder="auto"
                />
              </Field>
              <Field
                label={row.template === "PIZZA" ? "Base ₹" : "Price ₹"}
                required={row.template !== "PIZZA"}
                className="col-span-1 lg:col-span-2"
              >
                <input
                  type="number"
                  min={0}
                  step="1"
                  className={cn(inputClass, "py-1.5")}
                  value={row.basePrice}
                  onChange={(e) => update(row.key, { basePrice: e.target.value })}
                  placeholder={row.template === "PIZZA" ? "0" : "799"}
                />
              </Field>
              <Field label="GST %" className="col-span-1 lg:col-span-2">
                <input
                  type="number"
                  min={0}
                  max={28}
                  className={cn(inputClass, "py-1.5")}
                  value={row.gstRate}
                  onChange={(e) => update(row.key, { gstRate: e.target.value })}
                />
              </Field>
              <Field label="Type" className="col-span-1 lg:col-span-3">
                <select
                  className={cn(selectClass, "py-1.5")}
                  value={row.productType}
                  onChange={(e) =>
                    update(row.key, {
                      productType: e.target.value as QuickRow["productType"],
                    })
                  }
                >
                  <option value="CONFIGURABLE">Configurable</option>
                  <option value="FIXED_VARIANTS">Fixed variants</option>
                </select>
              </Field>
              <Field label="Short description" className="col-span-2 lg:col-span-9">
                <input
                  className={cn(inputClass, "py-1.5")}
                  value={row.shortDescription}
                  onChange={(e) => update(row.key, { shortDescription: e.target.value })}
                  placeholder="One-line catalogue summary"
                  maxLength={300}
                />
              </Field>
            </div>

            {row.template === "PIZZA" && (
              <div className="mt-2 grid gap-2 rounded-md border border-slate-200 bg-white p-2 lg:grid-cols-2">
                <CompactOptions
                  title="Sizes"
                  priceLabel="₹"
                  options={row.sizeOptions}
                  onChange={(sizeOptions) => update(row.key, { sizeOptions })}
                  labelPlaceholder='e.g. 8"'
                  suggestKey={sizeKeyFromLabel}
                  showDiameter
                />
                <CompactOptions
                  title="Crust (optional)"
                  priceLabel="+₹"
                  options={row.crustOptions}
                  onChange={(crustOptions) => update(row.key, { crustOptions })}
                  labelPlaceholder="Thin / Regular"
                  suggestKey={crustKeyFromLabel}
                />
              </div>
            )}

            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              <div>
                <span className="mb-1 block text-[10px] font-medium tracking-wide text-slate-500 uppercase">
                  Images
                </span>
                <MultiImageUpload
                  value={row.imageFiles}
                  onChange={(files) => update(row.key, { imageFiles: files })}
                  max={5}
                  compact
                />
              </div>
              <div>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">
                    Categories
                    <span aria-hidden="true" className="ml-1 text-brand-500">
                      *
                    </span>
                  </span>
                  <CategoryQuickAdd
                    onCreated={(id) => {
                      setRows((prev) =>
                        prev.map((r) => {
                          if (r.key !== row.key) return r;
                          if (r.categoryIds.includes(id)) return r;
                          return { ...r, categoryIds: [...r.categoryIds, id] };
                        }),
                      );
                    }}
                  />
                </div>
                <NestedCategoryMultiSelect
                  categories={categories}
                  selected={row.categoryIds}
                  onChange={(categoryIds) => update(row.key, { categoryIds })}
                  placeholder="Search or pick…"
                  triggerClassName="py-1.5 text-xs"
                />
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-200/80 pt-1.5">
              <Flag
                checked={row.isEggless}
                onChange={(v) => update(row.key, { isEggless: v })}
                label={row.template === "PIZZA" ? "Veg" : "Eggless"}
              />
              {(row.template === "PIZZA" || row.template === "OTHER") && (
                <Flag
                  checked={row.isSpicy}
                  onChange={(v) => update(row.key, { isSpicy: v })}
                  label="Spicy"
                />
              )}
              {row.template === "CAKE" && (
                <>
                  <Flag
                    checked={row.sellByPound}
                    onChange={(v) => update(row.key, { sellByPound: v })}
                    label="By pound"
                  />
                  <Flag
                    checked={row.allowCustomSize}
                    onChange={(v) => update(row.key, { allowCustomSize: v })}
                    label="Custom lbs"
                  />
                  <Flag
                    checked={row.supportsMessageOnCake}
                    onChange={(v) => update(row.key, { supportsMessageOnCake: v })}
                    label="Message"
                  />
                </>
              )}
              <Flag
                checked={row.supportsSameDayDelivery}
                onChange={(v) => update(row.key, { supportsSameDayDelivery: v })}
                label="Same-day"
              />
              <Flag
                checked={row.canBeDeliveredPanIndia}
                onChange={(v) => update(row.key, { canBeDeliveredPanIndia: v })}
                label="Pan-India"
              />
              <Flag
                checked={row.isActive}
                onChange={(v) => update(row.key, { isActive: v })}
                label="Active"
              />
              <Flag
                checked={row.isAvailable}
                onChange={(v) => update(row.key, { isAvailable: v })}
                label="In stock"
              />
              <Flag
                checked={row.isFeatured}
                onChange={(v) => update(row.key, { isFeatured: v })}
                label="Featured"
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setRows((prev) => [...prev, newRow()])}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-800"
      >
        <Plus className="h-3.5 w-3.5" />
        Add another product
      </button>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          id={formId}
          disabled={busy}
          onClick={() => void submit()}
          className={submitClass}
        >
          {uploading
            ? "Uploading images…"
            : bulk.isPending
              ? "Creating…"
              : `Create ${rows.filter((r) => r.name.trim()).length || rows.length} product${
                  rows.length === 1 ? "" : "s"
                }`}
        </button>
        {errorMsg && <p className="text-xs text-red-700">{errorMsg}</p>}
        {resultMsg && <p className="text-xs text-emerald-700">{resultMsg}</p>}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Cake,
  Pizza,
  Sparkles,
  Save,
  Trash2,
  X,
  Copy,
  Archive,
  ArchiveRestore,
  ChevronDown,
} from "lucide-react";
import {
  Field,
  inputClass,
  selectClass,
  submitClass,
  textareaClass,
} from "@/components/form/Field";
import { MultiImageUpload } from "@/components/form/MultiImageUpload";
import {
  AddonQuickAdd,
  CategoryQuickAdd,
  FlavourQuickAdd,
  TagQuickAdd,
  ToppingQuickAdd,
} from "@/components/products/ProductQuickAdds";
import { NestedCategoryMultiSelect } from "@/components/form/NestedCategoryMultiSelect";
import { SearchableMultiSelect } from "@/components/form/SearchableMultiSelect";
import { useAdminCategories } from "@/hooks/useAdminCategories";
import { useFlavours } from "@/hooks/useFlavours";
import { useTags } from "@/hooks/useTags";
import { useAdminToppings } from "@/hooks/useToppings";
import { useAdminAddons } from "@/hooks/useAddons";
import {
  useAdminProduct,
  useArchiveProduct,
  useCreateProduct,
  useDeleteProduct,
  useDuplicateProduct,
  useUnarchiveProduct,
  useUpdateProduct,
  type ProductOptionInput,
} from "@/hooks/useAdminProducts";
import { uploadImages } from "@/lib/uploads";
import { cn } from "@/lib/cn";
import { useStaffPermission } from "@/lib/permissions";
import { DiscountFields } from "@/components/products/DiscountFields";
import { actualStartingPrice } from "@keyafe/shared";

const formSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, digits and hyphens only"),
  shortDescription: z.string().trim().max(300).optional(),
  description: z.string().trim().optional(),
  categoryIds: z.array(z.string()).min(1, "Pick at least one category"),
  basePrice: z.coerce.number().nonnegative("Enter a valid price"),
  discountedPrice: z
    .union([z.coerce.number().positive("Enter a valid price"), z.literal("")])
    .optional(),
  productType: z.enum(["FIXED_VARIANTS", "CONFIGURABLE"]),
  template: z.enum(["CAKE", "PIZZA", "OTHER"]),
  isCustomizable: z.boolean(),
  isEggless: z.boolean(),
  isSpicy: z.boolean(),
  sellByPound: z.boolean(),
  minGrams: z.union([z.coerce.number().int().positive(), z.literal("")]).optional(),
  maxGrams: z.union([z.coerce.number().int().positive(), z.literal("")]).optional(),
  allowCustomSize: z.boolean(),
  supportsMessageOnCake: z.boolean(),
  messageMaxLength: z.coerce.number().int().positive().max(200),
  supportsSameDayDelivery: z.boolean(),
  leadTimeHours: z.coerce.number().int().nonnegative(),
  canBeDeliveredPanIndia: z.boolean(),
  isHealthyTreat: z.boolean(),
  gstRate: z.coerce.number().min(0).max(28),
  hsnCode: z.string().trim().min(1),
  priceIsGstInclusive: z.boolean(),
  allergensCsv: z.string().trim().optional(),
  metaTitle: z.string().trim().max(70).optional(),
  metaDescription: z.string().trim().max(160).optional(),
  adminNotes: z.string().trim().optional(),
  kitchenNotes: z.string().trim().optional(),
  isActive: z.boolean(),
  isAvailable: z.boolean(),
  isFeatured: z.boolean(),
  sortOrder: z.coerce.number().int(),
});

type FormValues = z.infer<typeof formSchema>;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function ProductFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const viewOnly = !useStaffPermission("products.write");
  const openedFromDuplicate =
    isEdit && Boolean((location.state as { fromDuplicate?: boolean } | null)?.fromDuplicate);

  const { data: categories = [] } = useAdminCategories();
  const { data: flavours = [] } = useFlavours();
  const { data: tags = [] } = useTags();
  const { data: toppingsAll = [] } = useAdminToppings();
  const { data: addonsAll = [] } = useAdminAddons();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const duplicateProduct = useDuplicateProduct();
  const archiveProduct = useArchiveProduct();
  const unarchiveProduct = useUnarchiveProduct();
  const deleteProduct = useDeleteProduct();
  const { data: existing, isLoading: loadingExisting } = useAdminProduct(id);
  const isArchived = Boolean(existing?.archivedAt);

  const [newImages, setNewImages] = useState<File[]>([]);
  const [keptImages, setKeptImages] = useState<string[]>([]);
  const [flavorIds, setFlavorIds] = useState<Set<string>>(new Set());
  const [tagIds, setTagIds] = useState<Set<string>>(new Set());
  const [toppingIds, setToppingIds] = useState<Set<string>>(new Set());
  const [addonIds, setAddonIds] = useState<Set<string>>(new Set());
  const [sizeOptions, setSizeOptions] = useState<ProductOptionInput[]>([]);
  const [crustOptions, setCrustOptions] = useState<ProductOptionInput[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      slug: "",
      shortDescription: "",
      description: "",
      categoryIds: [],
      basePrice: 0,
      discountedPrice: "",
      productType: "CONFIGURABLE",
      template: "CAKE",
      isCustomizable: false,
      isEggless: true,
      isSpicy: false,
      sellByPound: false,
      minGrams: "",
      maxGrams: "",
      allowCustomSize: false,
      supportsMessageOnCake: false,
      messageMaxLength: 40,
      supportsSameDayDelivery: false,
      leadTimeHours: 24,
      canBeDeliveredPanIndia: false,
      isHealthyTreat: false,
      gstRate: 5,
      hsnCode: "1905",
      priceIsGstInclusive: true,
      allergensCsv: "",
      metaTitle: "",
      metaDescription: "",
      adminNotes: "",
      kitchenNotes: "",
      isActive: true,
      isAvailable: true,
      isFeatured: false,
      sortOrder: 0,
    },
  });

  const name = watch("name");
  const slug = watch("slug");
  const template = watch("template");
  const pricedSizes = template === "CAKE" ? [] : sizeOptions.filter((o) => o.isActive);
  const hasSeoOrNotes = Boolean(
    watch("metaTitle") ||
    watch("metaDescription") ||
    watch("allergensCsv") ||
    watch("kitchenNotes") ||
    watch("adminNotes") ||
    errors.metaTitle ||
    errors.metaDescription ||
    errors.allergensCsv,
  );
  const startingPrice = actualStartingPrice(
    Number(watch("basePrice")) || 0,
    pricedSizes.map((o) => Number(o.price)),
  );

  // Auto-populate slug from name while slug hasn't been manually edited.
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const nextAutoSlug = slugify(name);
  if (!slugTouched && nextAutoSlug !== slug) {
    setTimeout(() => setValue("slug", nextAutoSlug), 0);
  }

  useEffect(() => {
    if (!existing) return;
    reset({
      name: existing.name,
      slug: existing.slug,
      shortDescription: existing.shortDescription ?? "",
      description: existing.description ?? "",
      categoryIds: existing.categoryIds ?? [],
      basePrice: Number(existing.basePrice),
      discountedPrice: existing.discountedPrice ?? "",
      productType: existing.productType,
      template: existing.template ?? "CAKE",
      isCustomizable: existing.isCustomizable,
      isEggless: existing.isEggless,
      isSpicy: existing.isSpicy ?? false,
      sellByPound: existing.sellByPound,
      minGrams: existing.minGrams ?? "",
      maxGrams: existing.maxGrams ?? "",
      allowCustomSize: existing.allowCustomSize,
      supportsMessageOnCake: existing.supportsMessageOnCake,
      messageMaxLength: existing.messageMaxLength,
      supportsSameDayDelivery: existing.supportsSameDayDelivery,
      leadTimeHours: existing.leadTimeHours,
      canBeDeliveredPanIndia: existing.canBeDeliveredPanIndia ?? false,
      isHealthyTreat: existing.isHealthyTreat ?? false,
      gstRate: Number(existing.gstRate),
      hsnCode: existing.hsnCode,
      priceIsGstInclusive: existing.priceIsGstInclusive,
      allergensCsv: (existing.allergens ?? []).join(", "),
      metaTitle: existing.metaTitle ?? "",
      metaDescription: existing.metaDescription ?? "",
      adminNotes: existing.adminNotes ?? "",
      kitchenNotes: existing.kitchenNotes ?? "",
      isActive: existing.isActive,
      isAvailable: existing.isAvailable,
      isFeatured: existing.isFeatured,
      sortOrder: existing.sortOrder,
    });
    setKeptImages(existing.images ?? []);
    setFlavorIds(new Set(existing.flavorIds ?? []));
    setTagIds(new Set(existing.tagIds ?? []));
    setToppingIds(new Set(existing.toppingIds ?? []));
    setAddonIds(new Set(existing.addonIds ?? []));
    setSizeOptions((existing.sizeOptions ?? []).map(normalizeOption));
    setCrustOptions((existing.crustOptions ?? []).map(normalizeOption));
  }, [existing, reset]);

  const selectedCategoryIds = watch("categoryIds") ?? [];
  const categoryKey = [...selectedCategoryIds].sort().join(",");
  const editDefaultsArmed = useRef(false);

  useEffect(() => {
    if (isEdit) {
      if (!existing) return;
      if (!editDefaultsArmed.current) {
        editDefaultsArmed.current = true;
        return;
      }
    }
    const selected = new Set(selectedCategoryIds);
    const scope = new Set(selectedCategoryIds);
    for (const category of categories) {
      if (selected.has(category.id) && category.parentId) {
        scope.add(category.parentId);
      }
    }
    setAddonIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const addon of addonsAll) {
        if (!addon.isActive) continue;
        if (!(addon.categoryIds ?? []).some((id) => scope.has(id))) continue;
        if (!next.has(addon.id)) {
          next.add(addon.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [addonsAll, categories, categoryKey, existing, isEdit, selectedCategoryIds]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    const discountedPrice =
      typeof values.discountedPrice === "number" ? values.discountedPrice : null;
    if (discountedPrice != null && discountedPrice >= startingPrice) {
      setError("discountedPrice", {
        message: `Must be lower than the starting price (₹${startingPrice.toFixed(0)})`,
      });
      return;
    }
    try {
      setIsUploading(true);
      const uploaded = newImages.length ? await uploadImages(newImages, "product") : [];
      setIsUploading(false);

      const payload = {
        name: values.name,
        slug: values.slug,
        shortDescription: values.shortDescription || null,
        description: values.description || null,
        categoryIds: values.categoryIds,
        images: [...keptImages, ...uploaded.map((u) => u.publicUrl)],
        basePrice: values.basePrice,
        discountedPrice,
        productType: values.productType,
        template: values.template,
        isCustomizable: values.isCustomizable,
        isEggless: values.isEggless,
        isSpicy: values.isSpicy,
        sellByPound: values.sellByPound,
        minGrams: typeof values.minGrams === "number" ? values.minGrams : null,
        maxGrams: typeof values.maxGrams === "number" ? values.maxGrams : null,
        allowCustomSize: values.allowCustomSize,
        supportsMessageOnCake: values.supportsMessageOnCake,
        messageMaxLength: values.messageMaxLength,
        supportsSameDayDelivery: values.supportsSameDayDelivery,
        leadTimeHours: values.leadTimeHours,
        canBeDeliveredPanIndia: values.canBeDeliveredPanIndia,
        isHealthyTreat: values.isHealthyTreat,
        gstRate: values.gstRate,
        hsnCode: values.hsnCode,
        priceIsGstInclusive: values.priceIsGstInclusive,
        allergens: (values.allergensCsv ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        metaTitle: values.metaTitle || null,
        metaDescription: values.metaDescription || null,
        adminNotes: values.adminNotes || null,
        kitchenNotes: values.kitchenNotes || null,
        isActive: values.isActive,
        isAvailable: values.isAvailable,
        isFeatured: values.isFeatured,
        sortOrder: values.sortOrder,
        flavorIds: [...flavorIds],
        tagIds: [...tagIds],
        toppingIds: [...toppingIds],
        addonIds: [...addonIds],
        sizeOptions: values.template !== "CAKE" ? sizeOptions : undefined,
        crustOptions: values.template === "PIZZA" ? crustOptions : undefined,
      };

      if (isEdit && id) {
        await updateProduct.mutateAsync({ id, ...payload });
      } else {
        await createProduct.mutateAsync(payload);
      }
      navigate("/products", { replace: true });
    } catch (err) {
      setIsUploading(false);
      setSubmitError(err instanceof Error ? err.message : "Failed to save product");
    }
  });

  const busy =
    isSubmitting ||
    isUploading ||
    duplicateProduct.isPending ||
    archiveProduct.isPending ||
    unarchiveProduct.isPending ||
    deleteProduct.isPending;

  const onDuplicate = async () => {
    if (!id || duplicateProduct.isPending) return;
    setSubmitError(null);
    try {
      const created = await duplicateProduct.mutateAsync(id);
      navigate(`/products/${created.id}`, { replace: true, state: { fromDuplicate: true } });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to duplicate product");
    }
  };

  const onArchive = async () => {
    if (!id || !existing) return;
    if (!confirm(`Archive “${existing.name}”? It will leave the storefront catalogue.`)) return;
    setSubmitError(null);
    try {
      await archiveProduct.mutateAsync(id);
      navigate("/products", { replace: true });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to archive product");
    }
  };

  const onUnarchive = async () => {
    if (!id) return;
    setSubmitError(null);
    try {
      await unarchiveProduct.mutateAsync(id);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to unarchive product");
    }
  };

  const onDelete = async () => {
    if (!id || !existing) return;
    if (
      !confirm(
        `Permanently delete “${existing.name}”? Past orders keep their snapshots; this cannot be undone.`,
      )
    ) {
      return;
    }
    setSubmitError(null);
    try {
      await deleteProduct.mutateAsync(id);
      navigate("/products", { replace: true });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to delete product");
    }
  };

  return (
    <form onSubmit={onSubmit} className="pb-24">
      {/* Sticky action bar */}
      <div className="sticky top-14 z-10 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/85 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            {viewOnly ? "Product" : isEdit ? "Edit product" : "New product"}
            {isEdit && (
              <span className="bg-brand-50 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-brand-700">
                {template === "PIZZA" ? (
                  <Pizza className="h-3 w-3" />
                ) : template === "OTHER" ? (
                  <Sparkles className="h-3 w-3" />
                ) : (
                  <Cake className="h-3 w-3" />
                )}
                {template === "PIZZA" ? "Pizza" : template === "OTHER" ? "Other" : "Cake"}
              </span>
            )}
          </h1>
          <p className="truncate text-xs text-slate-500">
            {isEdit
              ? loadingExisting
                ? "Loading…"
                : isArchived
                  ? `Archived — “${existing?.name ?? "…"}”`
                  : viewOnly
                    ? `“${existing?.name ?? "…"}” · view only`
                    : `Editing “${existing?.name ?? "…"}”`
              : "Fill in the details and save."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate("/products")}
            title={viewOnly ? "Back to products" : "Cancel"}
            className={barButtonClass}
          >
            <X className="h-4 w-4" />{" "}
            <span className="hidden sm:inline">{viewOnly ? "Back" : "Cancel"}</span>
          </button>
          {!viewOnly && isEdit && !openedFromDuplicate && !isArchived && (
            <button
              type="button"
              onClick={() => void onDuplicate()}
              disabled={busy || loadingExisting}
              title="Create a draft copy of this product"
              className={barButtonClass}
            >
              <Copy className="h-4 w-4" />
              <span className="hidden sm:inline">
                {duplicateProduct.isPending ? "Duplicating…" : "Duplicate"}
              </span>
            </button>
          )}
          {!viewOnly && isEdit && !isArchived && (
            <button
              type="button"
              onClick={() => void onArchive()}
              disabled={busy || loadingExisting}
              title="Archive"
              className={barButtonClass}
            >
              <Archive className="h-4 w-4" />
              <span className="hidden sm:inline">
                {archiveProduct.isPending ? "Archiving…" : "Archive"}
              </span>
            </button>
          )}
          {!viewOnly && isEdit && isArchived && (
            <button
              type="button"
              onClick={() => void onUnarchive()}
              disabled={busy || loadingExisting}
              title="Unarchive"
              className={barButtonClass}
            >
              <ArchiveRestore className="h-4 w-4" />
              <span className="hidden sm:inline">
                {unarchiveProduct.isPending ? "Restoring…" : "Unarchive"}
              </span>
            </button>
          )}
          {!viewOnly && isEdit && (
            <button
              type="button"
              onClick={() => void onDelete()}
              disabled={busy || loadingExisting}
              title="Delete"
              className={cn(
                barButtonClass,
                "border-red-200 text-red-700 hover:bg-red-50 hover:text-red-700",
              )}
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">
                {deleteProduct.isPending ? "Deleting…" : "Delete"}
              </span>
            </button>
          )}
          {!viewOnly && (
            <button
              type="submit"
              disabled={busy}
              className={cn(submitClass, "inline-flex items-center gap-1.5 py-1.5")}
            >
              <Save className="h-4 w-4" />
              {isUploading
                ? "Uploading…"
                : isSubmitting
                  ? "Saving…"
                  : isEdit
                    ? "Save changes"
                    : "Save product"}
            </button>
          )}
        </div>
      </div>

      {isEdit && isArchived && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This product is archived and hidden from the storefront. Unarchive to restore it as a
          draft, then turn Active on when ready.
        </div>
      )}

      {submitError && (
        <div className="mb-4 rounded-lg border border-brand-500/40 bg-brand-100/50 px-4 py-3 text-sm text-brand-700">
          {submitError}
        </div>
      )}

      <fieldset disabled={viewOnly} className="group grid min-w-0 gap-4 lg:grid-cols-3">
        {/* Left: main details */}
        <div className="space-y-4 lg:col-span-2">
          {!isEdit && (
            <Section
              title="Template"
              description="Drives which extra sections show up below. Can't be changed later."
            >
              <div className="grid grid-cols-3 gap-2">
                <TemplateChip
                  active={template === "CAKE"}
                  onClick={() => setValue("template", "CAKE")}
                  icon={<Cake className="h-4 w-4" />}
                  title="Cake"
                  subtitle="Flavours, pounds, message"
                />
                <TemplateChip
                  active={template === "PIZZA"}
                  onClick={() => setValue("template", "PIZZA")}
                  icon={<Pizza className="h-4 w-4" />}
                  title="Pizza"
                  subtitle="Sizes, crust, toppings"
                />
                <TemplateChip
                  active={template === "OTHER"}
                  onClick={() => setValue("template", "OTHER")}
                  icon={<Sparkles className="h-4 w-4" />}
                  title="Other"
                  subtitle="Plain product"
                />
              </div>
            </Section>
          )}

          <Section title="Basics">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" required error={errors.name?.message}>
                <input {...register("name")} className={inputClass} />
              </Field>
              <Field
                label="Slug"
                required
                error={errors.slug?.message}
                hint="Auto-generated from name."
              >
                <input
                  {...register("slug", { onChange: () => setSlugTouched(true) })}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Short description" error={errors.shortDescription?.message}>
              <input
                {...register("shortDescription")}
                className={inputClass}
                placeholder="One-liner shown on cards"
              />
            </Field>
            <Field
              label="Description"
              error={errors.description?.message}
              hint="Markdown supported. Shown on product page."
            >
              <textarea
                {...register("description")}
                rows={3}
                className={cn(textareaClass, "min-h-0")}
              />
            </Field>
          </Section>

          <Section title="Images">
            {keptImages.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {keptImages.map((url) => (
                  <div
                    key={url}
                    className="group relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200 bg-white"
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setKeptImages(keptImages.filter((u) => u !== url))}
                      className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/70 text-white transition sm:opacity-0 sm:group-hover:opacity-100"
                      aria-label="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <MultiImageUpload
              value={newImages}
              onChange={setNewImages}
              max={Math.max(1, 5 - keptImages.length)}
              compact
            />
          </Section>

          <Section title="Customization" collapseOnMobile>
            <div className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
              <Checkbox
                {...register("isCustomizable")}
                label="Customizable product"
                hint="Option pickers on the storefront."
              />
              <Checkbox
                {...register("isEggless")}
                label="Eggless / vegetarian"
                hint="Green veg mark on the storefront."
              />
              <Checkbox
                {...register("isSpicy")}
                label="Spicy"
                hint="Savoury heat filter (Spicy / Mild)."
              />
              {template === "CAKE" && (
                <>
                  <Checkbox
                    {...register("sellByPound")}
                    label="Sell by pound"
                    hint="(Base + flavour) × lb, −₹50 per extra half-lb."
                  />
                  <Checkbox
                    {...register("allowCustomSize")}
                    label="Allow custom pounds"
                    hint="'Want more pounds?' input on the PDP."
                  />
                  <Checkbox
                    {...register("supportsMessageOnCake")}
                    label="Message on cake"
                    hint="Show the message-on-cake input."
                  />
                </>
              )}
              <Checkbox
                {...register("supportsSameDayDelivery")}
                label="Same-day delivery eligible"
              />
              <Checkbox
                {...register("canBeDeliveredPanIndia")}
                label="Pan-India courier delivery"
                hint="Ships by courier; PDP skips date/slot."
              />
              <Checkbox
                {...register("isHealthyTreat")}
                label="Show in Healthy Treats"
                hint="Listed on the Healthy Treats page."
              />
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-4">
              {template === "CAKE" && (
                <>
                  <Field label="Min grams" error={errors.minGrams?.message}>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      placeholder="No min"
                      title="e.g. 250 hides Bento/Mini for this product"
                      {...register("minGrams")}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Max grams" error={errors.maxGrams?.message}>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      placeholder="No max"
                      title="e.g. 1500 caps at 3 pounds"
                      {...register("maxGrams")}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Message chars" error={errors.messageMaxLength?.message}>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      {...register("messageMaxLength")}
                      className={inputClass}
                    />
                  </Field>
                </>
              )}
              <Field label="Lead time (h)" error={errors.leadTimeHours?.message}>
                <input
                  type="number"
                  min={0}
                  {...register("leadTimeHours")}
                  className={inputClass}
                />
              </Field>
            </div>
          </Section>

          {template === "PIZZA" && (
            <>
              <Section
                title="Sizes"
                description="Inch-based sizes with a customer-visible price for each."
              >
                <OptionsEditor
                  options={sizeOptions}
                  onChange={setSizeOptions}
                  priceMode="ABSOLUTE"
                  suggestKey={(label) => sizeKeyFromLabel(label)}
                  labelPlaceholder='e.g. 8"'
                  keyPlaceholder="8in"
                  showDiameter
                />
              </Section>
              <Section
                title="Crust"
                description="Optional. Leave empty if only one crust."
                collapseOnMobile
              >
                <OptionsEditor
                  options={crustOptions}
                  onChange={setCrustOptions}
                  priceMode="DELTA"
                  suggestKey={(label) =>
                    label
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, "")
                  }
                  labelPlaceholder="Thin / Regular / Stuffed"
                  keyPlaceholder="regular"
                />
              </Section>
              <div className="grid gap-4 md:grid-cols-2">
                <Section
                  title="Toppings"
                  description="Which toppings can be added?"
                  collapseOnMobile
                >
                  <ToppingQuickAdd
                    kind="TOPPING"
                    onCreated={(id) => setToppingIds((prev) => new Set(prev).add(id))}
                  />
                  <SearchableMultiSelect
                    items={toppingsAll
                      .filter((t) => t.kind === "TOPPING" && t.isActive)
                      .map((t) => ({
                        value: t.id,
                        label: `${t.name} · +₹${Number(t.priceDelta).toFixed(0)}`,
                      }))}
                    selected={[...toppingIds].filter(
                      (id) => toppingsAll.find((t) => t.id === id)?.kind === "TOPPING",
                    )}
                    onChange={(ids) => {
                      const kept = [...toppingIds].filter(
                        (id) => toppingsAll.find((t) => t.id === id)?.kind !== "TOPPING",
                      );
                      setToppingIds(new Set([...kept, ...ids]));
                    }}
                    placeholder="Search or pick toppings"
                    searchPlaceholder="Search toppings…"
                    allowSelectAll
                    allowClearAll
                  />
                </Section>
                <Section
                  title="Condiments / Extras"
                  description="Hot honey, ranch, oregano packets…"
                  collapseOnMobile
                >
                  <ToppingQuickAdd
                    kind="CONDIMENT"
                    onCreated={(id) => setToppingIds((prev) => new Set(prev).add(id))}
                  />
                  <SearchableMultiSelect
                    items={toppingsAll
                      .filter((t) => t.kind === "CONDIMENT" && t.isActive)
                      .map((t) => ({
                        value: t.id,
                        label: `${t.name} · +₹${Number(t.priceDelta).toFixed(0)}`,
                      }))}
                    selected={[...toppingIds].filter(
                      (id) => toppingsAll.find((t) => t.id === id)?.kind === "CONDIMENT",
                    )}
                    onChange={(ids) => {
                      const kept = [...toppingIds].filter(
                        (id) => toppingsAll.find((t) => t.id === id)?.kind !== "CONDIMENT",
                      );
                      setToppingIds(new Set([...kept, ...ids]));
                    }}
                    placeholder="Search or pick condiments"
                    searchPlaceholder="Search condiments…"
                    allowSelectAll
                    allowClearAll
                  />
                </Section>
              </div>
            </>
          )}

          {template === "OTHER" && (
            <Section
              title="Variants"
              description="Optional. Add rows if this product ships in multiple sizes/portions/flavours — each with its own price."
              collapseOnMobile
            >
              <OptionsEditor
                options={sizeOptions}
                onChange={setSizeOptions}
                priceMode="ABSOLUTE"
                suggestKey={(label) =>
                  label
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "")
                }
                labelPlaceholder="250g / Small / Regular"
                keyPlaceholder="250g"
              />
            </Section>
          )}

          <div className={cn("grid gap-4", template === "CAKE" && "md:grid-cols-2")}>
            {template === "CAKE" && (
              <Section
                title="Flavours"
                description={`Pick from ${flavours.length} master flavours.`}
                collapseOnMobile
              >
                <FlavourQuickAdd
                  onCreated={(id) => setFlavorIds((prev) => new Set(prev).add(id))}
                />
                <SearchableMultiSelect
                  items={flavours.map((f) => ({ value: f.id, label: f.name }))}
                  selected={[...flavorIds]}
                  onChange={(ids) => setFlavorIds(new Set(ids))}
                  placeholder="Search or pick flavours"
                  searchPlaceholder="Search flavours…"
                  allowSelectAll
                  allowClearAll
                />
              </Section>
            )}
            <Section title="Tags" description="Labels used in filters and badges." collapseOnMobile>
              <TagQuickAdd onCreated={(id) => setTagIds((prev) => new Set(prev).add(id))} />
              {tags.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No tags yet — use Add tag above, or manage the full list under{" "}
                  <Link to="/tags" className="text-brand-600 hover:underline">
                    Tags
                  </Link>
                  .
                </p>
              ) : (
                <SearchableMultiSelect
                  items={tags.map((t) => ({ value: t.id, label: t.name }))}
                  selected={[...tagIds]}
                  onChange={(ids) => setTagIds(new Set(ids))}
                  placeholder="Search or pick tags"
                  searchPlaceholder="Search tags…"
                  allowSelectAll
                  allowClearAll
                />
              )}
            </Section>
          </div>

          <Section
            title="Add-ons"
            description="Optional extras. Add-ons assigned to the selected categories are pre-checked — you can still turn them off."
            collapseOnMobile
          >
            <AddonQuickAdd
              categoryIds={watch("categoryIds") ?? []}
              existingGroups={[
                ...new Set(addonsAll.map((a) => a.group || "Other").filter(Boolean)),
              ]}
              onCreated={(id) => setAddonIds((prev) => new Set(prev).add(id))}
            />
            {addonsAll.filter((a) => a.isActive).length === 0 ? (
              <p className="text-xs text-slate-500">
                No add-ons yet — use Add add-on above, or manage the full list under{" "}
                <Link to="/addons" className="text-brand-600 hover:underline">
                  Add-ons
                </Link>
                .
              </p>
            ) : (
              <div className="space-y-4">
                {[...new Set(addonsAll.filter((a) => a.isActive).map((a) => a.group || "Other"))]
                  .sort((a, b) => a.localeCompare(b))
                  .map((group) => (
                    <div key={group}>
                      <p className="mb-1.5 text-xs font-medium tracking-wide text-slate-500 uppercase">
                        {group}
                      </p>
                      <SearchableMultiSelect
                        items={addonsAll
                          .filter((a) => a.isActive && (a.group || "Other") === group)
                          .map((a) => ({
                            value: a.id,
                            label: `${a.name} · +₹${Number(a.priceDelta).toFixed(0)}`,
                            imageUrl: a.imageUrl,
                          }))}
                        selected={[...addonIds].filter((id) =>
                          addonsAll.some((a) => a.id === id && (a.group || "Other") === group),
                        )}
                        onChange={(ids) => {
                          const groupIds = new Set(
                            addonsAll
                              .filter((a) => (a.group || "Other") === group)
                              .map((a) => a.id),
                          );
                          const kept = [...addonIds].filter((id) => !groupIds.has(id));
                          setAddonIds(new Set([...kept, ...ids]));
                        }}
                        placeholder={`Search ${group}…`}
                        searchPlaceholder={`Search ${group}…`}
                        allowSelectAll
                        allowClearAll
                      />
                    </div>
                  ))}
              </div>
            )}
          </Section>

          <Section
            title="SEO, allergens & notes"
            description="Optional — meta tags, allergens, internal notes."
            collapsed={!hasSeoOrNotes}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Meta title" error={errors.metaTitle?.message}>
                <input {...register("metaTitle")} className={inputClass} />
              </Field>
              <Field label="Allergens (comma-separated)" error={errors.allergensCsv?.message}>
                <input
                  {...register("allergensCsv")}
                  className={inputClass}
                  placeholder="egg, dairy, gluten, nuts"
                />
              </Field>
              <Field
                label="Meta description"
                error={errors.metaDescription?.message}
                className="sm:col-span-2"
              >
                <textarea
                  {...register("metaDescription")}
                  rows={2}
                  className={cn(textareaClass, "min-h-0")}
                />
              </Field>
              <Field label="Kitchen notes" hint="Internal — never shown to customers.">
                <textarea
                  {...register("kitchenNotes")}
                  rows={2}
                  className={cn(textareaClass, "min-h-0")}
                />
              </Field>
              <Field label="Admin notes" hint="Internal note for staff.">
                <textarea
                  {...register("adminNotes")}
                  rows={2}
                  className={cn(textareaClass, "min-h-0")}
                />
              </Field>
            </div>
          </Section>
        </div>

        {/* Right: sidebar (pricing, status, meta) */}
        <aside className="space-y-4">
          <Section title="Pricing">
            {template === "PIZZA" ? (
              <p className="text-xs text-slate-500">
                Pizza is priced per size — set the customer price for each size in the{" "}
                <span className="font-medium">Sizes</span> section.
                {sizeOptions.length > 0 && (
                  <>
                    {" "}
                    Current range:{" "}
                    <span className="font-semibold text-slate-900">
                      ₹{Math.min(...sizeOptions.map((o) => Number(o.price) || 0)).toFixed(0)}
                      {" – ₹"}
                      {Math.max(...sizeOptions.map((o) => Number(o.price) || 0)).toFixed(0)}
                    </span>
                    .
                  </>
                )}
              </p>
            ) : (
              <Field label="Base price (₹)" required error={errors.basePrice?.message}>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  {...register("basePrice")}
                  className={inputClass}
                />
              </Field>
            )}
            <DiscountFields
              startingPrice={startingPrice}
              sizes={pricedSizes.map((o) => ({ label: o.label, price: Number(o.price) }))}
              perPound={template === "CAKE" && watch("sellByPound")}
              value={watch("discountedPrice")}
              onChange={(v) =>
                setValue("discountedPrice", v, { shouldDirty: true, shouldValidate: true })
              }
              inputProps={register("discountedPrice")}
              error={errors.discountedPrice?.message}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="GST rate (%)" error={errors.gstRate?.message}>
                <input
                  type="number"
                  min={0}
                  max={28}
                  step="0.01"
                  {...register("gstRate")}
                  className={inputClass}
                />
              </Field>
              <Field label="HSN code" error={errors.hsnCode?.message}>
                <input {...register("hsnCode")} className={inputClass} />
              </Field>
            </div>
            <Checkbox {...register("priceIsGstInclusive")} label="Price includes GST" />
          </Section>

          <Section title="Category & listing">
            <Field
              label="Categories"
              required
              error={errors.categoryIds?.message}
              hint="Can appear in several categories."
            >
              <div className="mb-2">
                <CategoryQuickAdd
                  onCreated={(id) => {
                    const current = watch("categoryIds") ?? [];
                    if (!current.includes(id)) {
                      setValue("categoryIds", [...current, id], { shouldValidate: true });
                    }
                  }}
                />
              </div>
              <NestedCategoryMultiSelect
                categories={categories}
                selected={watch("categoryIds") ?? []}
                onChange={(ids) => setValue("categoryIds", ids, { shouldValidate: true })}
                placeholder="Search or pick categories"
              />
            </Field>
            <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-3">
              <Field label="Product type" error={errors.productType?.message}>
                <select
                  {...register("productType")}
                  title="Configurable = customer picks options. Fixed variants = pre-made SKUs (advanced)."
                  className={selectClass}
                >
                  <option value="CONFIGURABLE">Configurable</option>
                  <option value="FIXED_VARIANTS">Fixed Variants</option>
                </select>
              </Field>
              <Field label="Sort order" error={errors.sortOrder?.message}>
                <input
                  type="number"
                  title="Lower shows first"
                  {...register("sortOrder")}
                  className={inputClass}
                />
              </Field>
            </div>
            <p className="text-[11px] text-slate-500">
              Active, stock and featured are toggled from the products table. Lower sort order shows
              first.
            </p>
          </Section>
        </aside>
      </fieldset>
    </form>
  );
}

const barButtonClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-white disabled:opacity-60";

function Section({
  title,
  description,
  children,
  /** On small screens, start collapsed so the form isn’t an endless scroll. Desktop stays open. */
  collapseOnMobile = false,
  /** Collapsible on every screen size; starts closed while true, opens once it turns false. */
  collapsed,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  collapseOnMobile?: boolean;
  collapsed?: boolean;
}) {
  const everywhere = collapsed !== undefined;
  const [open, setOpen] = useState(everywhere ? !collapsed : !collapseOnMobile);
  useEffect(() => {
    if (collapsed === false) setOpen(true);
  }, [collapsed]);
  const hiddenWhenClosed = !open && (everywhere ? "hidden" : "hidden lg:block");

  return (
    <section className="rounded-card border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => {
          if (!everywhere && window.matchMedia("(min-width: 1024px)").matches) return;
          setOpen((v) => !v);
        }}
        className={cn(
          "flex w-full items-start justify-between gap-3 px-3.5 py-2.5 text-left sm:px-4",
          (open || !everywhere) && "border-b border-slate-100",
          !everywhere && "lg:cursor-default",
        )}
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-900">{title}</span>
          {description && (
            <span
              className={cn(
                "block text-xs text-slate-500",
                !open && !everywhere && "hidden lg:block",
              )}
            >
              {description}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition",
            !everywhere && "lg:hidden",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {/* A view-only form is a disabled fieldset; its toggles can't be tapped, so keep it open. */}
      <div className={cn("space-y-3 p-3.5 sm:p-4", hiddenWhenClosed, "group-disabled:block")}>
        {children}
      </div>
    </section>
  );
}

const Checkbox = (
  props: React.InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    hint?: string;
  },
) => {
  const { label, hint, className, ...rest } = props;
  return (
    <label className="flex cursor-pointer items-start gap-2">
      <input
        type="checkbox"
        {...rest}
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-500 focus:ring-brand-500",
          className,
        )}
      />
      <span className="min-w-0">
        <span className="block text-sm leading-tight text-slate-900">{label}</span>
        {hint && <span className="block text-[11px] leading-snug text-slate-500">{hint}</span>}
      </span>
    </label>
  );
};

function TemplateChip({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg border p-2 text-left transition",
        active
          ? "bg-brand-50/50 border-brand-500 ring-1 ring-brand-500/30"
          : "hover:border-brand-300 border-slate-200 bg-white",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
          active ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-500",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-900">{title}</span>
        <span className="hidden truncate text-[11px] text-slate-500 sm:block">{subtitle}</span>
      </span>
    </button>
  );
}

function normalizeOption(
  o: Partial<ProductOptionInput> & {
    key?: string;
    label?: string;
    price?: string | number;
  },
): ProductOptionInput {
  return {
    key: o.key ?? "",
    label: o.label ?? "",
    price: typeof o.price === "string" ? Number(o.price) : (o.price ?? 0),
    weightGrams: o.weightGrams ?? null,
    diameterMm: o.diameterMm ?? null,
    isDefault: o.isDefault ?? false,
    isActive: o.isActive ?? true,
    sortOrder: o.sortOrder ?? 0,
  };
}

function sizeKeyFromLabel(label: string): string {
  const m = label.match(/(\d+)/);
  if (m) return `${m[1]}in`;
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Own its own price-input state so decimal typing ("5.", "5.9") isn't lost
// by number coercion round-trips through parent state.
function OptionRow({
  opt,
  priceMode,
  labelPlaceholder,
  keyPlaceholder,
  showDiameter,
  suggestKey,
  onPatch,
  onRemove,
}: {
  opt: ProductOptionInput;
  priceMode: "ABSOLUTE" | "DELTA";
  labelPlaceholder: string;
  keyPlaceholder: string;
  showDiameter?: boolean;
  suggestKey: (label: string) => string;
  onPatch: (patch: Partial<ProductOptionInput>) => void;
  onRemove: () => void;
}) {
  const [priceStr, setPriceStr] = useState<string>(opt.price === 0 ? "" : String(opt.price));

  // Sync external changes (e.g. server load) into local string.
  useEffect(() => {
    const externalStr = opt.price === 0 ? "" : String(opt.price);
    if (Number(priceStr || 0) !== opt.price) setPriceStr(externalStr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opt.price]);

  return (
    <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5 rounded-md border border-slate-200 bg-slate-50/50 p-1.5 sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
      <input
        value={opt.label}
        onChange={(e) => {
          const label = e.target.value;
          const patch: Partial<ProductOptionInput> = { label };
          if (!opt.key) patch.key = suggestKey(label);
          onPatch(patch);
        }}
        placeholder={labelPlaceholder}
        className={cn(inputClass, "py-1.5")}
      />
      <input
        value={opt.key}
        onChange={(e) => onPatch({ key: e.target.value })}
        placeholder={keyPlaceholder}
        className={cn(inputClass, "py-1.5 font-mono text-xs")}
      />
      <button
        type="button"
        onClick={onRemove}
        className="row-span-2 inline-flex h-8 w-8 items-center justify-center self-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 sm:order-last sm:row-span-1"
        aria-label="Remove"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <input
        type="text"
        inputMode="decimal"
        value={priceStr}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.]/g, "");
          setPriceStr(raw);
          const n = raw === "" || raw === "." ? 0 : Number(raw);
          onPatch({ price: Number.isFinite(n) ? n : 0 });
        }}
        placeholder={priceMode === "ABSOLUTE" ? "e.g. 500" : "e.g. 50"}
        className={cn(inputClass, "py-1.5")}
      />
      {showDiameter ? (
        <input
          type="number"
          min={1}
          value={opt.diameterMm ?? ""}
          onChange={(e) =>
            onPatch({
              diameterMm: e.target.value ? Number(e.target.value) : null,
            })
          }
          placeholder="mm"
          className={cn(inputClass, "py-1.5")}
        />
      ) : (
        <div />
      )}
    </div>
  );
}

function OptionsEditor({
  options,
  onChange,
  priceMode,
  suggestKey,
  labelPlaceholder,
  keyPlaceholder,
  showDiameter,
}: {
  options: ProductOptionInput[];
  onChange: (next: ProductOptionInput[]) => void;
  priceMode: "ABSOLUTE" | "DELTA";
  suggestKey: (label: string) => string;
  labelPlaceholder: string;
  keyPlaceholder: string;
  showDiameter?: boolean;
}) {
  const addRow = () =>
    onChange([...options, normalizeOption({ sortOrder: options.length, isActive: true })]);
  const patchRow = (idx: number, patch: Partial<ProductOptionInput>) =>
    onChange(options.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  const removeRow = (idx: number) => onChange(options.filter((_, i) => i !== idx));

  const priceHeader = priceMode === "ABSOLUTE" ? "Price (₹)" : "Extra (₹)";

  return (
    <div className="space-y-2">
      {options.length === 0 && (
        <p className="text-xs text-slate-500">No options yet — add one below.</p>
      )}
      {options.length > 0 && (
        <div className="hidden gap-2 px-2 text-[10px] font-medium tracking-wide text-slate-500 uppercase sm:grid sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
          <span>Label</span>
          <span>Key</span>
          <span>{priceHeader}</span>
          <span>{showDiameter ? "Diameter (mm)" : ""}</span>
          <span />
        </div>
      )}
      {options.map((opt, idx) => (
        <OptionRow
          key={idx}
          opt={opt}
          priceMode={priceMode}
          labelPlaceholder={labelPlaceholder}
          keyPlaceholder={keyPlaceholder}
          showDiameter={showDiameter}
          suggestKey={suggestKey}
          onPatch={(patch) => patchRow(idx, patch)}
          onRemove={() => removeRow(idx)}
        />
      ))}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
        >
          + Add option
        </button>
        {options.length > 0 && (
          <p className="text-[11px] text-slate-500">
            {priceMode === "ABSOLUTE"
              ? "These prices replace the base price when the customer picks that option."
              : "Added on top of the picked item price."}
          </p>
        )}
      </div>
    </div>
  );
}

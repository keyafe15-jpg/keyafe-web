import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Cake, Pizza, Sparkles, Save, Trash2, X } from "lucide-react";
import {
  Field,
  inputClass,
  selectClass,
  submitClass,
  textareaClass,
} from "@/components/form/Field";
import { MultiImageUpload } from "@/components/form/MultiImageUpload";
import { useFlatCategories } from "@/hooks/useCategories";
import { useFlavours } from "@/hooks/useFlavours";
import { useTags } from "@/hooks/useTags";
import { useAdminToppings } from "@/hooks/useToppings";
import {
  useAdminProduct,
  useCreateProduct,
  useUpdateProduct,
  type ProductOptionInput,
} from "@/hooks/useAdminProducts";
import { uploadImages } from "@/lib/uploads";
import { cn } from "@/lib/cn";

const formSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, digits and hyphens only"),
  shortDescription: z.string().trim().max(300).optional(),
  description: z.string().trim().optional(),
  categoryId: z.string().min(1, "Pick a category"),
  basePrice: z.coerce.number().nonnegative("Enter a valid price"),
  productType: z.enum(["FIXED_VARIANTS", "CONFIGURABLE"]),
  template: z.enum(["CAKE", "PIZZA", "OTHER"]),
  isCustomizable: z.boolean(),
  isEggless: z.boolean(),
  sellByPound: z.boolean(),
  minGrams: z
    .union([z.coerce.number().int().positive(), z.literal("")])
    .optional(),
  maxGrams: z
    .union([z.coerce.number().int().positive(), z.literal("")])
    .optional(),
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
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const { data: categories = [] } = useFlatCategories();
  const { data: flavours = [] } = useFlavours();
  const { data: tags = [] } = useTags();
  const { data: toppingsAll = [] } = useAdminToppings();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const { data: existing, isLoading: loadingExisting } = useAdminProduct(id);

  const [newImages, setNewImages] = useState<File[]>([]);
  const [keptImages, setKeptImages] = useState<string[]>([]);
  const [flavorIds, setFlavorIds] = useState<Set<string>>(new Set());
  const [tagIds, setTagIds] = useState<Set<string>>(new Set());
  const [toppingIds, setToppingIds] = useState<Set<string>>(new Set());
  const [sizeOptions, setSizeOptions] = useState<ProductOptionInput[]>([]);
  const [crustOptions, setCrustOptions] = useState<ProductOptionInput[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      slug: "",
      shortDescription: "",
      description: "",
      categoryId: "",
      basePrice: 0,
      productType: "CONFIGURABLE",
      template: "CAKE",
      isCustomizable: false,
      isEggless: true,
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
      categoryId: existing.categoryId,
      basePrice: Number(existing.basePrice),
      productType: existing.productType,
      template: existing.template ?? "CAKE",
      isCustomizable: existing.isCustomizable,
      isEggless: existing.isEggless,
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
    setSizeOptions((existing.sizeOptions ?? []).map(normalizeOption));
    setCrustOptions((existing.crustOptions ?? []).map(normalizeOption));
  }, [existing, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      setIsUploading(true);
      const uploaded = newImages.length
        ? await uploadImages(newImages, "product")
        : [];
      setIsUploading(false);

      const payload = {
        name: values.name,
        slug: values.slug,
        shortDescription: values.shortDescription || null,
        description: values.description || null,
        categoryId: values.categoryId,
        images: [...keptImages, ...uploaded.map((u) => u.publicUrl)],
        basePrice: values.basePrice,
        productType: values.productType,
        template: values.template,
        isCustomizable: values.isCustomizable,
        isEggless: values.isEggless,
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
      setSubmitError(
        err instanceof Error ? err.message : "Failed to save product",
      );
    }
  });

  const busy = isSubmitting || isUploading;

  return (
    <form onSubmit={onSubmit} className="pb-24">
      {/* Sticky action bar */}
      <div className="sticky top-14 z-10 -mx-4 mb-6 flex items-center justify-between border-b border-slate-200 bg-slate-50/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {isEdit ? "Edit product" : "New product"}
          </h1>
          <p className="text-xs text-slate-500">
            {isEdit
              ? loadingExisting
                ? "Loading…"
                : `Editing “${existing?.name ?? "…"}”`
              : "Fill in the details and save."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/products")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
          >
            <X className="h-4 w-4" /> Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className={cn(submitClass, "inline-flex items-center gap-1.5")}
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
        </div>
      </div>

      {submitError && (
        <div className="mb-6 rounded-lg border border-brand-500/40 bg-brand-100/50 px-4 py-3 text-sm text-brand-700">
          {submitError}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: main details */}
        <div className="space-y-6 lg:col-span-2">
          <Section
            title="Template"
            description="Drives which extra sections show up below. Pick the closest match."
          >
            <div className="grid grid-cols-3 gap-3">
              <TemplateChip
                active={template === "CAKE"}
                onClick={() => setValue("template", "CAKE")}
                icon={<Cake className="h-5 w-5" />}
                title="Cake"
                subtitle="Flavours, pounds, message on cake"
              />
              <TemplateChip
                active={template === "PIZZA"}
                onClick={() => setValue("template", "PIZZA")}
                icon={<Pizza className="h-5 w-5" />}
                title="Pizza"
                subtitle="Sizes, crust, toppings, condiments"
              />
              <TemplateChip
                active={template === "OTHER"}
                onClick={() => setValue("template", "OTHER")}
                icon={<Sparkles className="h-5 w-5" />}
                title="Other"
                subtitle="No extras — plain product"
              />
            </div>
          </Section>

          <Section title="Basics">
            <Field label="Name" required error={errors.name?.message}>
              <input {...register("name")} className={inputClass} />
            </Field>
            <Field
              label="Slug"
              required
              error={errors.slug?.message}
              hint="Auto-generated from name. Edit to override."
            >
              <input
                {...register("slug", { onChange: () => setSlugTouched(true) })}
                className={inputClass}
              />
            </Field>
            <Field
              label="Short description"
              error={errors.shortDescription?.message}
            >
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
                rows={5}
                className={textareaClass}
              />
            </Field>
          </Section>

          <Section title="Images">
            {keptImages.length > 0 && (
              <div className="mb-3">
                <p className="mb-2 text-xs text-slate-500">
                  Current images — click × to remove
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {keptImages.map((url) => (
                    <div
                      key={url}
                      className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white"
                    >
                      <img
                        src={url}
                        alt=""
                        className="aspect-square w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setKeptImages(keptImages.filter((u) => u !== url))
                        }
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 text-white opacity-0 transition group-hover:opacity-100"
                        aria-label="Remove image"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <MultiImageUpload
              value={newImages}
              onChange={setNewImages}
              max={Math.max(1, 5 - keptImages.length)}
            />
          </Section>

          <Section title="Customization">
            <div className="grid gap-4 sm:grid-cols-2">
              <Checkbox
                {...register("isCustomizable")}
                label="Customizable product"
                hint="Enable option pickers on the storefront."
              />
              <Checkbox
                {...register("isEggless")}
                label="Eggless"
                hint="Shown as ‘veg’ on the storefront. Turn off for egg-based cakes."
              />
              {template === "CAKE" && (
                <>
                  <Checkbox
                    {...register("sellByPound")}
                    label="Sell by pound"
                    hint="Show size picker on PDP. Price = (base + flavour extra) × grams / 500."
                  />
                  <Checkbox
                    {...register("allowCustomSize")}
                    label="Allow custom pounds"
                    hint="Adds a 'want more pounds?' input on the PDP."
                  />
                  <Field
                    label="Min size (grams)"
                    error={errors.minGrams?.message}
                    hint="Blank = no minimum. e.g. 250 hides Bento/Mini for this product."
                  >
                    <input
                      type="number"
                      min={1}
                      step={1}
                      {...register("minGrams")}
                      className={inputClass}
                    />
                  </Field>
                  <Field
                    label="Max size (grams)"
                    error={errors.maxGrams?.message}
                    hint="Blank = no maximum. e.g. 1500 caps at 3 pounds."
                  >
                    <input
                      type="number"
                      min={1}
                      step={1}
                      {...register("maxGrams")}
                      className={inputClass}
                    />
                  </Field>
                  <Checkbox
                    {...register("supportsMessageOnCake")}
                    label="Message on cake"
                    hint="Show the message-on-cake input."
                  />
                  <Field
                    label="Message max length"
                    error={errors.messageMaxLength?.message}
                  >
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
              <Field
                label="Lead time (hours)"
                error={errors.leadTimeHours?.message}
              >
                <input
                  type="number"
                  min={0}
                  {...register("leadTimeHours")}
                  className={inputClass}
                />
              </Field>
              <div className="sm:col-span-2">
                <Checkbox
                  {...register("supportsSameDayDelivery")}
                  label="Same-day delivery eligible"
                />
              </div>
              <div className="sm:col-span-2">
                <Checkbox
                  {...register("canBeDeliveredPanIndia")}
                  label="Pan-India courier delivery"
                  hint="Ships nationwide via courier (Shiprocket/India Post). PDP skips local date/slot selection."
                />
              </div>
              <div className="sm:col-span-2">
                <Checkbox
                  {...register("isHealthyTreat")}
                  label="Show in Healthy Treats"
                  hint="Lists this product on the Healthy Treats page. Independent of same-day and pan-India."
                />
              </div>
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
              <Section
                title="Toppings"
                description={`Which toppings can be added? Manage the master list under /toppings.`}
              >
                <ChipPicker
                  items={toppingsAll
                    .filter((t) => t.kind === "TOPPING" && t.isActive)
                    .map((t) => ({
                      id: t.id,
                      label: `${t.name} · +₹${Number(t.priceDelta).toFixed(0)}`,
                    }))}
                  selected={toppingIds}
                  onToggle={(id) => {
                    const next = new Set(toppingIds);
                    next.has(id) ? next.delete(id) : next.add(id);
                    setToppingIds(next);
                  }}
                />
              </Section>
              <Section
                title="Condiments / Extras"
                description="Things like hot honey, ranch, oregano packets."
              >
                <ChipPicker
                  items={toppingsAll
                    .filter((t) => t.kind === "CONDIMENT" && t.isActive)
                    .map((t) => ({
                      id: t.id,
                      label: `${t.name} · +₹${Number(t.priceDelta).toFixed(0)}`,
                    }))}
                  selected={toppingIds}
                  onToggle={(id) => {
                    const next = new Set(toppingIds);
                    next.has(id) ? next.delete(id) : next.add(id);
                    setToppingIds(next);
                  }}
                />
              </Section>
            </>
          )}

          {template === "OTHER" && (
            <Section
              title="Variants"
              description="Optional. Add rows if this product ships in multiple sizes/portions/flavours — each with its own price."
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

          {template === "CAKE" && (
            <Section
              title="Flavours"
              description={`Which of the ${flavours.length} master flavours does this product offer?`}
            >
              <ChipPicker
                items={flavours.map((f) => ({ id: f.id, label: f.name }))}
                selected={flavorIds}
                onToggle={(id) => {
                  const next = new Set(flavorIds);
                  next.has(id) ? next.delete(id) : next.add(id);
                  setFlavorIds(next);
                }}
              />
              {flavorIds.size > 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  {flavorIds.size} selected
                </p>
              )}
            </Section>
          )}

          <Section
            title="Tags"
            description="Cross-cutting labels used in filters and badges."
          >
            {tags.length === 0 ? (
              <p className="text-xs text-slate-500">
                No tags yet — create tags from the taxonomy admin (coming soon).
              </p>
            ) : (
              <ChipPicker
                items={tags.map((t) => ({ id: t.id, label: t.name }))}
                selected={tagIds}
                onToggle={(id) => {
                  const next = new Set(tagIds);
                  next.has(id) ? next.delete(id) : next.add(id);
                  setTagIds(next);
                }}
              />
            )}
          </Section>

          <Section title="SEO / Metadata">
            <div className="grid gap-4">
              <Field label="Meta title" error={errors.metaTitle?.message}>
                <input {...register("metaTitle")} className={inputClass} />
              </Field>
              <Field
                label="Meta description"
                error={errors.metaDescription?.message}
              >
                <textarea
                  {...register("metaDescription")}
                  rows={2}
                  className={textareaClass}
                />
              </Field>
              <Field
                label="Allergens (comma-separated)"
                error={errors.allergensCsv?.message}
                hint="e.g., egg, dairy, gluten, nuts"
              >
                <input
                  {...register("allergensCsv")}
                  className={inputClass}
                  placeholder="egg, dairy, gluten"
                />
              </Field>
              <Field
                label="Kitchen notes"
                hint="Internal — never shown to customers."
              >
                <textarea
                  {...register("kitchenNotes")}
                  rows={2}
                  className={textareaClass}
                />
              </Field>
              <Field label="Admin notes" hint="Internal note for staff.">
                <textarea
                  {...register("adminNotes")}
                  rows={2}
                  className={textareaClass}
                />
              </Field>
            </div>
          </Section>
        </div>

        {/* Right: sidebar (pricing, status, meta) */}
        <aside className="space-y-6">
          <Section title="Pricing">
            {template === "PIZZA" ? (
              <p className="text-xs text-slate-500">
                Pizza is priced per size — set the customer price for each size
                in the <span className="font-medium">Sizes</span> section.
                {sizeOptions.length > 0 && (
                  <>
                    {" "}
                    Current range:{" "}
                    <span className="font-semibold text-slate-900">
                      ₹
                      {Math.min(
                        ...sizeOptions.map((o) => Number(o.price) || 0),
                      ).toFixed(0)}
                      {" – ₹"}
                      {Math.max(
                        ...sizeOptions.map((o) => Number(o.price) || 0),
                      ).toFixed(0)}
                    </span>
                    .
                  </>
                )}
              </p>
            ) : (
              <Field
                label="Base price (₹)"
                required
                error={errors.basePrice?.message}
              >
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  {...register("basePrice")}
                  className={inputClass}
                />
              </Field>
            )}
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
            <Checkbox
              {...register("priceIsGstInclusive")}
              label="Price includes GST"
            />
          </Section>

          <Section title="Category & type">
            <Field label="Category" required error={errors.categoryId?.message}>
              <select {...register("categoryId")} className={selectClass}>
                <option value="">— Choose —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Product type"
              error={errors.productType?.message}
              hint="Configurable = customer picks options. Variants = pre-made SKUs (advanced)."
            >
              <select {...register("productType")} className={selectClass}>
                <option value="CONFIGURABLE">Configurable</option>
                <option value="FIXED_VARIANTS">Fixed Variants</option>
              </select>
            </Field>
          </Section>

          <Section title="Status">
            <Checkbox
              {...register("isActive")}
              label="Active"
              hint="Appears in the catalogue."
            />
            <Checkbox
              {...register("isAvailable")}
              label="In stock"
              hint="Uncheck to mark out of stock — hidden from the storefront."
            />
            <Checkbox
              {...register("isFeatured")}
              label="Featured"
              hint="Appears in featured slots."
            />
            <Field
              label="Sort order"
              hint="Lower shows first."
              error={errors.sortOrder?.message}
            >
              <input
                type="number"
                {...register("sortOrder")}
                className={inputClass}
              />
            </Field>
          </Section>
        </aside>
      </div>
    </form>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        )}
      </div>
      <div className="space-y-4 p-4">{children}</div>
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
      <span>
        <span className="block text-sm text-slate-900">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
};

function ChipPicker({
  items,
  selected,
  onToggle,
}: {
  items: { id: string; label: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        const on = selected.has(item.id);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onToggle(item.id)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition",
              on
                ? "border-brand-500 bg-brand-100 text-brand-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-brand-300",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

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
        "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition",
        active
          ? "border-brand-500 bg-brand-50/50 ring-1 ring-brand-500/30"
          : "border-slate-200 bg-white hover:border-brand-300",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md",
          active ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-500",
        )}
      >
        {icon}
      </span>
      <span className="text-sm font-medium text-slate-900">{title}</span>
      <span className="text-xs text-slate-500">{subtitle}</span>
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
  const [priceStr, setPriceStr] = useState<string>(
    opt.price === 0 ? "" : String(opt.price),
  );

  // Sync external changes (e.g. server load) into local string.
  useEffect(() => {
    const externalStr = opt.price === 0 ? "" : String(opt.price);
    if (Number(priceStr || 0) !== opt.price) setPriceStr(externalStr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opt.price]);

  return (
    <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50/50 p-2 sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
      <input
        value={opt.label}
        onChange={(e) => {
          const label = e.target.value;
          const patch: Partial<ProductOptionInput> = { label };
          if (!opt.key) patch.key = suggestKey(label);
          onPatch(patch);
        }}
        placeholder={labelPlaceholder}
        className={inputClass}
      />
      <input
        value={opt.key}
        onChange={(e) => onPatch({ key: e.target.value })}
        placeholder={keyPlaceholder}
        className={cn(inputClass, "font-mono text-xs")}
      />
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
        className={inputClass}
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
          className={inputClass}
        />
      ) : (
        <div />
      )}
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex h-9 w-9 items-center justify-center self-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
        aria-label="Remove"
      >
        <Trash2 className="h-4 w-4" />
      </button>
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
    onChange([
      ...options,
      normalizeOption({ sortOrder: options.length, isActive: true }),
    ]);
  const patchRow = (idx: number, patch: Partial<ProductOptionInput>) =>
    onChange(options.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  const removeRow = (idx: number) =>
    onChange(options.filter((_, i) => i !== idx));

  const priceHeader = priceMode === "ABSOLUTE" ? "Price (₹)" : "Extra (₹)";

  return (
    <div className="space-y-2">
      {options.length === 0 && (
        <p className="text-xs text-slate-500">
          No options yet — add one below.
        </p>
      )}
      {options.length > 0 && (
        <div className="hidden gap-2 px-2 text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:grid sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
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

import { useEffect, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  Package,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useAdminProduct, type AdminProduct } from "@/hooks/useAdminProducts";
import type { AdminTopping } from "@/hooks/useToppings";
import type { CakeSize } from "@/hooks/useCakeSizes";
import {
  Field,
  inputClass,
  selectClass,
} from "@/components/form/Field";
import { SearchableSelect } from "@/components/form/SearchableSelect";
import {
  formatCatalogProductLabel,
  resetCatalogProductPick,
} from "@/lib/catalogProductOptions";
import {
  availableFixedSkus,
  cakeSizeSelectLabel,
  computeCakeUnitPrice,
  customPoundsToGrams,
  formatCustomPoundLabel,
  formatOptionSelectLabel,
  getSizeOptionGroup,
  isGramsWithinBounds,
  optionUnitPrice,
  parseCustomPounds,
} from "@/lib/productConfiguration";
import { cn } from "@/lib/cn";
import type { OrderItemDraft } from "./types";
import {
  usePizzaCatalogOptions,
  pizzaSizeLabelForKey,
} from "./usePizzaCatalogOptions";

export function OrderItemRow({
  index,
  item,
  products,
  flavours,
  allToppings,
  cakeSizes,
  onPatch,
  onRemove,
  canRemove,
}: {
  index: number;
  item: OrderItemDraft;
  products: AdminProduct[];
  flavours: Array<{ id: string; name: string; additionalAmount: string }>;
  allToppings: AdminTopping[];
  cakeSizes: CakeSize[];
  onPatch: (patch: Partial<OrderItemDraft>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === item.productId),
    [products, item.productId],
  );

  const { data: productDetail } = useAdminProduct(
    item.kind === "CATALOG" && item.productId ? item.productId : undefined,
  );

  const template = productDetail?.template ?? selectedProduct?.template;

  const isPizza = item.kind === "CATALOG" && template === "PIZZA";
  const isCakeCatalog =
    item.kind === "CATALOG" && (template ?? "CAKE") === "CAKE";

  const sizeGroup = getSizeOptionGroup(productDetail);
  const sizeOptions = sizeGroup?.options ?? [];
  const sizePriceMode = sizeGroup?.priceMode ?? "ABSOLUTE";
  const crustOptions = productDetail?.crustOptions ?? [];
  const fixedSkus = availableFixedSkus(productDetail);
  const hasFixedSkus = fixedSkus.length > 0;
  const productFlavourIds = new Set(productDetail?.flavorIds ?? []);
  // Size choices from OptionGroup (not ProductVariant table).
  const hasOptionGroupSize =
    sizeOptions.length > 0 && !isPizza && !hasFixedSkus;
  const linkedToppingIds = new Set(productDetail?.toppingIds ?? []);
  const linkedToppings = allToppings.filter((t) => linkedToppingIds.has(t.id));
  const availToppings = linkedToppings.filter((t) => t.kind === "TOPPING");
  const availCondiments = linkedToppings.filter((t) => t.kind === "CONDIMENT");

  // Cake configurator — flavour + pounds with auto price (all CAKE catalog items).
  const isCakeConfigurator =
    isCakeCatalog && !isPizza && !hasFixedSkus && !hasOptionGroupSize;
  const hasAttachedFlavours = productFlavourIds.size > 0;
  const pickerFlavours = hasAttachedFlavours
    ? flavours.filter((f) => productFlavourIds.has(f.id))
    : flavours;
  const availableCakeSizes = useMemo(() => {
    if (!isCakeConfigurator) return [];
    return cakeSizes.filter((s) => {
      if (!s.isActive) return false;
      if (productDetail?.sellByPound) {
        if (productDetail.minGrams != null && s.grams < productDetail.minGrams)
          return false;
        if (productDetail.maxGrams != null && s.grams > productDetail.maxGrams)
          return false;
      }
      return true;
    });
  }, [isCakeConfigurator, cakeSizes, productDetail]);

  const isCustomCake =
    item.kind === "CUSTOM" && item.customTemplate === "CAKE";
  const isCustomPizza =
    item.kind === "CUSTOM" && item.customTemplate === "PIZZA";

  const autoPriced =
    isPizza ||
    isCakeConfigurator ||
    hasOptionGroupSize ||
    hasFixedSkus;

  const pizzaCatalogProducts = useMemo(
    () => products.filter((p) => p.template === "PIZZA"),
    [products],
  );
  const { sizes: pizzaSizePresets, crusts: pizzaCrustPresets } =
    usePizzaCatalogOptions(pizzaCatalogProducts);
  const customPizzaToppings = useMemo(
    () => allToppings.filter((t) => t.isActive && t.kind === "TOPPING"),
    [allToppings],
  );
  const customPizzaCondiments = useMemo(
    () => allToppings.filter((t) => t.isActive && t.kind === "CONDIMENT"),
    [allToppings],
  );
  const activeCustomCakeSizes = useMemo(
    () => cakeSizes.filter((s) => s.isActive),
    [cakeSizes],
  );
  const customCakeParsedPounds = parseCustomPounds(item.customPounds);
  const customCakeGrams =
    customCakeParsedPounds != null
      ? customPoundsToGrams(customCakeParsedPounds)
      : null;

  useEffect(() => {
    if (item.kind !== "CATALOG" || !selectedProduct || !productDetail) return;
    const patch: Partial<OrderItemDraft> = {};
    if (!item.productName) patch.productName = selectedProduct.name;
    const simpleProduct = !autoPriced;
    if (!item.unitPrice && simpleProduct) {
      patch.unitPrice = Number(selectedProduct.basePrice).toFixed(0);
    }
    if (Object.keys(patch).length) onPatch(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct, productDetail, autoPriced]);

  // Preselect default size from the size OptionGroup (non-pizza).
  useEffect(() => {
    if (!hasOptionGroupSize || !productDetail || item.sizeOptionId) return;
    const def = sizeOptions.find((o) => o.isDefault) ?? sizeOptions[0];
    if (def?.id) onPatch({ sizeOptionId: def.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOptionGroupSize, productDetail]);

  // ProductVariant SKU (FIXED_VARIANTS table) — separate from optionGroups.
  useEffect(() => {
    if (!hasFixedSkus || !item.variantId) return;
    const sku = fixedSkus.find((v) => v.id === item.variantId);
    if (!sku) return;
    const attrs = sku.attributes as { weightGrams?: number } | null;
    onPatch({
      unitPrice: sku.price.toFixed(0),
      sizeLabel: sku.label,
      sizeGrams: attrs?.weightGrams ? String(attrs.weightGrams) : "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFixedSkus, item.variantId, productDetail]);

  // OptionGroup size — price respects ABSOLUTE vs DELTA on the group.
  useEffect(() => {
    if (!hasOptionGroupSize || !productDetail) return;
    const picked = sizeOptions.find((o) => o.id === item.sizeOptionId);
    if (!picked) return;
    const base = Number(productDetail.basePrice);
    onPatch({
      unitPrice: optionUnitPrice(base, picked, sizePriceMode).toFixed(0),
      sizeLabel: picked.label,
      sizeGrams: picked.weightGrams ? String(picked.weightGrams) : "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOptionGroupSize, item.sizeOptionId, productDetail]);

  // Preselect default size + crust when the pizza detail arrives.
  useEffect(() => {
    if (!isPizza || !productDetail) return;
    const patch: Partial<OrderItemDraft> = {};
    if (!item.sizeOptionId && sizeOptions.length > 0) {
      patch.sizeOptionId =
        sizeOptions.find((o) => o.isDefault)?.id ?? sizeOptions[0].id ?? "";
    }
    if (!item.crustOptionId && crustOptions.length > 0) {
      patch.crustOptionId =
        crustOptions.find((o) => o.isDefault)?.id ?? crustOptions[0].id ?? "";
    }
    if (Object.keys(patch).length) onPatch(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPizza, productDetail]);

  // Preselect default pound size when cake detail arrives (skip if custom).
  useEffect(() => {
    if (!isCakeConfigurator || availableCakeSizes.length === 0) return;
    if (item.cakeSizeId || item.customPounds.trim()) return;
    const oneLb = availableCakeSizes.find((s) => s.grams === 500);
    const pick = oneLb ?? availableCakeSizes[0];
    onPatch({
      cakeSizeId: pick.id,
      sizeGrams: String(pick.grams),
      sizeLabel: pick.label,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCakeConfigurator, availableCakeSizes, productDetail?.id, item.customPounds]);

  // Preselect flavour when there's an obvious default.
  useEffect(() => {
    if (!isCakeConfigurator || item.flavourId || pickerFlavours.length === 0)
      return;
    onPatch({ flavourId: pickerFlavours[0].id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCakeConfigurator, productDetail?.id, pickerFlavours.length]);

  // Recompute unit price + size label when any pizza selection changes.
  const pickedSize = sizeOptions.find((o) => o.id === item.sizeOptionId);
  const pickedCrust = crustOptions.find((o) => o.id === item.crustOptionId);
  const pickedToppingsFull = allToppings.filter((t) =>
    item.toppingSelections.includes(t.id),
  );

  // Recompute cake price when size, custom pounds, or flavour changes.
  useEffect(() => {
    if (!isCakeConfigurator || !productDetail) return;

    const base = Number(productDetail.basePrice);
    const flavour = pickerFlavours.find((f) => f.id === item.flavourId);
    const flavourAdditional = flavour ? Number(flavour.additionalAmount) : 0;

    const parsedPounds = parseCustomPounds(item.customPounds);
    const customGrams =
      parsedPounds != null ? customPoundsToGrams(parsedPounds) : null;
    const customInRange =
      customGrams != null &&
      isGramsWithinBounds(
        customGrams,
        productDetail.minGrams,
        productDetail.maxGrams,
      );

    let grams: number | null = null;
    let sizeLabel = "";

    if (customInRange && parsedPounds != null && customGrams != null) {
      grams = customGrams;
      sizeLabel = formatCustomPoundLabel(parsedPounds);
    } else {
      const size = availableCakeSizes.find((s) => s.id === item.cakeSizeId);
      if (!size) return;
      grams = size.grams;
      sizeLabel = size.label;
    }

    const computed = computeCakeUnitPrice(
      base,
      grams,
      flavourAdditional,
      hasAttachedFlavours,
    );
    onPatch({
      unitPrice: computed.toFixed(0),
      sizeGrams: String(grams),
      sizeLabel,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isCakeConfigurator,
    item.cakeSizeId,
    item.customPounds,
    item.flavourId,
    productDetail,
    hasAttachedFlavours,
  ]);

  useEffect(() => {
    if (!isPizza || !productDetail) return;
    const sizePrice = pickedSize ? Number(pickedSize.price) : 0;
    const crustDelta = pickedCrust ? Number(pickedCrust.price) : 0;
    const toppingsDelta = pickedToppingsFull.reduce(
      (s, t) => s + Number(t.priceDelta),
      0,
    );
    const computed = sizePrice + crustDelta + toppingsDelta;
    const patch: Partial<OrderItemDraft> = { unitPrice: computed.toFixed(0) };
    if (pickedSize) patch.sizeLabel = pickedSize.label;
    patch.crustLabel = pickedCrust ? pickedCrust.label : "";
    onPatch(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isPizza,
    item.sizeOptionId,
    item.crustOptionId,
    item.toppingSelections.join("|"),
  ]);

  // Custom cake — sync size label/grams from pound picker or custom pounds.
  useEffect(() => {
    if (!isCustomCake || !item.expanded) return;

    const parsedPounds = parseCustomPounds(item.customPounds);
    if (parsedPounds != null) {
      const grams = customPoundsToGrams(parsedPounds);
      onPatch({
        sizeLabel: formatCustomPoundLabel(parsedPounds),
        sizeGrams: String(grams),
      });
      return;
    }

    const size = activeCustomCakeSizes.find((s) => s.id === item.cakeSizeId);
    if (!size) return;
    onPatch({
      sizeLabel: size.label,
      sizeGrams: String(size.grams),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isCustomCake,
    item.expanded,
    item.cakeSizeId,
    item.customPounds,
    activeCustomCakeSizes,
  ]);

  // Default pound size when custom cake details open.
  useEffect(() => {
    if (!isCustomCake || !item.expanded) return;
    if (item.cakeSizeId || item.customPounds.trim()) return;
    if (activeCustomCakeSizes.length === 0) return;
    const oneLb = activeCustomCakeSizes.find((s) => s.grams === 500);
    const pick = oneLb ?? activeCustomCakeSizes[0];
    onPatch({
      cakeSizeId: pick.id,
      sizeLabel: pick.label,
      sizeGrams: String(pick.grams),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCustomCake, item.expanded, activeCustomCakeSizes]);

  // Custom pizza — sync size label from preset or free text.
  useEffect(() => {
    if (!isCustomPizza || !item.expanded) return;

    const custom = item.customPizzaSize.trim();
    if (custom) {
      onPatch({ sizeLabel: custom });
      return;
    }

    if (item.sizeOptionId) {
      onPatch({
        sizeLabel: pizzaSizeLabelForKey(pizzaSizePresets, item.sizeOptionId),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isCustomPizza,
    item.expanded,
    item.customPizzaSize,
    item.sizeOptionId,
  ]);

  useEffect(() => {
    if (!isCustomPizza || !item.expanded) return;
    if (item.sizeOptionId || item.customPizzaSize.trim()) return;
    if (pizzaSizePresets.length === 0) return;
    const first = pizzaSizePresets[0];
    onPatch({ sizeOptionId: first.key, sizeLabel: first.label });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCustomPizza, item.expanded, pizzaSizePresets]);

  useEffect(() => {
    if (!isCustomPizza || !item.crustOptionId) return;
    const crust = pizzaCrustPresets.find((c) => c.id === item.crustOptionId);
    if (crust && item.crustLabel !== crust.label) {
      onPatch({ crustLabel: crust.label });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCustomPizza, item.crustOptionId, pizzaCrustPresets]);

  const toggleTopping = (id: string) => {
    const isOn = item.toppingSelections.includes(id);
    const topping = allToppings.find((t) => t.id === id);
    const delta = topping ? Number(topping.priceDelta) : 0;
    const next = isOn
      ? item.toppingSelections.filter((x) => x !== id)
      : [...item.toppingSelections, id];

    if (isCustomPizza) {
      const priceAdjust = isOn ? -delta : delta;
      onPatch({
        toppingSelections: next,
        unitPrice: Math.max(0, Number(item.unitPrice || 0) + priceAdjust).toFixed(
          0,
        ),
      });
      return;
    }

    onPatch({ toppingSelections: next });
  };

  const cakeBasePrice = productDetail ? Number(productDetail.basePrice) : 0;
  const pickedCakeFlavour = pickerFlavours.find((f) => f.id === item.flavourId);
  const cakeFlavourAdditional = pickedCakeFlavour
    ? Number(pickedCakeFlavour.additionalAmount)
    : 0;
  const parsedCustomPounds = parseCustomPounds(item.customPounds);
  const customGrams =
    parsedCustomPounds != null ? customPoundsToGrams(parsedCustomPounds) : null;
  const customOutOfRange =
    customGrams != null &&
    productDetail != null &&
    !isGramsWithinBounds(
      customGrams,
      productDetail.minGrams,
      productDetail.maxGrams,
    );
  const customPreviewPrice =
    customGrams != null && !customOutOfRange
      ? computeCakeUnitPrice(
          cakeBasePrice,
          customGrams,
          cakeFlavourAdditional,
          hasAttachedFlavours,
        )
      : null;

  const showCustomDetails = item.kind === "CUSTOM" && item.expanded;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                item.kind === "CATALOG"
                  ? "bg-sky-100 text-sky-700"
                  : "bg-brand-100 text-brand-700",
              )}
            >
              {item.kind === "CATALOG" ? (
                <Package className="h-3 w-3" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              {item.kind === "CATALOG" ? "Catalog" : "Custom"}
            </span>
            <span className="text-xs text-slate-400">#{index + 1}</span>
          </div>

          {item.kind === "CATALOG" && (
            <div className="mt-3 space-y-3">
              <Field label="Product" required>
                <SearchableSelect
                  value={item.productId}
                  onChange={(productId) =>
                    onPatch({ productId, ...resetCatalogProductPick() })
                  }
                  searchPlaceholder="Search products…"
                  options={products.map((p) => ({
                    value: p.id,
                    label: formatCatalogProductLabel(p),
                    keywords: p.name,
                  }))}
                />
              </Field>

              {item.productId && productDetail && hasFixedSkus && (
                <Field label="Variant (SKU)" required>
                  <SearchableSelect
                    value={item.variantId}
                    onChange={(variantId) => onPatch({ variantId })}
                    searchPlaceholder="Search SKUs…"
                    allowEmpty={false}
                    placeholder="— Pick SKU —"
                    options={fixedSkus.map((v) => ({
                      value: v.id,
                      label: `${v.label} · ₹${v.price.toFixed(0)}`,
                      keywords: `${v.label} ${v.sku}`,
                    }))}
                  />
                </Field>
              )}

              {item.productId && productDetail && hasOptionGroupSize && (
                <Field
                  label={sizeGroup?.label ?? "Size"}
                  required
                  hint="From product option groups"
                >
                  <SearchableSelect
                    value={item.sizeOptionId}
                    onChange={(sizeOptionId) => onPatch({ sizeOptionId })}
                    searchPlaceholder="Search sizes…"
                    allowEmpty={false}
                    placeholder="— Pick size —"
                    options={sizeOptions.map((o) => ({
                      value: o.id!,
                      label: formatOptionSelectLabel(
                        o,
                        Number(productDetail.basePrice),
                        sizePriceMode,
                      ),
                      keywords: o.label,
                    }))}
                  />
                </Field>
              )}
            </div>
          )}

          <div className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
            <Field
              label={item.kind === "CATALOG" ? "Name (override)" : "Name"}
              required
            >
              <input
                value={item.productName}
                onChange={(e) => onPatch({ productName: e.target.value })}
                placeholder={
                  item.kind === "CATALOG"
                    ? "Uses product name if blank"
                    : "1 pound chocolate cake"
                }
                className={inputClass}
              />
            </Field>
            <Field
              label={autoPriced ? "Unit price (auto)" : "Unit price (₹)"}
              required
            >
              <input
                type="text"
                inputMode="decimal"
                value={item.unitPrice}
                onChange={(e) =>
                  onPatch({ unitPrice: e.target.value.replace(/[^\d.]/g, "") })
                }
                placeholder="500"
                disabled={autoPriced}
                className={cn(
                  inputClass,
                  autoPriced && "bg-slate-100 text-slate-600",
                )}
              />
            </Field>
            <Field label="Qty" required>
              <input
                type="text"
                inputMode="numeric"
                value={item.qty}
                onChange={(e) =>
                  onPatch({ qty: e.target.value.replace(/\D/g, "") })
                }
                placeholder="1"
                className={inputClass}
              />
            </Field>
          </div>

          {isCakeConfigurator && productDetail && (
            <div className="mt-3 space-y-3 rounded-md border border-amber-100 bg-amber-50/40 p-3">
              <p className="text-xs text-amber-900/70">
                {hasAttachedFlavours
                  ? `Base ₹${cakeBasePrice.toFixed(0)}/lb — flavour is part of this recipe.`
                  : `Base ₹${cakeBasePrice.toFixed(0)}/lb — flavour adds per pound on top.`}
              </p>
              {availableCakeSizes.length > 0 && (
                <Field
                  label="Size (pounds)"
                  required={!item.customPounds.trim()}
                  hint="Pick a standard size, or enter custom pounds below."
                >
                  <SearchableSelect
                    value={item.customPounds.trim() ? "" : item.cakeSizeId}
                    onChange={(cakeSizeId) =>
                      onPatch({ cakeSizeId, customPounds: "" })
                    }
                    searchPlaceholder="Search sizes…"
                    allowEmpty
                    placeholder={
                      item.customPounds.trim() && parsedCustomPounds != null
                        ? formatCustomPoundLabel(parsedCustomPounds)
                        : "— Pick size —"
                    }
                    options={availableCakeSizes.map((s) => ({
                      value: s.id,
                      label: cakeSizeSelectLabel(
                        s.label,
                        s.grams,
                        cakeBasePrice,
                        cakeFlavourAdditional,
                        hasAttachedFlavours,
                      ),
                      keywords: s.label,
                    }))}
                  />
                </Field>
              )}
              <Field
                label="Custom pounds"
                hint="Optional. Overrides the size dropdown — e.g. 2.5 for two-and-a-half pounds."
                error={
                  customOutOfRange
                    ? `Must be between ${productDetail.minGrams != null ? (productDetail.minGrams / 500).toFixed(1) : "0.1"} and ${productDetail.maxGrams != null ? (productDetail.maxGrams / 500).toFixed(1) : "any"} lb for this product.`
                    : undefined
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={
                      productDetail.minGrams
                        ? productDetail.minGrams / 500
                        : 0.1
                    }
                    max={
                      productDetail.maxGrams
                        ? productDetail.maxGrams / 500
                        : undefined
                    }
                    step={0.1}
                    value={item.customPounds}
                    onChange={(e) =>
                      onPatch({
                        customPounds: e.target.value,
                        cakeSizeId: e.target.value.trim() ? "" : item.cakeSizeId,
                      })
                    }
                    placeholder="e.g. 2.5"
                    className={cn(inputClass, "w-28")}
                  />
                  <span className="text-sm text-slate-600">lb</span>
                  {customPreviewPrice != null && (
                    <span className="text-xs text-slate-500">
                      · {customGrams} g · ₹{customPreviewPrice.toFixed(0)}
                    </span>
                  )}
                </div>
              </Field>
              {pickerFlavours.length > 0 && (
                <Field
                  label="Flavour"
                  required={!hasAttachedFlavours}
                  hint={
                    hasAttachedFlavours
                      ? "Linked to this product in the catalog."
                      : "Optional add-on per pound."
                  }
                >
                  <SearchableSelect
                    value={item.flavourId}
                    onChange={(flavourId) => onPatch({ flavourId })}
                    searchPlaceholder="Search flavours…"
                    allowEmpty={hasAttachedFlavours}
                    placeholder="— Pick flavour —"
                    options={pickerFlavours.map((f) => {
                      const delta = Number(f.additionalAmount);
                      return {
                        value: f.id,
                        label: hasAttachedFlavours
                          ? f.name
                          : delta > 0
                            ? `${f.name} (+₹${delta.toFixed(0)}/lb)`
                            : f.name,
                        keywords: f.name,
                      };
                    })}
                  />
                </Field>
              )}
              <Field label="Message on cake">
                <input
                  value={item.messageOnCake}
                  onChange={(e) => onPatch({ messageOnCake: e.target.value })}
                  placeholder="Happy Birthday Aarav"
                  className={inputClass}
                />
              </Field>
            </div>
          )}

          {isPizza && productDetail && (
            <div className="mt-3 space-y-3 rounded-md border border-sky-100 bg-sky-50/40 p-3">
              {sizeOptions.length > 0 && (
                <Field label="Size" required>
                  <SearchableSelect
                    value={item.sizeOptionId}
                    onChange={(sizeOptionId) => onPatch({ sizeOptionId })}
                    searchPlaceholder="Search sizes…"
                    allowEmpty={false}
                    placeholder="— Pick size —"
                    options={sizeOptions.map((o) => ({
                      value: o.id!,
                      label: formatOptionSelectLabel(
                        o,
                        Number(productDetail.basePrice),
                        sizePriceMode,
                      ),
                      keywords: o.label,
                    }))}
                  />
                </Field>
              )}
              {crustOptions.length > 0 && (
                <Field label="Crust">
                  <select
                    value={item.crustOptionId}
                    onChange={(e) => onPatch({ crustOptionId: e.target.value })}
                    className={selectClass}
                  >
                    {crustOptions.map((o) => {
                      const delta = Number(o.price);
                      return (
                        <option key={o.id} value={o.id}>
                          {o.label}
                          {delta === 0 ? "" : ` (+₹${delta.toFixed(0)})`}
                        </option>
                      );
                    })}
                  </select>
                </Field>
              )}
              {availToppings.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Toppings
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {availToppings.map((t) => {
                      const on = item.toppingSelections.includes(t.id);
                      const delta = Number(t.priceDelta);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleTopping(t.id)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                            on
                              ? "border-brand-500 bg-brand-100 text-brand-700"
                              : "border-slate-200 bg-white text-slate-600 hover:border-brand-300",
                          )}
                        >
                          {t.name}
                          {delta > 0 && (
                            <span className="ml-1 text-slate-500">
                              +₹{delta.toFixed(0)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {availCondiments.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Condiments / Extras
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {availCondiments.map((t) => {
                      const on = item.toppingSelections.includes(t.id);
                      const delta = Number(t.priceDelta);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleTopping(t.id)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                            on
                              ? "border-brand-500 bg-brand-100 text-brand-700"
                              : "border-slate-200 bg-white text-slate-600 hover:border-brand-300",
                          )}
                        >
                          {t.name}
                          {delta > 0 && (
                            <span className="ml-1 text-slate-500">
                              +₹{delta.toFixed(0)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {item.kind === "CUSTOM" && (
            <button
              type="button"
              onClick={() => onPatch({ expanded: !item.expanded })}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-brand-700"
            >
              {item.expanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {item.expanded ? "Hide" : "Show"} details (category, size, flavour,
              message, instructions)
            </button>
          )}

          {showCustomDetails && (
            <div className="mt-3 space-y-3">
              <Field label="Category">
                <select
                  value={item.customTemplate}
                  onChange={(e) =>
                    onPatch({
                      customTemplate: e.target.value as OrderItemDraft["customTemplate"],
                      cakeSizeId: "",
                      customPounds: "",
                      customPizzaSize: "",
                      flavourId: "",
                      customFlavour: "",
                      sizeLabel: "",
                      sizeGrams: "",
                      sizeOptionId: "",
                      crustOptionId: "",
                      crustLabel: "",
                      toppingSelections: [],
                    })
                  }
                  className={selectClass}
                >
                  <option value="CAKE">Cake</option>
                  <option value="PIZZA">Pizza</option>
                  <option value="OTHER">Other</option>
                </select>
              </Field>

              {isCustomCake ? (
                <div className="space-y-3 rounded-md border border-amber-100 bg-amber-50/40 p-3">
                  {activeCustomCakeSizes.length > 0 && (
                    <Field
                      label="Size (pounds)"
                      required={!item.customPounds.trim()}
                      hint="Pick a standard size, or enter custom pounds below."
                    >
                      <SearchableSelect
                        value={item.customPounds.trim() ? "" : item.cakeSizeId}
                        onChange={(cakeSizeId) =>
                          onPatch({ cakeSizeId, customPounds: "" })
                        }
                        searchPlaceholder="Search sizes…"
                        allowEmpty
                        placeholder={
                          item.customPounds.trim() &&
                          customCakeParsedPounds != null
                            ? formatCustomPoundLabel(customCakeParsedPounds)
                            : "— Pick size —"
                        }
                        options={activeCustomCakeSizes.map((s) => ({
                          value: s.id,
                          label: s.servesText
                            ? `${s.label} · ${s.grams}g · ${s.servesText}`
                            : `${s.label} · ${s.grams}g`,
                          keywords: s.label,
                        }))}
                      />
                    </Field>
                  )}
                  <Field
                    label="Custom pounds"
                    hint="Optional. Overrides the size dropdown — e.g. 2.5 for two-and-a-half pounds."
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={item.customPounds}
                        onChange={(e) =>
                          onPatch({
                            customPounds: e.target.value,
                            cakeSizeId: e.target.value.trim()
                              ? ""
                              : item.cakeSizeId,
                          })
                        }
                        placeholder="e.g. 2.5"
                        className={cn(inputClass, "w-28")}
                      />
                      <span className="text-sm text-slate-600">lb</span>
                      {customCakeGrams != null && (
                        <span className="text-xs text-slate-500">
                          · {customCakeGrams} g
                        </span>
                      )}
                    </div>
                  </Field>
                  {flavours.length > 0 && (
                    <Field
                      label="Flavour"
                      hint="Pick from your flavour list, or type a custom one below."
                    >
                      <SearchableSelect
                        value={item.flavourId}
                        onChange={(flavourId) => onPatch({ flavourId })}
                        searchPlaceholder="Search flavours…"
                        allowEmpty
                        placeholder="— Pick flavour —"
                        options={flavours.map((f) => {
                          const delta = Number(f.additionalAmount);
                          return {
                            value: f.id,
                            label:
                              delta > 0 ? `${f.name} (+₹${delta.toFixed(0)}/lb)` : f.name,
                            keywords: f.name,
                          };
                        })}
                      />
                    </Field>
                  )}
                  <Field
                    label="Custom flavour"
                    hint="Use when the flavour isn't in the list above."
                  >
                    <input
                      value={item.customFlavour}
                      onChange={(e) => onPatch({ customFlavour: e.target.value })}
                      placeholder="e.g. Ferrero Rocher, red velvet"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Message on cake">
                    <input
                      value={item.messageOnCake}
                      onChange={(e) =>
                        onPatch({ messageOnCake: e.target.value })
                      }
                      placeholder="Happy Birthday Aarav"
                      className={inputClass}
                    />
                  </Field>
                </div>
              ) : isCustomPizza ? (
                <div className="space-y-3 rounded-md border border-sky-100 bg-sky-50/40 p-3">
                  {pizzaSizePresets.length > 0 && (
                    <Field
                      label="Size"
                      required={!item.customPizzaSize.trim()}
                      hint="Pick a standard size label, or enter a custom size below."
                    >
                      <SearchableSelect
                        value={
                          item.customPizzaSize.trim() ? "" : item.sizeOptionId
                        }
                        onChange={(sizeKey) =>
                          onPatch({
                            sizeOptionId: sizeKey,
                            customPizzaSize: "",
                            sizeLabel: pizzaSizeLabelForKey(
                              pizzaSizePresets,
                              sizeKey,
                            ),
                          })
                        }
                        searchPlaceholder="Search sizes…"
                        allowEmpty
                        placeholder={
                          item.customPizzaSize.trim()
                            ? item.customPizzaSize.trim()
                            : "— Pick size —"
                        }
                        options={pizzaSizePresets.map((s) => ({
                          value: s.key,
                          label: s.label,
                          keywords: s.label,
                        }))}
                      />
                    </Field>
                  )}
                  <Field
                    label="Custom size"
                    hint='Optional. Overrides the dropdown — e.g. "7 inch" or "Medium".'
                  >
                    <input
                      value={item.customPizzaSize}
                      onChange={(e) =>
                        onPatch({
                          customPizzaSize: e.target.value,
                          sizeOptionId: e.target.value.trim()
                            ? ""
                            : item.sizeOptionId,
                          sizeLabel: e.target.value.trim() || item.sizeLabel,
                        })
                      }
                      placeholder="e.g. 7 inch"
                      className={inputClass}
                    />
                  </Field>
                  {pizzaCrustPresets.length > 0 && (
                    <Field label="Crust">
                      <select
                        value={item.crustOptionId}
                        onChange={(e) => {
                          const crust = pizzaCrustPresets.find(
                            (c) => c.id === e.target.value,
                          );
                          const oldCrust = pizzaCrustPresets.find(
                            (c) => c.id === item.crustOptionId,
                          );
                          const oldDelta = oldCrust?.price ?? 0;
                          const newDelta = crust?.price ?? 0;
                          onPatch({
                            crustOptionId: e.target.value,
                            crustLabel: crust?.label ?? "",
                            unitPrice: Math.max(
                              0,
                              Number(item.unitPrice || 0) + newDelta - oldDelta,
                            ).toFixed(0),
                          });
                        }}
                        className={selectClass}
                      >
                        <option value="">— Default —</option>
                        {pizzaCrustPresets.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                            {c.price === 0 ? "" : ` (+₹${c.price.toFixed(0)})`}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                  {customPizzaToppings.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                        Toppings
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {customPizzaToppings.map((t) => {
                          const on = item.toppingSelections.includes(t.id);
                          const delta = Number(t.priceDelta);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => toggleTopping(t.id)}
                              className={cn(
                                "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                                on
                                  ? "border-brand-500 bg-brand-100 text-brand-700"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-brand-300",
                              )}
                            >
                              {t.name}
                              {delta > 0 && (
                                <span className="ml-1 text-slate-500">
                                  +₹{delta.toFixed(0)}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {customPizzaCondiments.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                        Condiments / Extras
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {customPizzaCondiments.map((t) => {
                          const on = item.toppingSelections.includes(t.id);
                          const delta = Number(t.priceDelta);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => toggleTopping(t.id)}
                              className={cn(
                                "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                                on
                                  ? "border-brand-500 bg-brand-100 text-brand-700"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-brand-300",
                              )}
                            >
                              {t.name}
                              {delta > 0 && (
                                <span className="ml-1 text-slate-500">
                                  +₹{delta.toFixed(0)}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Size label">
                    <input
                      value={item.sizeLabel}
                      onChange={(e) => onPatch({ sizeLabel: e.target.value })}
                      placeholder="1 pound / 500g"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Size (grams)">
                    <input
                      type="number"
                      min={1}
                      value={item.sizeGrams}
                      onChange={(e) => onPatch({ sizeGrams: e.target.value })}
                      className={inputClass}
                    />
                  </Field>
                  {flavours.length > 0 && (
                    <Field label="Flavour">
                      <SearchableSelect
                        value={item.flavourId}
                        onChange={(flavourId) => onPatch({ flavourId })}
                        searchPlaceholder="Search flavours…"
                        allowEmpty
                        placeholder="— Pick flavour —"
                        options={flavours.map((f) => ({
                          value: f.id,
                          label: f.name,
                          keywords: f.name,
                        }))}
                      />
                    </Field>
                  )}
                </div>
              )}

              <Field label="Instructions">
                <input
                  value={item.instructions}
                  onChange={(e) => onPatch({ instructions: e.target.value })}
                  placeholder="Extra frosting, no nuts…"
                  className={inputClass}
                />
              </Field>
            </div>
          )}

          {item.kind === "CUSTOM" && (
            <Field
              label="Reference image"
              hint="Upload the photo the customer sent."
              className="mt-3"
            >
              <div className="flex flex-col items-start gap-3 sm:flex-row">
                {item.refPreview ? (
                  <img
                    src={item.refPreview}
                    alt="Reference"
                    className="h-24 w-24 shrink-0 rounded-lg object-cover ring-1 ring-slate-200"
                  />
                ) : item.keptImageUrl ? (
                  <div className="relative h-24 w-24 shrink-0">
                    <img
                      src={item.keptImageUrl}
                      alt="Reference"
                      className="h-full w-full rounded-lg object-cover ring-1 ring-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => onPatch({ keptImageUrl: null })}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 text-white transition hover:bg-slate-900"
                      aria-label="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400">
                    No image
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      onPatch({
                        refFile: file,
                        keptImageUrl: file ? null : item.keptImageUrl,
                      });
                    }}
                    className="block text-xs text-slate-600 file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-slate-200 file:bg-white file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-50"
                  />
                  {(item.refFile || item.keptImageUrl) && (
                    <button
                      type="button"
                      onClick={() =>
                        onPatch({ refFile: null, keptImageUrl: null })
                      }
                      className="mt-2 text-xs text-slate-500 hover:text-brand-500"
                    >
                      Remove image
                    </button>
                  )}
                </div>
              </div>
            </Field>
          )}
        </div>

        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
          aria-label="Remove item"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

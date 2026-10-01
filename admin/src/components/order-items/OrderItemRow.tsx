import { useEffect, useMemo } from "react";
import { ChevronDown, ChevronRight, ImagePlus, Package, Sparkles, Trash2, X } from "lucide-react";
import { useAdminProduct, type AdminProduct } from "@/hooks/useAdminProducts";
import type { AdminTopping } from "@/hooks/useToppings";
import type { AdminAddon } from "@/hooks/useAddons";
import { Field, inputClass, selectClass } from "@/components/form/Field";
import { SearchableSelect } from "@/components/form/SearchableSelect";
import { ImageLightboxThumb } from "@/components/ui/ImageLightboxThumb";
import { resetCatalogProductPick, type CatalogPicker } from "@/lib/catalogProductOptions";
import {
  availableFixedSkus,
  computeCakeUnitPrice,
  customPoundsToGrams,
  formatCustomPoundLabel,
  getSizeOptionGroup,
  isGramsWithinBounds,
  optionUnitPrice,
  parseCustomPounds,
} from "@/lib/productConfiguration";
import { Price, applyFactor, formatINR } from "@keyafe/shared";
import { cn } from "@/lib/cn";
import type { OrderItemDraft } from "./types";
import { AddonGroupPicker } from "./AddonGroupPicker";
import { usePizzaCatalogOptions, pizzaSizeLabelForKey } from "./usePizzaCatalogOptions";

export function OrderItemRow({
  index,
  item,
  products,
  catalogPicker,
  flavours,
  allToppings,
  allAddons,
  onPatch,
  onRemove,
  canRemove,
}: {
  index: number;
  item: OrderItemDraft;
  products: AdminProduct[];
  catalogPicker: CatalogPicker;
  flavours: Array<{ id: string; name: string; additionalAmount: string }>;
  allToppings: AdminTopping[];
  allAddons: AdminAddon[];
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
  const factor =
    item.kind === "CATALOG"
      ? (productDetail?.priceFactor ?? selectedProduct?.priceFactor ?? null)
      : null;

  const isPizza = item.kind === "CATALOG" && template === "PIZZA";
  const isCakeCatalog = item.kind === "CATALOG" && (template ?? "CAKE") === "CAKE";

  const sizeGroup = getSizeOptionGroup(productDetail);
  const sizeOptions = sizeGroup?.options ?? [];
  const sizePriceMode = sizeGroup?.priceMode ?? "ABSOLUTE";
  const crustOptions = productDetail?.crustOptions ?? [];
  const fixedSkus = availableFixedSkus(productDetail);
  const hasFixedSkus = fixedSkus.length > 0;
  const productFlavourIds = new Set(productDetail?.flavorIds ?? []);
  // Size choices from OptionGroup (not ProductVariant table).
  const hasOptionGroupSize = sizeOptions.length > 0 && !isPizza && !hasFixedSkus;
  const linkedToppingIds = new Set(productDetail?.toppingIds ?? []);
  const linkedToppings = allToppings.filter((t) => linkedToppingIds.has(t.id));
  const availToppings = linkedToppings.filter((t) => t.kind === "TOPPING");
  const linkedAddonIds = new Set(productDetail?.offeredAddonIds ?? productDetail?.addonIds ?? []);
  const catalogAddons = allAddons.filter((a) => a.isActive && linkedAddonIds.has(a.id));
  const customAddons = allAddons.filter(
    (a) => a.isActive && (a.templates ?? []).includes(item.customTemplate),
  );
  const availCondiments = linkedToppings.filter((t) => t.kind === "CONDIMENT");

  // Cake configurator — flavour + pounds with auto price (all CAKE catalog items).
  const isCakeConfigurator = isCakeCatalog && !isPizza && !hasFixedSkus && !hasOptionGroupSize;
  const hasAttachedFlavours = productFlavourIds.size > 0;
  const pickerFlavours = hasAttachedFlavours
    ? flavours.filter((f) => productFlavourIds.has(f.id))
    : flavours;

  const isCustomCake = item.kind === "CUSTOM" && item.customTemplate === "CAKE";
  const isCustomPizza = item.kind === "CUSTOM" && item.customTemplate === "PIZZA";

  const autoPriced = isPizza || isCakeConfigurator || hasOptionGroupSize || hasFixedSkus;

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

  useEffect(() => {
    if (item.kind !== "CATALOG" || !selectedProduct || !productDetail) return;
    const patch: Partial<OrderItemDraft> = {};
    if (!item.productName) patch.productName = selectedProduct.name;
    const simpleProduct = !autoPriced;
    if (!item.unitPrice && simpleProduct) {
      patch.unitPrice = applyFactor(Number(selectedProduct.basePrice), factor).toFixed(0);
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
      unitPrice: applyFactor(sku.price, factor).toFixed(0),
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
      unitPrice: applyFactor(optionUnitPrice(base, picked, sizePriceMode), factor).toFixed(0),
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
      patch.sizeOptionId = sizeOptions.find((o) => o.isDefault)?.id ?? sizeOptions[0].id ?? "";
    }
    if (!item.crustOptionId && crustOptions.length > 0) {
      patch.crustOptionId = crustOptions.find((o) => o.isDefault)?.id ?? crustOptions[0].id ?? "";
    }
    if (Object.keys(patch).length) onPatch(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPizza, productDetail]);

  // Default to 1 lb when cake product loads (pounds-only — no size dropdown).
  useEffect(() => {
    if (!isCakeConfigurator) return;
    if (item.customPounds.trim()) return;
    onPatch({ customPounds: "1", cakeSizeId: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCakeConfigurator, productDetail?.id]);

  // Preselect flavour when there's an obvious default.
  useEffect(() => {
    if (!isCakeConfigurator || item.flavourId || pickerFlavours.length === 0) return;
    onPatch({ flavourId: pickerFlavours[0].id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCakeConfigurator, productDetail?.id, pickerFlavours.length]);

  // Recompute unit price + size label when any pizza selection changes.
  const pickedSize = sizeOptions.find((o) => o.id === item.sizeOptionId);
  const pickedCrust = crustOptions.find((o) => o.id === item.crustOptionId);
  const pickedToppingsFull = allToppings.filter((t) => item.toppingSelections.includes(t.id));

  // Recompute cake price from pounds + flavour.
  useEffect(() => {
    if (!isCakeConfigurator || !productDetail) return;

    const base = Number(productDetail.basePrice);
    const flavour = pickerFlavours.find((f) => f.id === item.flavourId);
    const flavourAdditional = flavour ? Number(flavour.additionalAmount) : 0;

    const parsedPounds = parseCustomPounds(item.customPounds);
    if (parsedPounds == null) return;
    const grams = customPoundsToGrams(parsedPounds);
    if (!isGramsWithinBounds(grams, productDetail.minGrams, productDetail.maxGrams)) return;

    const computed = computeCakeUnitPrice(base, grams, flavourAdditional, hasAttachedFlavours);
    const addonsDelta = allAddons
      .filter((a) => item.addonSelections.includes(a.id))
      .reduce((s, a) => s + Number(a.priceDelta), 0);
    onPatch({
      unitPrice: (applyFactor(computed, factor) + addonsDelta).toFixed(0),
      sizeGrams: String(grams),
      sizeLabel: formatCustomPoundLabel(parsedPounds),
      cakeSizeId: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isCakeConfigurator,
    item.customPounds,
    item.flavourId,
    item.addonSelections.join("|"),
    productDetail,
    hasAttachedFlavours,
  ]);

  useEffect(() => {
    if (!isPizza || !productDetail) return;
    const sizePrice = pickedSize ? Number(pickedSize.price) : 0;
    const crustDelta = pickedCrust ? Number(pickedCrust.price) : 0;
    const toppingsDelta = pickedToppingsFull.reduce((s, t) => s + Number(t.priceDelta), 0);
    const addonsDelta = allAddons
      .filter((a) => item.addonSelections.includes(a.id))
      .reduce((s, a) => s + Number(a.priceDelta), 0);
    const computed =
      applyFactor(sizePrice, factor) +
      applyFactor(crustDelta, factor) +
      toppingsDelta +
      addonsDelta;
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
    item.addonSelections.join("|"),
  ]);

  // Custom cake — sync size label/grams from pounds.
  useEffect(() => {
    if (!isCustomCake || !item.expanded) return;

    const parsedPounds = parseCustomPounds(item.customPounds);
    if (parsedPounds == null) return;
    const grams = customPoundsToGrams(parsedPounds);
    onPatch({
      sizeLabel: formatCustomPoundLabel(parsedPounds),
      sizeGrams: String(grams),
      cakeSizeId: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCustomCake, item.expanded, item.customPounds]);

  // Default 1 lb when custom cake details open.
  useEffect(() => {
    if (!isCustomCake || !item.expanded) return;
    if (item.customPounds.trim()) return;
    onPatch({ customPounds: "1", cakeSizeId: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCustomCake, item.expanded]);

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
  }, [isCustomPizza, item.expanded, item.customPizzaSize, item.sizeOptionId]);

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
        unitPrice: Math.max(0, Number(item.unitPrice || 0) + priceAdjust).toFixed(0),
      });
      return;
    }

    onPatch({ toppingSelections: next });
  };

  const toggleAddon = (id: string) => {
    const isOn = item.addonSelections.includes(id);
    const addon = allAddons.find((a) => a.id === id);
    const delta = addon ? Number(addon.priceDelta) : 0;
    const next = isOn
      ? item.addonSelections.filter((x) => x !== id)
      : [...item.addonSelections, id];
    const priceIsManual = item.kind === "CUSTOM" || (!isPizza && !isCakeConfigurator);
    if (priceIsManual) {
      const priceAdjust = isOn ? -delta : delta;
      onPatch({
        addonSelections: next,
        unitPrice: Math.max(0, Number(item.unitPrice || 0) + priceAdjust).toFixed(0),
      });
      return;
    }
    onPatch({ addonSelections: next });
  };

  const cakeBasePrice = productDetail ? Number(productDetail.basePrice) : 0;
  const pickedCakeFlavour = pickerFlavours.find((f) => f.id === item.flavourId);
  const cakeFlavourAdditional = pickedCakeFlavour ? Number(pickedCakeFlavour.additionalAmount) : 0;
  const parsedCustomPounds = parseCustomPounds(item.customPounds);
  const customGrams = parsedCustomPounds != null ? customPoundsToGrams(parsedCustomPounds) : null;
  const customOutOfRange =
    customGrams != null &&
    productDetail != null &&
    !isGramsWithinBounds(customGrams, productDetail.minGrams, productDetail.maxGrams);
  const customPreviewPrice =
    customGrams != null && !customOutOfRange
      ? computeCakeUnitPrice(cakeBasePrice, customGrams, cakeFlavourAdditional, hasAttachedFlavours)
      : null;

  const pickedAddonsDelta = allAddons
    .filter((a) => item.addonSelections.includes(a.id))
    .reduce((s, a) => s + Number(a.priceDelta), 0);
  const originalUnitPrice = (() => {
    if (!factor || !productDetail) return null;
    if (isPizza) {
      const toppings = pickedToppingsFull.reduce((s, t) => s + Number(t.priceDelta), 0);
      return (
        (pickedSize ? Number(pickedSize.price) : 0) +
        (pickedCrust ? Number(pickedCrust.price) : 0) +
        toppings +
        pickedAddonsDelta
      );
    }
    if (isCakeConfigurator) {
      return customPreviewPrice != null ? customPreviewPrice + pickedAddonsDelta : null;
    }
    if (hasFixedSkus) {
      const sku = fixedSkus.find((v) => v.id === item.variantId);
      return sku ? sku.price + pickedAddonsDelta : null;
    }
    if (hasOptionGroupSize) {
      const picked = sizeOptions.find((o) => o.id === item.sizeOptionId);
      return picked
        ? optionUnitPrice(Number(productDetail.basePrice), picked, sizePriceMode) +
            pickedAddonsDelta
        : null;
    }
    return Number(productDetail.basePrice) + pickedAddonsDelta;
  })();
  const unitPriceNum = Number(item.unitPrice);
  const showWasHint =
    originalUnitPrice != null && item.unitPrice !== "" && unitPriceNum < originalUnitPrice;

  const showCustomDetails = item.kind === "CUSTOM" && item.expanded;
  const refImage = item.refPreview ?? item.keptImageUrl;
  const productImage =
    item.kind === "CATALOG" && item.productId
      ? (selectedProduct?.images[0] ?? productDetail?.images?.[0] ?? null)
      : null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase",
            item.kind === "CATALOG" ? "bg-sky-100 text-sky-700" : "bg-brand-100 text-brand-700",
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
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          className="-my-1 ml-auto rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
          aria-label="Remove item"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div>
        {item.kind === "CATALOG" && (
          <div className="mt-3 space-y-3">
            <div className="flex items-end gap-2 sm:gap-3">
              {productImage && (
                <ImageLightboxThumb
                  src={productImage}
                  alt={selectedProduct?.name ?? "Product"}
                  className="h-16 w-16 rounded-lg border border-slate-200 bg-white"
                />
              )}
              <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2 sm:gap-3">
                <Field label="Category">
                  <SearchableSelect
                    value={item.catalogCategoryId}
                    onChange={(catalogCategoryId) => {
                      const keepProduct =
                        !item.productId ||
                        catalogPicker.inCategory(item.productId, catalogCategoryId);
                      onPatch(
                        keepProduct
                          ? { catalogCategoryId }
                          : { catalogCategoryId, productId: "", ...resetCatalogProductPick() },
                      );
                    }}
                    searchPlaceholder="Search categories…"
                    placeholder="All categories"
                    options={catalogPicker.categoryOptions}
                  />
                </Field>
                <Field label="Product" required>
                  <SearchableSelect
                    value={item.productId}
                    onChange={(productId) => onPatch({ productId, ...resetCatalogProductPick() })}
                    searchPlaceholder="Search products…"
                    placeholder="— Pick product —"
                    options={catalogPicker.productOptions(item.catalogCategoryId)}
                  />
                </Field>
              </div>
            </div>

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
                    label: `${v.label} · ${priceLabel(v.price, factor)}`,
                    keywords: `${v.label} ${v.sku}`,
                  }))}
                />
              </Field>
            )}

            {item.productId && productDetail && hasOptionGroupSize && (
              <Field label={sizeGroup?.label ?? "Size"} required hint="From product option groups">
                <SearchableSelect
                  value={item.sizeOptionId}
                  onChange={(sizeOptionId) => onPatch({ sizeOptionId })}
                  searchPlaceholder="Search sizes…"
                  allowEmpty={false}
                  placeholder="— Pick size —"
                  options={sizeOptions.map((o) => ({
                    value: o.id!,
                    label: `${o.label} · ${priceLabel(
                      optionUnitPrice(Number(productDetail.basePrice), o, sizePriceMode),
                      factor,
                    )}`,
                    keywords: o.label,
                  }))}
                />
              </Field>
            )}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-[2fr_1fr_1fr] sm:gap-3">
          <Field
            label={item.kind === "CATALOG" ? "Name (override)" : "Name"}
            required
            className="col-span-2 sm:col-span-1"
          >
            <input
              value={item.productName}
              onChange={(e) => onPatch({ productName: e.target.value })}
              placeholder={
                item.kind === "CATALOG"
                  ? "Uses product name if blank"
                  : item.customTemplate === "PIZZA"
                    ? "e.g. Chicken BBQ pizza"
                    : item.customTemplate === "OTHER"
                      ? "Item name"
                      : "1 pound chocolate cake"
              }
              className={inputClass}
            />
          </Field>
          <Field label={autoPriced ? "Price (auto)" : "Price"} required>
            <input
              type="text"
              inputMode="decimal"
              value={item.unitPrice}
              onChange={(e) => onPatch({ unitPrice: e.target.value.replace(/[^\d.]/g, "") })}
              placeholder="500"
              disabled={autoPriced}
              className={cn(inputClass, autoPriced && "bg-slate-100 text-slate-600")}
            />
          </Field>
          <Field label="Qty" required>
            <input
              type="text"
              inputMode="numeric"
              value={item.qty}
              onChange={(e) => onPatch({ qty: e.target.value.replace(/\D/g, "") })}
              placeholder="1"
              className={inputClass}
            />
          </Field>
        </div>
        {showWasHint && (
          <p className="mt-1 text-[11px] text-slate-500">
            <Price
              prefix="Discounted"
              amount={unitPriceNum}
              original={originalUnitPrice}
              showBadge
            />
          </p>
        )}

        {isCakeConfigurator && productDetail && (
          <div className="mt-3 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-2 gap-y-3 sm:grid-cols-[5rem_minmax(9rem,1fr)_minmax(14rem,1.8fr)] sm:gap-2">
            <Field
              label="Pounds"
              required
              error={
                customOutOfRange
                  ? `Between ${productDetail.minGrams != null ? (productDetail.minGrams / 500).toFixed(1) : "0.1"}–${productDetail.maxGrams != null ? (productDetail.maxGrams / 500).toFixed(1) : "any"} lb`
                  : undefined
              }
            >
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={productDetail.minGrams ? productDetail.minGrams / 500 : 0.1}
                  max={productDetail.maxGrams ? productDetail.maxGrams / 500 : undefined}
                  step={0.1}
                  value={item.customPounds}
                  onChange={(e) => onPatch({ customPounds: e.target.value, cakeSizeId: "" })}
                  placeholder="1"
                  className={cn(inputClass, "w-full")}
                />
                <span className="shrink-0 text-xs text-slate-500">lb</span>
              </div>
            </Field>
            {pickerFlavours.length > 0 ? (
              <Field label="Flavour" required={!hasAttachedFlavours}>
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
                          ? `${f.name} (+${formatINR(applyFactor(delta, factor))}/lb)`
                          : f.name,
                      keywords: f.name,
                    };
                  })}
                />
              </Field>
            ) : (
              <div />
            )}
            <Field label="Message on cake" className="col-span-2 sm:col-span-1">
              <input
                value={item.messageOnCake}
                onChange={(e) => onPatch({ messageOnCake: e.target.value })}
                placeholder="Happy Birthday Aarav"
                className={inputClass}
              />
            </Field>
            {customPreviewPrice != null && (
              <p className="col-span-2 -mt-1 text-[11px] text-slate-500 sm:col-span-3">
                {formatINR(applyFactor(cakeBasePrice, factor))}/lb
                {factor ? ` (was ${formatINR(cakeBasePrice)})` : ""}
                {customGrams != null ? ` · ${customGrams}g` : ""}
                {hasAttachedFlavours ? " · flavour in recipe" : ""}
              </p>
            )}
          </div>
        )}

        {isPizza && productDetail && (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(9rem,14rem)_minmax(8rem,1fr)]">
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
                      label: `${o.label} · ${priceLabel(
                        optionUnitPrice(Number(productDetail.basePrice), o, sizePriceMode),
                        factor,
                      )}`,
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
                          {delta === 0 ? "" : ` (+${priceLabel(delta, factor)})`}
                        </option>
                      );
                    })}
                  </select>
                </Field>
              )}
            </div>
            {availToppings.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] font-medium text-slate-500">Toppings</p>
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
                            : "hover:border-brand-300 border-slate-200 bg-white text-slate-600",
                        )}
                      >
                        {t.name}
                        {delta > 0 && (
                          <span className="ml-1 text-slate-500">+₹{delta.toFixed(0)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {availCondiments.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] font-medium text-slate-500">Condiments</p>
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
                            : "hover:border-brand-300 border-slate-200 bg-white text-slate-600",
                        )}
                      >
                        {t.name}
                        {delta > 0 && (
                          <span className="ml-1 text-slate-500">+₹{delta.toFixed(0)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {item.kind === "CATALOG" && catalogAddons.length > 0 && (
          <div className="mt-3">
            <AddonGroupPicker
              addons={catalogAddons}
              selected={item.addonSelections}
              onToggle={toggleAddon}
            />
          </div>
        )}

        {item.kind === "CUSTOM" &&
          item.expanded &&
          customAddons.length === 0 &&
          allAddons.some((a) => a.isActive) && (
            <p className="mt-3 text-[11px] text-slate-400">
              No add-ons for {TEMPLATE_LABEL[item.customTemplate]} items yet — tick{" "}
              {TEMPLATE_LABEL[item.customTemplate]} under &ldquo;Offline custom items&rdquo; on the
              Add-ons page.
            </p>
          )}

        {item.kind === "CUSTOM" && customAddons.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-[11px] text-slate-400">
              Add-ons for the {TEMPLATE_LABEL[item.customTemplate]} category
              {!item.expanded && " · change it under details"}
            </p>
            <AddonGroupPicker
              addons={customAddons}
              selected={item.addonSelections}
              onToggle={toggleAddon}
            />
          </div>
        )}

        {item.kind === "CUSTOM" && (
          <button
            type="button"
            onClick={() => onPatch({ expanded: !item.expanded })}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-brand-700"
          >
            {item.expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {item.expanded
              ? "Hide details"
              : isCustomCake
                ? "Add pounds, flavour, message…"
                : isCustomPizza
                  ? "Add size, crust, toppings…"
                  : "Add description, size, notes…"}
          </button>
        )}

        {showCustomDetails && (
          <div className="mt-2 space-y-2">
            {isCustomCake ? (
              <>
                <div className="grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-[7rem_5rem_minmax(9rem,1fr)_minmax(9rem,1fr)] sm:gap-2">
                  <Field label="Category">
                    <select
                      value={item.customTemplate}
                      onChange={(e) =>
                        onPatch({
                          customTemplate: e.target.value as OrderItemDraft["customTemplate"],
                          cakeSizeId: "",
                          customPounds: e.target.value === "CAKE" ? item.customPounds || "1" : "",
                          customPizzaSize: "",
                          flavourId: "",
                          customFlavour: "",
                          sizeLabel: "",
                          sizeGrams: "",
                          sizeOptionId: "",
                          crustOptionId: "",
                          crustLabel: "",
                          toppingSelections: [],
                          addonSelections: [],
                        })
                      }
                      className={selectClass}
                    >
                      <option value="CAKE">Cake</option>
                      <option value="PIZZA">Pizza</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </Field>
                  <Field label="Pounds" required>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={item.customPounds}
                        onChange={(e) => onPatch({ customPounds: e.target.value, cakeSizeId: "" })}
                        placeholder="1"
                        className={cn(inputClass, "w-full")}
                      />
                      <span className="shrink-0 text-xs text-slate-500">lb</span>
                    </div>
                  </Field>
                  {flavours.length > 0 ? (
                    <Field label="Flavour">
                      <SearchableSelect
                        value={item.flavourId}
                        onChange={(flavourId) =>
                          onPatch({
                            flavourId,
                            customFlavour: flavourId ? "" : item.customFlavour,
                          })
                        }
                        searchPlaceholder="Search flavours…"
                        allowEmpty
                        placeholder="— Pick flavour —"
                        options={flavours.map((f) => {
                          const delta = Number(f.additionalAmount);
                          return {
                            value: f.id,
                            label: delta > 0 ? `${f.name} (+₹${delta.toFixed(0)}/lb)` : f.name,
                            keywords: f.name,
                          };
                        })}
                      />
                    </Field>
                  ) : (
                    <div />
                  )}
                  <Field label="Custom flavour">
                    <input
                      value={item.customFlavour}
                      onChange={(e) =>
                        onPatch({
                          customFlavour: e.target.value,
                          flavourId: e.target.value.trim() ? "" : item.flavourId,
                        })
                      }
                      placeholder="Not in list?"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Message on cake" className="col-span-2 sm:col-span-4">
                    <input
                      value={item.messageOnCake}
                      onChange={(e) => onPatch({ messageOnCake: e.target.value })}
                      placeholder="Happy Birthday Aarav"
                      className={inputClass}
                    />
                  </Field>
                </div>
              </>
            ) : isCustomPizza ? (
              <>
                <div className="grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-[7rem_minmax(8rem,11rem)_minmax(7rem,9rem)_minmax(8rem,1fr)] sm:gap-2">
                  <Field label="Category">
                    <select
                      value={item.customTemplate}
                      onChange={(e) =>
                        onPatch({
                          customTemplate: e.target.value as OrderItemDraft["customTemplate"],
                          cakeSizeId: "",
                          customPounds: e.target.value === "CAKE" ? "1" : "",
                          customPizzaSize: "",
                          flavourId: "",
                          customFlavour: "",
                          sizeLabel: "",
                          sizeGrams: "",
                          sizeOptionId: "",
                          crustOptionId: "",
                          crustLabel: "",
                          toppingSelections: [],
                          addonSelections: [],
                        })
                      }
                      className={selectClass}
                    >
                      <option value="CAKE">Cake</option>
                      <option value="PIZZA">Pizza</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </Field>
                  {pizzaSizePresets.length > 0 ? (
                    <Field label="Size" required={!item.customPizzaSize.trim()}>
                      <SearchableSelect
                        value={item.customPizzaSize.trim() ? "" : item.sizeOptionId}
                        onChange={(sizeKey) =>
                          onPatch({
                            sizeOptionId: sizeKey,
                            customPizzaSize: "",
                            sizeLabel: pizzaSizeLabelForKey(pizzaSizePresets, sizeKey),
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
                  ) : (
                    <div />
                  )}
                  <Field label="Custom size">
                    <input
                      value={item.customPizzaSize}
                      onChange={(e) =>
                        onPatch({
                          customPizzaSize: e.target.value,
                          sizeOptionId: e.target.value.trim() ? "" : item.sizeOptionId,
                          sizeLabel: e.target.value.trim() || item.sizeLabel,
                        })
                      }
                      placeholder="e.g. 7 inch"
                      className={inputClass}
                    />
                  </Field>
                  {pizzaCrustPresets.length > 0 ? (
                    <Field label="Crust">
                      <select
                        value={item.crustOptionId}
                        onChange={(e) => {
                          const crust = pizzaCrustPresets.find((c) => c.id === e.target.value);
                          onPatch({
                            crustOptionId: e.target.value,
                            crustLabel: crust?.label ?? "",
                          });
                        }}
                        className={selectClass}
                      >
                        <option value="">— Optional —</option>
                        {pizzaCrustPresets.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : (
                    <div />
                  )}
                </div>
                {(customPizzaToppings.length > 0 || customPizzaCondiments.length > 0) && (
                  <div className="space-y-2">
                    {customPizzaToppings.length > 0 && (
                      <div>
                        <p className="mb-1 text-[11px] font-medium text-slate-500">Toppings</p>
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
                                    : "hover:border-brand-300 border-slate-200 bg-white text-slate-600",
                                )}
                              >
                                {t.name}
                                {delta > 0 && (
                                  <span className="ml-1 text-slate-500">+₹{delta.toFixed(0)}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {customPizzaCondiments.length > 0 && (
                      <div>
                        <p className="mb-1 text-[11px] font-medium text-slate-500">Condiments</p>
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
                                    : "hover:border-brand-300 border-slate-200 bg-white text-slate-600",
                                )}
                              >
                                {t.name}
                                {delta > 0 && (
                                  <span className="ml-1 text-slate-500">+₹{delta.toFixed(0)}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 sm:grid-cols-[7rem_minmax(12rem,1fr)]">
                <Field label="Category">
                  <select
                    value={item.customTemplate}
                    onChange={(e) =>
                      onPatch({
                        customTemplate: e.target.value as OrderItemDraft["customTemplate"],
                        cakeSizeId: "",
                        customPounds: e.target.value === "CAKE" ? "1" : "",
                        customPizzaSize: "",
                        flavourId: "",
                        customFlavour: "",
                        sizeLabel: "",
                        sizeGrams: "",
                        sizeOptionId: "",
                        crustOptionId: "",
                        crustLabel: "",
                        messageOnCake: "",
                        toppingSelections: [],
                        addonSelections: [],
                      })
                    }
                    className={selectClass}
                  >
                    <option value="CAKE">Cake</option>
                    <option value="PIZZA">Pizza</option>
                    <option value="OTHER">Other</option>
                  </select>
                </Field>
                <Field label="Size / variant">
                  <input
                    value={item.sizeLabel}
                    onChange={(e) => onPatch({ sizeLabel: e.target.value, sizeGrams: "" })}
                    placeholder="e.g. half tray, 500ml"
                    className={inputClass}
                  />
                </Field>
              </div>
            )}

            <Field label="Description (optional)">
              <textarea
                value={item.description}
                onChange={(e) => onPatch({ description: e.target.value })}
                rows={3}
                maxLength={1000}
                placeholder={
                  isCustomPizza
                    ? "e.g. half veg, half paneer"
                    : isCustomCake
                      ? "e.g. 2-tier fondant, gold drip"
                      : "e.g. Gift hamper: 6 cupcakes, 1 candle, chocolates…"
                }
                className={cn(inputClass, "resize-y")}
              />
            </Field>

            <Field label="Instructions">
              <input
                value={item.instructions}
                onChange={(e) => onPatch({ instructions: e.target.value })}
                placeholder={
                  isCustomPizza
                    ? "Well done, light cheese…"
                    : isCustomCake
                      ? "Extra frosting, no nuts…"
                      : "Any special notes…"
                }
                className={inputClass}
              />
            </Field>
          </div>
        )}

        {item.kind === "CUSTOM" && (
          <div className="mt-3 flex items-center gap-3">
            <label className="group flex min-w-0 flex-1 cursor-pointer items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-white text-slate-400 transition group-hover:border-brand-500 group-hover:text-brand-600">
                {refImage ? (
                  <img src={refImage} alt="Reference" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="h-5 w-5" />
                )}
              </span>
              <span className="min-w-0 text-xs">
                <span className="block font-medium text-slate-700">
                  {refImage ? "Reference image" : "Add reference image"}
                </span>
                <span className="block truncate text-slate-500">
                  {refImage
                    ? (item.refFile?.name ?? "Tap to change")
                    : "The photo the customer sent"}
                </span>
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  if (file) onPatch({ refFile: file, keptImageUrl: null });
                }}
                className="sr-only"
              />
            </label>
            {refImage && (
              <button
                type="button"
                onClick={() => onPatch({ refFile: null, keptImageUrl: null })}
                className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                aria-label="Remove image"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const TEMPLATE_LABEL: Record<OrderItemDraft["customTemplate"], string> = {
  CAKE: "Cake",
  PIZZA: "Pizza",
  OTHER: "Other",
};

/** "₹200 (was ₹250)" when discounted — native options can't render a strike-through. */
function priceLabel(actual: number, factor: number | null): string {
  const now = applyFactor(actual, factor);
  return now < actual ? `${formatINR(now)} (was ${formatINR(actual)})` : formatINR(actual);
}

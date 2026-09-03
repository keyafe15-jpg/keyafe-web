import type {
  AdminOptionGroup,
  AdminProductDetail,
  AdminProductVariant,
  ProductOptionInput,
} from "@/hooks/useAdminProducts";

/** Customer-visible price for an option — respects group priceMode. */
export function optionUnitPrice(
  basePrice: number,
  option: Pick<ProductOptionInput, "price">,
  priceMode: AdminOptionGroup["priceMode"],
): number {
  const optionPrice = Number(option.price);
  return priceMode === "ABSOLUTE" ? optionPrice : basePrice + optionPrice;
}

export function formatOptionSelectLabel(
  option: ProductOptionInput,
  basePrice: number,
  priceMode: AdminOptionGroup["priceMode"],
): string {
  return `${option.label} · ₹${optionUnitPrice(basePrice, option, priceMode).toFixed(0)}`;
}

export function activeOptions(options: ProductOptionInput[]): ProductOptionInput[] {
  return options.filter((o) => o.isActive !== false && o.id);
}

export function getSizeOptionGroup(
  detail: AdminProductDetail | undefined,
): AdminOptionGroup | undefined {
  if (!detail) return undefined;
  const fromGroups = detail.optionGroups?.find((g) => g.key === "size");
  if (fromGroups && fromGroups.options.length > 0) return fromGroups;
  const legacy = activeOptions(detail.sizeOptions ?? []);
  if (legacy.length === 0) return undefined;
  return {
    id: "size",
    key: "size",
    label: "Size",
    priceMode: "ABSOLUTE",
    selectionType: "SINGLE",
    isRequired: true,
    sortOrder: 0,
    options: legacy,
  };
}

export function availableFixedSkus(
  detail: AdminProductDetail | undefined,
): AdminProductVariant[] {
  return (detail?.fixedVariants ?? []).filter((v) => v.isAvailable);
}

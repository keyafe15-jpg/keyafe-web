import type { AdminProduct } from "@/hooks/useAdminProducts";

/** Label for the product SearchableSelect — hints when option-group sizes exist. */
export function formatCatalogProductLabel(p: AdminProduct): string {
  if (p.priceMin !== p.priceMax) {
    return `${p.name} · from ₹${p.priceMin}`;
  }
  return `${p.name} · ₹${Number(p.basePrice).toFixed(0)}`;
}

/** Clears configuration state when the catalog product changes. */
export function resetCatalogProductPick(): {
  productName: string;
  unitPrice: string;
  sizeLabel: string;
  sizeGrams: string;
  flavourId: string;
  variantId: string;
  sizeOptionId: string;
  crustOptionId: string;
  crustLabel: string;
  cakeSizeId: string;
  toppingSelections: string[];
} {
  return {
    productName: "",
    unitPrice: "",
    sizeLabel: "",
    sizeGrams: "",
    flavourId: "",
    variantId: "",
    sizeOptionId: "",
    crustOptionId: "",
    crustLabel: "",
    cakeSizeId: "",
    toppingSelections: [],
  };
}

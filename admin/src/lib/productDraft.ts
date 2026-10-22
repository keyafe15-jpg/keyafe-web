import type { ProductOptionInput, ProductTemplate } from "@/hooks/useAdminProducts";
import { readDraft } from "@/lib/adminDraft";

export type ProductDraftPeek = {
  key: string;
  title: string;
  summary: string;
  kindLabel: string;
};

export const PRODUCT_FORM_DRAFT_KEY = "keyafe.admin.product-form.draft";
export const PRODUCT_BULK_DRAFT_KEY = "keyafe.admin.product-bulk.draft";

export type ProductFormDraft = {
  values: Record<string, unknown>;
  keptImages: string[];
  flavorIds: string[];
  tagIds: string[];
  toppingIds: string[];
  addonIds: string[];
  sizeOptions: ProductOptionInput[];
  crustOptions: ProductOptionInput[];
  slugTouched: boolean;
};

export type ProductBulkRowDraft = {
  key: string;
  name: string;
  slug: string;
  categoryIds: string[];
  basePrice: string;
  discountedPrice: string;
  template: ProductTemplate;
  productType: "FIXED_VARIANTS" | "CONFIGURABLE";
  shortDescription: string;
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

export type ProductBulkDraft = {
  rows: ProductBulkRowDraft[];
};

function firstFilled(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

export function peekProductFormDraft(): ProductDraftPeek | null {
  const data = readDraft<ProductFormDraft>(PRODUCT_FORM_DRAFT_KEY);
  if (!data?.values || typeof data.values !== "object") return null;
  const name = typeof data.values.name === "string" ? data.values.name.trim() : "";
  const slug = typeof data.values.slug === "string" ? data.values.slug.trim() : "";
  const short =
    typeof data.values.shortDescription === "string" ? data.values.shortDescription.trim() : "";
  const template = typeof data.values.template === "string" ? data.values.template : "";
  const title = firstFilled(name, slug, short) || "Untitled product";
  const bits = [
    template === "CAKE" ? "Cake" : template === "PIZZA" ? "Pizza" : template === "OTHER" ? "Other" : "",
    short && title !== short ? short : "",
  ].filter(Boolean);
  return {
    key: PRODUCT_FORM_DRAFT_KEY,
    title,
    summary: bits.join(" · "),
    kindLabel: "New product",
  };
}

export function peekProductBulkDraft(): ProductDraftPeek | null {
  const data = readDraft<ProductBulkDraft>(PRODUCT_BULK_DRAFT_KEY);
  if (!data || !Array.isArray(data.rows) || data.rows.length === 0) return null;
  const named = data.rows.filter((row) => row && typeof row.name === "string" && row.name.trim());
  const first = named[0]?.name.trim() ?? "";
  const title = first || "Untitled bulk add";
  const extra = named.length > 1 ? `+${named.length - 1} more` : named.length === 1 ? "1 product" : "";
  return {
    key: PRODUCT_BULK_DRAFT_KEY,
    title,
    summary: extra,
    kindLabel: "Bulk add",
  };
}

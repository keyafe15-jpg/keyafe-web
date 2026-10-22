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

export function productFormDraftHasContent(draft: ProductFormDraft): boolean {
  const values = draft.values ?? {};
  const name = typeof values.name === "string" ? values.name.trim() : "";
  const short = typeof values.shortDescription === "string" ? values.shortDescription.trim() : "";
  const description = typeof values.description === "string" ? values.description.trim() : "";
  const categories = Array.isArray(values.categoryIds) ? values.categoryIds.length : 0;
  const price = Number(values.basePrice);
  const discounted =
    typeof values.discountedPrice === "number"
      ? values.discountedPrice
      : Number(values.discountedPrice);
  return Boolean(
    name ||
      short ||
      description ||
      categories > 0 ||
      (Number.isFinite(price) && price > 0) ||
      (Number.isFinite(discounted) && discounted > 0) ||
      draft.keptImages.length ||
      draft.flavorIds.length ||
      draft.tagIds.length ||
      draft.sizeOptions.some((o) => o.label.trim()) ||
      draft.crustOptions.some((o) => o.label.trim()),
  );
}

export function productBulkDraftHasContent(draft: ProductBulkDraft): boolean {
  return draft.rows.some(
    (row) =>
      row.name.trim() ||
      row.basePrice.trim() ||
      row.shortDescription.trim() ||
      row.categoryIds.length > 0 ||
      row.sizeOptions.some((o) => o.label.trim()),
  );
}

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
  if (!productFormDraftHasContent(data)) return null;
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
  if (!productBulkDraftHasContent(data)) return null;
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

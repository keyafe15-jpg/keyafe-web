import type { AdminAddon } from "@/hooks/useAddons";
import type { CreateProductPayload } from "@/hooks/useAdminProducts";
import type { AdminTopping } from "@/hooks/useToppings";
import type { OrderItemDraft } from "./types";

export type CatalogSaveEntry = { item: OrderItemDraft; referenceImageUrl: string | null };

export function wantsCatalogSave(item: OrderItemDraft): boolean {
  return item.kind === "CUSTOM" && item.saveToCatalog;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
}

/**
 * A hidden (draft) product built from a custom order item. The add-ons and
 * toppings picked on the order are linked as options, so their prices come
 * off the item price to give the base price.
 */
export function toCatalogProductPayload(
  item: OrderItemDraft,
  referenceImageUrl: string | null,
  allToppings: AdminTopping[],
  allAddons: AdminAddon[],
): CreateProductPayload {
  const name = item.productName.trim();
  const isPizza = item.customTemplate === "PIZZA";
  const toppingIds = isPizza ? item.toppingSelections : [];
  const extras =
    allAddons
      .filter((a) => item.addonSelections.includes(a.id))
      .reduce((s, a) => s + Number(a.priceDelta), 0) +
    allToppings
      .filter((t) => toppingIds.includes(t.id))
      .reduce((s, t) => s + Number(t.priceDelta), 0);
  const suffix = crypto.randomUUID().slice(0, 6);

  return {
    name,
    slug: `${slugify(name) || "item"}-${suffix}`,
    shortDescription: item.sizeLabel.trim() || null,
    description: item.description.trim() || null,
    categoryIds: [item.saveCategoryId],
    images: referenceImageUrl ? [referenceImageUrl] : [],
    basePrice: Math.max(0, Number(item.unitPrice || 0) - extras),
    productType: "CONFIGURABLE",
    template: item.customTemplate,
    isCustomizable: false,
    isEggless: true,
    isSpicy: false,
    sellByPound: false,
    allowCustomSize: false,
    supportsMessageOnCake: item.customTemplate === "CAKE",
    messageMaxLength: 40,
    supportsSameDayDelivery: false,
    leadTimeHours: 24,
    canBeDeliveredPanIndia: false,
    isHealthyTreat: false,
    gstRate: 5,
    hsnCode: "1905",
    priceIsGstInclusive: true,
    allergens: [],
    adminNotes: "Added from an offline order. Check the details and photo, then set it active.",
    isActive: false,
    isAvailable: true,
    isFeatured: false,
    sortOrder: 0,
    flavorIds: item.customTemplate === "CAKE" && item.flavourId ? [item.flavourId] : [],
    tagIds: [],
    toppingIds,
    addonIds: item.addonSelections,
  };
}

/**
 * Creates the ticked items' products one by one. Failures are collected rather
 * than thrown: the order is already saved by the time this runs.
 */
export async function saveItemsToCatalog(
  entries: CatalogSaveEntry[],
  allToppings: AdminTopping[],
  allAddons: AdminAddon[],
  createProduct: (payload: CreateProductPayload) => Promise<unknown>,
): Promise<string[]> {
  const failed: string[] = [];
  for (const { item, referenceImageUrl } of entries) {
    if (!wantsCatalogSave(item)) continue;
    try {
      await createProduct(toCatalogProductPayload(item, referenceImageUrl, allToppings, allAddons));
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown error";
      failed.push(`${item.productName.trim()}: ${reason}`);
    }
  }
  return failed;
}

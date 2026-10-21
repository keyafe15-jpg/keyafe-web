import { extrasPlainText, parseLineNotes, splitCakeMessage } from "@keyafe/shared";
import type { OrderLinkItem, OrderLinkKind } from "@/hooks/useAdminOrderLinks";
import type { ProductTemplate } from "@/hooks/useAdminProducts";

const PIZZA_SPEC_GROUPS = new Set(["crust", "toppings", "condiments"]);

function linkHintToMessage(hint: string | null | undefined): string {
  const cake = splitCakeMessage(hint).message;
  const parsed = parseLineNotes(hint);
  const spec = parsed.extras.filter((e) => PIZZA_SPEC_GROUPS.has(e.group.trim().toLowerCase()));
  const notes = parsed.notes && parsed.notes !== cake ? parsed.notes : null;
  return [cake, spec.length ? extrasPlainText(spec) : null, notes].filter(Boolean).join("\n");
}

function addonIdsFromHint(
  hint: string | null | undefined,
  addons: Array<{ id: string; name: string }>,
): string[] {
  if (!hint?.trim() || addons.length === 0) return [];
  const names = new Set<string>();
  for (const extra of [...splitCakeMessage(hint).extras, ...parseLineNotes(hint).extras]) {
    if (PIZZA_SPEC_GROUPS.has(extra.group.trim().toLowerCase())) continue;
    for (const name of extra.names.split(",")) names.add(name.trim().toLowerCase());
  }
  if (names.size === 0) return [];
  return addons.filter((a) => names.has(a.name.trim().toLowerCase())).map((a) => a.id);
}

/** Shared line-item draft for offline direct orders and WhatsApp order links. */
export interface OrderItemDraft {
  id: string;
  kind: OrderLinkKind;
  /** Catalog items only — narrows the product picker; "" means all categories. */
  catalogCategoryId: string;
  productId: string;
  productName: string;
  sizeLabel: string;
  sizeGrams: string;
  flavourId: string;
  customFlavour: string;
  messageOnCake: string;
  instructions: string;
  /** Custom items only — what it is, e.g. the contents of a gift hamper. */
  description: string;
  unitPrice: string;
  qty: string;
  refFiles: File[];
  keptImageUrls: string[];
  expanded: boolean;

  /** Custom one-off items only — drives cake/pizza/other field sets. */
  customTemplate: ProductTemplate;

  sizeOptionId: string;
  crustOptionId: string;
  crustLabel: string;
  toppingSelections: string[];
  addonSelections: string[];

  cakeSizeId: string;
  customPounds: string;
  /** Custom pizza — free-text size when not picking a preset (e.g. "7 inch"). */
  customPizzaSize: string;
  variantId: string;

  /** Custom items only — also create a hidden product from this item once the order saves. */
  saveToCatalog: boolean;
  saveCategoryId: string;
}

export function newOrderItem(kind: OrderLinkKind = "CUSTOM"): OrderItemDraft {
  return {
    id: crypto.randomUUID(),
    kind,
    catalogCategoryId: "",
    productId: "",
    productName: "",
    sizeLabel: "",
    sizeGrams: "",
    flavourId: "",
    customFlavour: "",
    messageOnCake: "",
    instructions: "",
    description: "",
    unitPrice: "",
    qty: "1",
    refFiles: [],
    keptImageUrls: [],
    expanded: kind === "CUSTOM",
    customTemplate: "CAKE",
    sizeOptionId: "",
    crustOptionId: "",
    crustLabel: "",
    toppingSelections: [],
    addonSelections: [],
    cakeSizeId: "",
    customPounds: kind === "CUSTOM" ? "1" : "",
    customPizzaSize: "",
    variantId: "",
    saveToCatalog: false,
    saveCategoryId: "",
  };
}

export function orderLinkItemToDraft(
  it: OrderLinkItem,
  addons: Array<{ id: string; name: string }> = [],
): OrderItemDraft {
  return {
    id: it.id,
    kind: it.kind,
    catalogCategoryId: "",
    productId: it.productId ?? "",
    productName: it.productName,
    sizeLabel: it.sizeLabel ?? "",
    sizeGrams: it.sizeGrams ? String(it.sizeGrams) : "",
    customTemplate: it.customTemplate ?? "CAKE",
    flavourId: it.flavourId ?? "",
    customFlavour: !it.flavourId && it.flavourName ? it.flavourName : "",
    messageOnCake: linkHintToMessage(it.messageHint),
    instructions: "",
    description: it.description ?? "",
    unitPrice: Number(it.unitPrice).toFixed(0),
    qty: String(it.qty),
    refFiles: [],
    keptImageUrls:
      it.referenceImageUrls?.length
        ? it.referenceImageUrls
        : it.referenceImageUrl
          ? [it.referenceImageUrl]
          : [],
    expanded: it.kind === "CUSTOM",
    sizeOptionId: "",
    crustOptionId: "",
    crustLabel: "",
    toppingSelections: [],
    addonSelections: it.addonIds?.length ? it.addonIds : addonIdsFromHint(it.messageHint, addons),
    cakeSizeId: "",
    customPounds: it.sizeGrams ? String(Math.round((it.sizeGrams / 500) * 10) / 10) : "",
    customPizzaSize: it.customTemplate === "PIZZA" ? (it.sizeLabel ?? "") : "",
    variantId: "",
    saveToCatalog: false,
    saveCategoryId: "",
  };
}

import { extrasPlainText, parseLineNotes, splitCakeMessage } from "@keyafe/shared";
import type { OrderLinkItem, OrderLinkKind } from "@/hooks/useAdminOrderLinks";
import type { ProductTemplate } from "@/hooks/useAdminProducts";
import type { AdminOrderItem } from "@/hooks/useAdminOrders";

const PIZZA_SPEC_GROUPS = new Set(["crust", "toppings", "condiments"]);

function linkHintToMessage(hint: string | null | undefined): string {
  const cake = splitCakeMessage(hint).message;
  const parsed = parseLineNotes(hint);
  const spec = parsed.extras.filter((e) => PIZZA_SPEC_GROUPS.has(e.group.trim().toLowerCase()));
  const notes = parsed.notes && parsed.notes !== cake ? parsed.notes : null;
  return [cake, spec.length ? extrasPlainText(spec) : null, notes].filter(Boolean).join("\n");
}

export function addonIdsFromHint(
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

/** Drop rematched add-on segments so save can rewrite them without duplicating. */
export function leftoverNotesAfterAddons(
  raw: string | null | undefined,
  addons: Array<{ id: string; name: string }>,
): string {
  const text = raw?.trim() ?? "";
  if (!text) return "";
  const matched = new Set(addonIdsFromHint(text, addons));
  const matchedNames = new Set(
    addons.filter((a) => matched.has(a.id)).map((a) => a.name.trim().toLowerCase()),
  );
  const parsed = parseLineNotes(text);
  const kept: string[] = [];
  for (const extra of parsed.extras) {
    if (PIZZA_SPEC_GROUPS.has(extra.group.trim().toLowerCase())) {
      kept.push(`${extra.group}: ${extra.names}`);
      continue;
    }
    const remaining = extra.names
      .split(",")
      .map((n) => n.trim())
      .filter((n) => n && !matchedNames.has(n.toLowerCase()));
    if (remaining.length) kept.push(`${extra.group}: ${remaining.join(", ")}`);
  }
  if (parsed.notes) kept.push(parsed.notes);
  return kept.join("\n");
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
  /** When true, the full editor is open; when false, a compact readonly summary. */
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

  /**
   * Hydrated from a saved order. Catalog auto-price stays off until staff
   * change size / crust / flavour / add-ons.
   */
  priceFrozen: boolean;
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
    expanded: true,
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
    priceFrozen: false,
  };
}

export function extraChargeItem(): OrderItemDraft {
  return {
    ...newOrderItem("CUSTOM"),
    customTemplate: "OTHER",
    productName: "Extra charge",
    customPounds: "",
    qty: "1",
    expanded: true,
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
    expanded: false,
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
    priceFrozen: false,
  };
}

function leftoverKitchenNotes(
  raw: string | null | undefined,
  addons: Array<{ id: string; name: string }>,
): string {
  const text = leftoverNotesAfterAddons(raw, addons);
  if (!text) return "";
  const parsed = parseLineNotes(text);
  const kept: string[] = [];
  for (const extra of parsed.extras) {
    if (PIZZA_SPEC_GROUPS.has(extra.group.trim().toLowerCase())) continue;
    kept.push(`${extra.group}: ${extra.names}`);
  }
  if (parsed.notes) kept.push(parsed.notes);
  return kept.join("\n");
}

function namesFromExtra(extras: { group: string; names: string }[], group: string): string[] {
  return extras
    .filter((extra) => extra.group.trim().toLowerCase() === group)
    .flatMap((extra) =>
      extra.names
        .split(/[·,]/)
        .map((name) => name.trim())
        .filter(Boolean),
    );
}

function matchIdsByName<T extends { id: string; name: string }>(names: string[], rows: T[]): string[] {
  if (names.length === 0 || rows.length === 0) return [];
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  return rows.filter((row) => wanted.has(row.name.trim().toLowerCase())).map((row) => row.id);
}

function inferTemplate(it: AdminOrderItem, productTemplate?: ProductTemplate): ProductTemplate {
  if (productTemplate) return productTemplate;
  const extras = [
    ...parseLineNotes(it.instructions).extras,
    ...splitCakeMessage(it.messageOnCake).extras,
  ];
  if (extras.some((e) => PIZZA_SPEC_GROUPS.has(e.group.trim().toLowerCase()))) return "PIZZA";
  if (/pizza/i.test(it.productName)) return "PIZZA";
  if (
    it.flavourId ||
    it.flavourName ||
    splitCakeMessage(it.messageOnCake).message ||
    it.sizeGrams ||
    /\blb\b/i.test(it.sizeLabel ?? "")
  ) {
    return "CAKE";
  }
  return "OTHER";
}

function poundsFromItem(it: AdminOrderItem): string {
  if (it.sizeGrams && it.sizeGrams > 0) {
    return String(Math.round((it.sizeGrams / 500) * 10) / 10);
  }
  const fromLabel = it.sizeLabel?.match(/(\d+(?:\.\d+)?)\s*lb/i);
  return fromLabel ? fromLabel[1]! : "";
}

/** Saved order line → the same draft the take-order editor uses. */
export function adminOrderItemToDraft(
  it: AdminOrderItem,
  opts: {
    product?: { template: ProductTemplate; categories?: { id: string }[] };
    addons?: Array<{ id: string; name: string }>;
    toppings?: Array<{ id: string; name: string }>;
    flavours?: Array<{ id: string; name: string }>;
  } = {},
): OrderItemDraft {
  const addons = opts.addons ?? [];
  const toppings = opts.toppings ?? [];
  const flavours = opts.flavours ?? [];
  const kind: OrderLinkKind = it.productId ? "CATALOG" : "CUSTOM";
  const customTemplate = inferTemplate(it, opts.product?.template);
  const extras = [
    ...parseLineNotes(it.instructions).extras,
    ...splitCakeMessage(it.messageOnCake).extras,
  ];
  const crustLabel = namesFromExtra(extras, "crust")[0] ?? "";
  const toppingNames = [
    ...namesFromExtra(extras, "toppings"),
    ...namesFromExtra(extras, "condiments"),
  ];
  const flavourId =
    (it.flavourId && flavours.some((f) => f.id === it.flavourId) ? it.flavourId : "") ||
    flavours.find((f) => f.name.trim().toLowerCase() === (it.flavourName ?? "").trim().toLowerCase())
      ?.id ||
    "";
  const pounds = poundsFromItem(it);
  const refs = it.referenceImageUrls?.length
    ? it.referenceImageUrls
    : it.referenceImageUrl
      ? [it.referenceImageUrl]
      : [];

  return {
    id: it.id,
    kind,
    catalogCategoryId: opts.product?.categories?.[0]?.id ?? "",
    productId: it.productId ?? "",
    productName: it.productName,
    sizeLabel: it.sizeLabel ?? "",
    sizeGrams: it.sizeGrams != null ? String(it.sizeGrams) : "",
    customTemplate,
    flavourId,
    customFlavour: !flavourId && it.flavourName ? it.flavourName : "",
    messageOnCake: splitCakeMessage(it.messageOnCake).message ?? "",
    instructions: leftoverKitchenNotes(it.instructions, addons),
    description: it.description ?? "",
    unitPrice: String(Number(it.unitPrice)),
    qty: String(it.qty),
    refFiles: [],
    keptImageUrls: refs,
    expanded: false,
    sizeOptionId: "",
    crustOptionId: "",
    crustLabel,
    toppingSelections: matchIdsByName(toppingNames, toppings),
    addonSelections: addonIdsFromHint(
      [it.instructions, it.messageOnCake].filter(Boolean).join("\n"),
      addons,
    ),
    cakeSizeId: "",
    customPounds: customTemplate === "CAKE" ? pounds || (kind === "CUSTOM" ? "1" : "") : "",
    customPizzaSize: customTemplate === "PIZZA" ? (it.sizeLabel ?? "") : "",
    variantId: "",
    saveToCatalog: false,
    saveCategoryId: "",
    priceFrozen: true,
  };
}

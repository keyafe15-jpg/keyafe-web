import type { OrderLinkItem, OrderLinkKind } from "@/hooks/useAdminOrderLinks";
import type { ProductTemplate } from "@/hooks/useAdminProducts";

/** Shared line-item draft for offline direct orders and WhatsApp order links. */
export interface OrderItemDraft {
  id: string;
  kind: OrderLinkKind;
  productId: string;
  productName: string;
  sizeLabel: string;
  sizeGrams: string;
  flavourId: string;
  customFlavour: string;
  messageOnCake: string;
  instructions: string;
  unitPrice: string;
  qty: string;
  refFile: File | null;
  refPreview: string | null;
  keptImageUrl: string | null;
  expanded: boolean;

  /** Custom one-off items only — drives cake/pizza/other field sets. */
  customTemplate: ProductTemplate;

  sizeOptionId: string;
  crustOptionId: string;
  crustLabel: string;
  toppingSelections: string[];

  cakeSizeId: string;
  customPounds: string;
  /** Custom pizza — free-text size when not picking a preset (e.g. "7 inch"). */
  customPizzaSize: string;
  variantId: string;
}

export function newOrderItem(kind: OrderLinkKind = "CATALOG"): OrderItemDraft {
  return {
    id: crypto.randomUUID(),
    kind,
    productId: "",
    productName: "",
    sizeLabel: "",
    sizeGrams: "",
    flavourId: "",
    customFlavour: "",
    messageOnCake: "",
    instructions: "",
    unitPrice: "",
    qty: "1",
    refFile: null,
    refPreview: null,
    keptImageUrl: null,
    expanded: false,
    customTemplate: "CAKE",
    sizeOptionId: "",
    crustOptionId: "",
    crustLabel: "",
    toppingSelections: [],
    cakeSizeId: "",
    customPounds: "",
    customPizzaSize: "",
    variantId: "",
  };
}

export function orderLinkItemToDraft(it: OrderLinkItem): OrderItemDraft {
  return {
    id: it.id,
    kind: it.kind,
    productId: it.productId ?? "",
    productName: it.productName,
    sizeLabel: it.sizeLabel ?? "",
    sizeGrams: it.sizeGrams ? String(it.sizeGrams) : "",
    customTemplate: "CAKE",
    flavourId: it.flavourId ?? "",
    customFlavour:
      !it.flavourId && it.flavourName ? it.flavourName : "",
    messageOnCake: it.messageHint ?? "",
    instructions: "",
    unitPrice: Number(it.unitPrice).toFixed(0),
    qty: String(it.qty),
    refFile: null,
    refPreview: null,
    keptImageUrl: it.referenceImageUrl,
    expanded: it.kind === "CUSTOM",
    sizeOptionId: "",
    crustOptionId: "",
    crustLabel: "",
    toppingSelections: [],
    cakeSizeId: "",
    customPounds: "",
    customPizzaSize: "",
    variantId: "",
  };
}

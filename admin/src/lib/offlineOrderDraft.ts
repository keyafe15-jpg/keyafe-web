import { newOrderItem, type OrderItemDraft } from "@/components/order-items";
import type { PaymentLineDraft } from "@/components/form/PaymentLinesEditor";
import type { ManualDiscountType } from "@/lib/manualDiscount";
import type { DeliveryDistrict } from "@/hooks/useAdminDeliveryPincodes";
import { clearDraft, readDraft, useDebouncedDraftSave, writeDraft } from "@/lib/adminDraft";

export { clearDraft, readDraft, useDebouncedDraftSave, writeDraft };

export const PLACE_DRAFT_KEY = "keyafe.admin.offline-place.draft";
export const LINK_DRAFT_KEY = "keyafe.admin.offline-link.draft";

export type StoredOrderItem = Omit<OrderItemDraft, "refFiles">;

export type StoredPaymentLine = {
  key: string;
  method: PaymentLineDraft["method"];
  amount: string;
  screenshotUrl?: string | null;
};

export type PlaceDraftPincodeInfo = {
  serviceable: boolean;
  city?: string | null;
  area?: string | null;
  state?: string | null;
  stateCode?: string | null;
  deliveryFee: number;
};

export type PlaceDraft = {
  items: StoredOrderItem[];
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  recipientIsCustomer: boolean;
  recipientName: string;
  deliveryPhone: string;
  isSurpriseGift: boolean;
  billingSameAsDelivery: boolean;
  billLine1: string;
  billLine2: string;
  billLandmark: string;
  billMapSearchQuery: string;
  billPincode: string;
  isBusinessOrder: boolean;
  customerCompanyName: string;
  customerGstin: string;
  fulfillment: "DELIVERY" | "PICKUP";
  line1: string;
  line2: string;
  landmark: string;
  mapSearchQuery: string;
  pincode: string;
  pincodeInfo: PlaceDraftPincodeInfo | null;
  deliveryDate: string;
  placedOnInput: string;
  placedOnTouched: boolean;
  slotKey: string;
  customerNotes: string;
  adminNotes: string;
  paymentPlan: "FULL" | "ADVANCE" | "ON_DELIVERY";
  paymentLines: StoredPaymentLine[];
  discountType: ManualDiscountType;
  discountValue: string;
  deliveryFeeInput: string;
  deliveryPaidToRider: boolean;
  lastChargedFee: number | null;
  savePincode: boolean;
  zoneCity: string;
  zoneArea: string;
  zoneDistrict: DeliveryDistrict;
};

export type LinkDraft = {
  items: StoredOrderItem[];
  customerName: string;
  customerPhone: string;
  adminNotes: string;
  expiresInDays: string;
  discountType: ManualDiscountType;
  discountValue: string;
  deliveryFeeInput: string;
  deliveryPaidToRider: boolean;
  allowOnlinePayment: boolean;
};

export type DraftPeek = {
  key: string;
  title: string;
  summary: string;
  kindLabel: string;
};

function itemHasContent(item: {
  productName?: string;
  unitPrice?: string;
  description?: string;
  messageOnCake?: string;
  customFlavour?: string;
  keptImageUrls?: string[];
}): boolean {
  return Boolean(
    item.productName?.trim() ||
      (item.unitPrice && Number(item.unitPrice) > 0) ||
      item.description?.trim() ||
      item.messageOnCake?.trim() ||
      item.customFlavour?.trim() ||
      item.keptImageUrls?.length,
  );
}

export function placeDraftHasContent(draft: Partial<PlaceDraft>): boolean {
  return Boolean(
    draft.customerName?.trim() ||
      draft.customerPhone?.trim() ||
      draft.customerEmail?.trim() ||
      draft.line1?.trim() ||
      draft.pincode?.trim() ||
      draft.adminNotes?.trim() ||
      draft.customerNotes?.trim() ||
      draft.discountValue?.trim() ||
      draft.deliveryFeeInput?.trim() ||
      draft.recipientName?.trim() ||
      draft.items?.some(itemHasContent) ||
      draft.paymentLines?.some((line) => line.amount?.trim() && Number(line.amount) > 0),
  );
}

export function linkDraftHasContent(draft: Partial<LinkDraft>): boolean {
  return Boolean(
    draft.customerName?.trim() ||
      draft.customerPhone?.trim() ||
      draft.adminNotes?.trim() ||
      draft.discountValue?.trim() ||
      draft.deliveryFeeInput?.trim() ||
      draft.items?.some(itemHasContent),
  );
}

function firstFilled(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

export function peekDraft(key: string): DraftPeek | null {
  const data = readDraft<Partial<PlaceDraft & LinkDraft>>(key);
  if (!data) return null;
  const hasContent = key === PLACE_DRAFT_KEY ? placeDraftHasContent(data) : linkDraftHasContent(data);
  if (!hasContent) return null;
  const items = Array.isArray(data.items) ? data.items : [];
  const namedItems = items.filter(
    (it) => it && typeof it === "object" && typeof it.productName === "string" && it.productName.trim(),
  );
  const customerName = typeof data.customerName === "string" ? data.customerName.trim() : "";
  const phone = typeof data.customerPhone === "string" ? data.customerPhone.trim() : "";
  const firstItem = namedItems[0]?.productName?.trim() ?? "";
  const line1 = typeof data.line1 === "string" ? data.line1.trim() : "";
  const title = firstFilled(customerName, firstItem, phone, line1) || "Untitled draft";

  const bits: string[] = [];
  if (customerName && title !== customerName) bits.push(customerName);
  if (phone && title !== phone) bits.push(phone);
  if (firstItem && title !== firstItem) {
    bits.push(namedItems.length > 1 ? `${firstItem} +${namedItems.length - 1}` : firstItem);
  } else if (namedItems.length > 1) {
    bits.push(`+${namedItems.length - 1} more`);
  } else if (namedItems.length === 1) {
    bits.push("1 item");
  } else if (items.length > 0) {
    bits.push(items.length === 1 ? "1 item started" : `${items.length} items started`);
  }

  return {
    key,
    title,
    summary: bits.join(" · "),
    kindLabel: key === PLACE_DRAFT_KEY ? "Full details" : "Customer link",
  };
}

export function serializeItems(items: OrderItemDraft[]): StoredOrderItem[] {
  return items.map(({ refFiles: _files, ...rest }) => rest);
}

export function restoreItems(raw: unknown): OrderItemDraft[] {
  if (!Array.isArray(raw) || raw.length === 0) return [newOrderItem()];
  return raw.map((row) => {
    const base = newOrderItem();
    if (!row || typeof row !== "object") return base;
    const o = row as Partial<OrderItemDraft>;
    return {
      ...base,
      ...o,
      id: typeof o.id === "string" && o.id ? o.id : base.id,
      refFiles: [],
      keptImageUrls: Array.isArray(o.keptImageUrls)
        ? o.keptImageUrls.filter((u): u is string => typeof u === "string")
        : [],
      toppingSelections: Array.isArray(o.toppingSelections)
        ? o.toppingSelections.filter((u): u is string => typeof u === "string")
        : [],
      addonSelections: Array.isArray(o.addonSelections)
        ? o.addonSelections.filter((u): u is string => typeof u === "string")
        : [],
    };
  });
}

export function serializePaymentLines(lines: PaymentLineDraft[]): StoredPaymentLine[] {
  return lines.map((line) => ({
    key: line.key,
    method: line.method,
    amount: line.amount,
    screenshotUrl: line.screenshotUrl ?? null,
  }));
}

export function restorePaymentLines(raw: unknown): PaymentLineDraft[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ key: crypto.randomUUID(), method: "cash", amount: "", screenshotFile: null, screenshotUrl: null }];
  }
  return raw.map((row) => {
    const o = row && typeof row === "object" ? (row as Partial<StoredPaymentLine>) : {};
    return {
      key: typeof o.key === "string" && o.key ? o.key : crypto.randomUUID(),
      method: o.method ?? "cash",
      amount: typeof o.amount === "string" ? o.amount : "",
      screenshotFile: null,
      screenshotUrl: typeof o.screenshotUrl === "string" ? o.screenshotUrl : null,
    };
  });
}


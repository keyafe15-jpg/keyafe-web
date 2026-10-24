export const BUY_ITEM_UNITS = ["KG", "L", "PCS", "PACKET"] as const;
export type BuyItemUnit = (typeof BUY_ITEM_UNITS)[number];

export const PURCHASE_PURPOSES = ["PRODUCTION", "TRIAL", "WASTE"] as const;
export type PurchasePurpose = (typeof PURCHASE_PURPOSES)[number];

export const EXPENSE_PURPOSES = ["PRODUCTION", "TRIAL", "WASTE", "OPS", "MARKETING"] as const;
export type ExpensePurpose = (typeof EXPENSE_PURPOSES)[number];

export const BOOKS_PAY_METHODS = ["UPI", "CASH", "BANK"] as const;
export type BooksPaymentMethod = (typeof BOOKS_PAY_METHODS)[number];

export const DISCOUNT_REASONS = [
  "COUPON",
  "DELIVERY",
  "INFLUENCER",
  "GOODWILL",
  "STAFF",
  "OTHER",
] as const;
export type DiscountReason = (typeof DISCOUNT_REASONS)[number];

export function unitLabel(unit: string) {
  if (unit === "KG") return "kg";
  if (unit === "L") return "L";
  if (unit === "PCS") return "pcs";
  if (unit === "PACKET") return "pack";
  return unit;
}

export function packUnitLabel(unit: string, packSize?: number | null) {
  if (packSize && packSize > 1) return `${packSize}-pc pack`;
  return unitLabel(unit);
}

export function lineQtyLabel(qty: number, unit: string, packSize?: number | null) {
  if (packSize && packSize > 1) {
    return `${qty} × ${packSize}-pc pack (${qty * packSize} pc)`;
  }
  return `${qty} ${unitLabel(unit)}`;
}

export function purposeLabel(purpose: string) {
  if (purpose === "PRODUCTION") return "Shop";
  if (purpose === "TRIAL") return "Trial";
  if (purpose === "WASTE") return "Waste";
  if (purpose === "OPS") return "Ops";
  if (purpose === "MARKETING") return "Marketing";
  return purpose;
}

export function isSalaryCategory(category: { slug?: string } | string | null | undefined) {
  if (!category) return false;
  return (typeof category === "string" ? category : category.slug) === "salary";
}

export function payLabel(method: string) {
  if (method === "CASH") return "Cash";
  if (method === "UPI") return "UPI";
  if (method === "BANK") return "Bank";
  return method;
}

export function discountReasonLabel(reason: string) {
  if (reason === "COUPON") return "Coupon / listed offer";
  if (reason === "DELIVERY") return "Delivery";
  if (reason === "INFLUENCER") return "Influencer / collab";
  if (reason === "GOODWILL") return "Goodwill / regular";
  if (reason === "STAFF") return "Staff";
  if (reason === "OTHER") return "Other";
  return reason;
}

export function isShippingChargeName(name: string) {
  const n = name.trim().toLowerCase().replace(/\s+/g, " ");
  return (
    n.includes("shipping") ||
    n.includes("delivery charge") ||
    n === "delivery" ||
    n === "delhivery" ||
    n === "courier"
  );
}

export function isMiscChargeName(name: string) {
  const n = name.trim().toLowerCase().replace(/\s+/g, " ");
  if (isShippingChargeName(n)) return false;
  return (
    n.includes("handling") ||
    n.includes("convenience") ||
    n.includes("platform fee") ||
    n.includes("platform charge") ||
    n.includes("service charge") ||
    n.includes("service fee") ||
    n.includes("processing") ||
    n.includes("surcharge") ||
    n.includes("packing charge") ||
    n.includes("packing fee") ||
    n.includes("packaging charge") ||
    n.includes("packaging fee") ||
    n.includes("extra charge") ||
    n.includes("other charge") ||
    n.includes("miscellaneous") ||
    n.includes("misc charge")
  );
}

export function inr(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function booksMoney(amount: number | null | undefined, masked?: boolean) {
  if (masked || amount == null) return "••••";
  return inr(amount);
}

export function booksDeleteConfirm(kind: "buy" | "expense" | "delivery") {
  if (kind === "delivery") {
    return "Delete this delivery cost? It will drop out of the books and clear what we paid on the order.";
  }
  return `Delete this ${kind}? It will drop out of the books.`;
}

export function formatBooksDate(isoDay: string) {
  return new Date(`${isoDay}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function rateCompareLabel(vsLast: number | null, vsCheapest90: number | null) {
  const bits: string[] = [];
  if (vsLast !== null && vsLast !== 0) {
    bits.push(
      vsLast > 0
        ? `${inr(vsLast)} more than last time`
        : `${inr(Math.abs(vsLast))} less than last time`,
    );
  }
  if (vsCheapest90 !== null && vsCheapest90 > 0) {
    bits.push(`${inr(vsCheapest90)} above the cheapest in 90 days`);
  }
  return bits.join(" · ");
}

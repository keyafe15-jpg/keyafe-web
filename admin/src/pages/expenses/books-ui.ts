export const BUY_ITEM_UNITS = ["KG", "L", "PCS", "PACKET"] as const;
export type BuyItemUnit = (typeof BUY_ITEM_UNITS)[number];

export const PURCHASE_PURPOSES = ["PRODUCTION", "TRIAL", "WASTE"] as const;
export type PurchasePurpose = (typeof PURCHASE_PURPOSES)[number];

export const EXPENSE_PURPOSES = ["PRODUCTION", "TRIAL", "WASTE", "OPS", "MARKETING"] as const;
export type ExpensePurpose = (typeof EXPENSE_PURPOSES)[number];

export const BOOKS_PAY_METHODS = ["CASH", "UPI", "BANK"] as const;
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
    n === "delivery charge" ||
    n === "delivery charges" ||
    n === "delhivery"
  );
}

export function inr(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
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

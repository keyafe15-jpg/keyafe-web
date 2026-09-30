/** Modes staff can record on offline orders. For reference only; nothing is charged. */
export const OFFLINE_PAYMENT_METHODS = ["cash", "upi", "netbanking"] as const;
export type OfflinePaymentMethod = (typeof OFFLINE_PAYMENT_METHODS)[number];

/** Cash collections, which the GST export leaves out. */
export const CASH_PAYMENT_METHODS = ["cod", "cash"];

const LABELS: Record<string, string> = {
  cod: "Cash on delivery",
  cash: "Cash",
  upi: "UPI transfer",
  netbanking: "Netbanking",
  cashfree: "Online (Cashfree)",
  razorpay: "Online (Razorpay)",
};

export function paymentMethodLabel(method: string) {
  return LABELS[method] ?? method.toUpperCase();
}

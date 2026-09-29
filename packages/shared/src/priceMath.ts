/** Whole-rupee INR with Indian digit grouping, e.g. ₹1,299. */
export function formatINR(value: number | string): string {
  return `₹${Math.round(Number(value)).toLocaleString("en-IN")}`;
}

/** Payable price for an actual price under the product's discount factor. */
export function applyFactor(actual: number, factor: number | null | undefined): number {
  return factor ? Math.round(actual * factor) : actual;
}

/** Rounded % off, or 0 when there is no real discount. */
export function discountPercent(amount: number, original: number | null | undefined): number {
  if (!original || original <= amount) return 0;
  return Math.round((1 - amount / original) * 100);
}

/**
 * Lowest customer-visible price before any discount — the base price, or the
 * smallest size when priced by size. Mirrors the server's calculation.
 */
export function actualStartingPrice(
  basePrice: number,
  sizePrices: number[],
  priceMode: "ABSOLUTE" | "DELTA" = "ABSOLUTE",
): number {
  if (sizePrices.length === 0) return basePrice;
  const min = Math.min(...sizePrices);
  return priceMode === "ABSOLUTE" ? min : basePrice + min;
}

export interface GstLine {
  /** Line amount before any cart-level discount. */
  amount: number;
  gstRate?: number | string | null;
  /** Only an explicit `false` adds GST; unknown lines are treated as GST-inclusive. */
  priceIsGstInclusive?: boolean | null;
}

/**
 * GST charged on top of lines priced exclusive of GST, after spreading a
 * cart-level discount in proportion to line value — the same split the server
 * uses. Inclusive lines already contain their GST and add nothing.
 */
export function gstAddedOnTop(lines: GstLine[], discount = 0): number {
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const scale = subtotal > 0 ? Math.max(0, subtotal - discount) / subtotal : 1;
  const gst = lines.reduce((s, l) => {
    const rate = Number(l.gstRate);
    if (l.priceIsGstInclusive !== false || !(rate > 0)) return s;
    return s + l.amount * scale * (rate / 100);
  }, 0);
  return Math.round(gst * 100) / 100;
}

type Amount = number | string;

/** GST a placed order charged on top: whatever the total holds beyond subtotal − discount + delivery. */
export function orderGstOnTop(order: {
  subtotal: Amount;
  discount: Amount;
  deliveryFee: Amount;
  total: Amount;
}): number {
  const extra =
    Number(order.total) -
    (Number(order.subtotal) - Number(order.discount) + Number(order.deliveryFee));
  const rounded = Math.round(extra * 100) / 100;
  return rounded > 0 ? rounded : 0;
}

/** discountedPrice / starting price, or null unless 0 < discounted < start. */
export function priceFactorFor(
  actualStart: number,
  discountedPrice: number | null | undefined,
): number | null {
  if (discountedPrice == null) return null;
  if (!(discountedPrice > 0) || !(actualStart > 0) || discountedPrice >= actualStart) return null;
  return discountedPrice / actualStart;
}

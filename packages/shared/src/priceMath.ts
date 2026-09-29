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

/** discountedPrice / starting price, or null unless 0 < discounted < start. */
export function priceFactorFor(
  actualStart: number,
  discountedPrice: number | null | undefined,
): number | null {
  if (discountedPrice == null) return null;
  if (!(discountedPrice > 0) || !(actualStart > 0) || discountedPrice >= actualStart) return null;
  return discountedPrice / actualStart;
}

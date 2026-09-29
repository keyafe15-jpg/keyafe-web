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

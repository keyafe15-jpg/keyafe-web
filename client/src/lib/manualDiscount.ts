export type ManualDiscountType = "FLAT" | "PERCENT";

export function manualDiscountRupees(
  subtotal: number,
  type: ManualDiscountType | null | undefined,
  value: number | string | null | undefined,
): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (
    !type ||
    n == null ||
    !Number.isFinite(n) ||
    n <= 0 ||
    subtotal <= 0
  ) {
    return 0;
  }
  if (type === "PERCENT") {
    const pct = Math.min(100, n);
    return Math.round(Math.min(subtotal, (subtotal * pct) / 100) * 100) / 100;
  }
  return Math.round(Math.min(subtotal, n) * 100) / 100;
}

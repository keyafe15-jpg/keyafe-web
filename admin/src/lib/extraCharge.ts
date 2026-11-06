export function isExtraChargeItem(item: { productName?: string | null }): boolean {
  return item.productName?.trim().toLowerCase() === "extra charge";
}

export function isZeroExtraCharge(item: {
  productName?: string | null;
  unitPrice?: unknown;
  lineTotal?: unknown;
}): boolean {
  if (!isExtraChargeItem(item)) return false;
  const n = Number(item.unitPrice ?? item.lineTotal ?? 0);
  return !Number.isFinite(n) || n <= 0;
}

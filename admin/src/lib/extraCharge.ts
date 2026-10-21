export function isZeroExtraCharge(item: {
  productName?: string | null;
  unitPrice?: unknown;
  lineTotal?: unknown;
}): boolean {
  if (item.productName?.trim().toLowerCase() !== "extra charge") return false;
  const n = Number(item.unitPrice ?? item.lineTotal ?? 0);
  return !Number.isFinite(n) || n <= 0;
}

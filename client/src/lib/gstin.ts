import { GST_STATE_NAMES } from "./indiaStates";

// Kept in sync with server/src/lib/gstin.ts — the server revalidates on submit,
// this copy exists so a typo is caught before the customer hits Place order.
//
// 15 characters: state code, PAN, registration count, reserved "Z", check digit.
//   27 AAACR5055K 1 Z 7
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function normalizeGstin(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

/** Mod-36 check digit over the first 14 characters. */
export function gstinCheckDigit(first14: string): string {
  let total = 0;
  for (let i = 0; i < first14.length; i++) {
    const value = CHARSET.indexOf(first14[i]!);
    if (value < 0) return "";
    const product = value * (i % 2 === 0 ? 1 : 2);
    total += Math.floor(product / 36) + (product % 36);
  }
  return CHARSET[(36 - (total % 36)) % 36]!;
}

/** Reason the GSTIN is invalid, or null when it is valid. */
export function gstinIssue(raw: string): string | null {
  const gstin = normalizeGstin(raw);
  if (gstin.length !== 15) return "GSTIN must be exactly 15 characters";
  if (!GSTIN_RE.test(gstin)) return "That does not look like a valid GSTIN";
  if (!GST_STATE_NAMES[gstin.slice(0, 2)]) {
    return `Unknown GST state code "${gstin.slice(0, 2)}"`;
  }
  if (gstinCheckDigit(gstin.slice(0, 14)) !== gstin[14]) {
    return "GSTIN checksum does not match — please re-check the number";
  }
  return null;
}

export function isValidGstin(raw: string): boolean {
  return gstinIssue(raw) === null;
}

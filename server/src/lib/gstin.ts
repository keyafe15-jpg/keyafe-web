import { z } from "zod";
import { GST_STATE_NAMES } from "./indiaStates.js";

// A GSTIN is 15 characters: 2-digit state code, the holder's 10-character PAN,
// a 1-character registration count, a reserved "Z", and a mod-36 check digit.
//   27 AAACR5055K 1 Z 7
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Uppercases and strips spaces/hyphens so pasted values validate. */
export function normalizeGstin(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

/**
 * Mod-36 check digit over the first 14 characters. Weights alternate 1, 2 from
 * the left; each product is folded by adding its quotient and remainder over
 * 36, and the digit is the complement of the total.
 */
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

/**
 * Returns a human-readable reason the GSTIN is invalid, or null when it is
 * valid. The check digit means a typo is caught here rather than surfacing as a
 * rejected invoice later.
 */
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

/** State the buyer is registered in. Not the place of supply. */
export function gstinStateCode(raw: string): string | null {
  const gstin = normalizeGstin(raw);
  return GST_STATE_NAMES[gstin.slice(0, 2)] ? gstin.slice(0, 2) : null;
}

/**
 * Optional buyer GST fields, shared by the storefront, order-link and offline
 * order schemas. Empty strings normalise to null so an untouched B2B toggle
 * doesn't store a blank GSTIN.
 */
export const buyerGstFields = {
  customerCompanyName: z
    .string()
    .trim()
    .max(160)
    .optional()
    .nullable()
    .transform((v) => v || null),
  customerGstin: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? normalizeGstin(v) : null))
    .refine((v) => v === null || gstinIssue(v) === null, {
      message: "Enter a valid 15-character GSTIN",
    }),
};

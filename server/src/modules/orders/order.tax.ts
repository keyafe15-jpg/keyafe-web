import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { roundMoney } from "../coupons/coupon.service.js";
import { normalizeStateCode, stateCodeFromName } from "../../lib/indiaStates.js";
import { gstinStateCode } from "../../lib/gstin.js";

// Used only if BusinessSettings has no usable registered-address state code.
// Keyafe is registered in West Bengal.
export const FALLBACK_SELLER_STATE_CODE = "19";

/** Reads the seller's own GST state from BusinessSettings. */
export async function getSellerStateCode(): Promise<string> {
  const settings = await prisma.businessSettings.findFirst({
    select: { registeredAddress: true },
  });
  const address = settings?.registeredAddress as
    { state?: string | null; stateCode?: string | null } | null | undefined;
  return (
    normalizeStateCode(address?.stateCode) ??
    stateCodeFromName(address?.state) ??
    FALLBACK_SELLER_STATE_CODE
  );
}

export interface AddressLike {
  state?: string | null;
  stateCode?: string | null;
}

/**
 * Place of supply, which decides CGST+SGST vs IGST.
 *
 * A registered buyer's GSTIN wins over the delivery address. These orders are
 * bill-to/ship-to supplies under section 10(1)(b) of the IGST Act: the goods
 * are delivered on the direction of the registered business, so that business
 * is deemed to have received them and its own state is the place of supply.
 * Charging IGST is also what lets the buyer claim input tax credit, which a
 * West Bengal CGST+SGST invoice would not.
 *
 * Without a GSTIN it falls back to section 10(1)(a) — the state the goods are
 * delivered to, or the seller's own state for a counter pickup. Resolution
 * never defaults to "assume intra-state", because that would silently
 * under-charge IGST.
 *
 * `localZoneStateCode` covers admin/offline orders: DeliveryPincode has no
 * state column, so a serviceable local pincode implies the seller's state.
 */
export function resolvePlaceOfSupply(args: {
  fulfillment: "DELIVERY" | "PICKUP";
  deliveryAddress: AddressLike | null | undefined;
  sellerStateCode: string;
  localZoneStateCode?: string | null;
  buyerGstin?: string | null;
}): string {
  // Schema validation already rejects a GSTIN with an unknown state code, but
  // an order-link or legacy row could still carry one, so this stays a
  // fallback rather than a throw.
  const fromGstin = args.buyerGstin ? gstinStateCode(args.buyerGstin) : null;
  if (fromGstin) return fromGstin;

  if (args.fulfillment === "PICKUP") return args.sellerStateCode;

  const fromAddress =
    normalizeStateCode(args.deliveryAddress?.stateCode) ??
    stateCodeFromName(args.deliveryAddress?.state);
  if (fromAddress) return fromAddress;

  const fromZone = normalizeStateCode(args.localZoneStateCode);
  if (fromZone) return fromZone;

  throw HttpError.badRequest(
    "Delivery state is required to calculate GST. Please select the state on the address.",
  );
}

export interface LineTaxInput {
  /** Line amount actually charged, after any cart discount is allocated to it. */
  lineInclusive: number;
  gstRate: number;
  priceIsGstInclusive: boolean;
  isIntraState: boolean;
}

export interface LineTax {
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
}

/**
 * Splits one line into taxable value and GST. Rounded to paise so the stored
 * per-line values sum exactly to the order-level totals, which is what lets the
 * invoice's HSN summary foot against the order.
 */
export function computeLineTax(input: LineTaxInput): LineTax {
  const rate = Number.isFinite(input.gstRate) ? input.gstRate : 0;
  const gross = input.lineInclusive;

  const taxableValue = input.priceIsGstInclusive ? gross / (1 + rate / 100) : gross;
  const gstAmount = input.priceIsGstInclusive ? gross - taxableValue : gross * (rate / 100);

  if (input.isIntraState) {
    const half = roundMoney(gstAmount / 2);
    return {
      taxableValue: roundMoney(taxableValue),
      // Derive the second half from the total so the two halves always add up
      // to the GST charged, even when the total ends on an odd paisa.
      cgstAmount: half,
      sgstAmount: roundMoney(roundMoney(gstAmount) - half),
      igstAmount: 0,
    };
  }
  return {
    taxableValue: roundMoney(taxableValue),
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: roundMoney(gstAmount),
  };
}

/** Order-level GST snapshot, summed from the per-line values. */
export function sumLineTax(lines: LineTax[]): {
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
} {
  return lines.reduce(
    (acc, l) => ({
      taxableAmount: roundMoney(acc.taxableAmount + l.taxableValue),
      cgstAmount: roundMoney(acc.cgstAmount + l.cgstAmount),
      sgstAmount: roundMoney(acc.sgstAmount + l.sgstAmount),
      igstAmount: roundMoney(acc.igstAmount + l.igstAmount),
    }),
    { taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 },
  );
}

/**
 * Spreads a cart-level discount across lines in proportion to their value, so
 * each line can be taxed on what the customer actually paid for it. Any
 * rounding drift lands on the last line, keeping the sum exact.
 *
 * The coupon path on the storefront uses `discountedLineInclusives` instead,
 * which additionally honours category restrictions.
 */
export function allocateCartDiscount(lineTotals: number[], discount: number): number[] {
  const original = lineTotals.map((v) => roundMoney(v));
  if (discount <= 0) return original;

  const subtotal = roundMoney(original.reduce((s, v) => s + v, 0));
  if (subtotal <= 0) return original;

  const scale = (subtotal - discount) / subtotal;
  const out = original.map((v) => roundMoney(v * scale));

  const applied = roundMoney(original.reduce((s, v, idx) => s + (v - (out[idx] ?? 0)), 0));
  const drift = roundMoney(discount - applied);
  if (drift !== 0 && out.length > 0) {
    out[out.length - 1] = roundMoney((out[out.length - 1] ?? 0) - drift);
  }
  return out;
}

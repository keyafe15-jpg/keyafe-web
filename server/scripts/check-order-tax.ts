// Sanity checks for the GST line-tax helper. Run: pnpm --filter server exec tsx scripts/check-order-tax.ts
import {
  allocateCartDiscount,
  computeLineTax,
  sumLineTax,
} from "../src/modules/orders/order.tax.js";
import {
  normalizeStateCode,
  stateCodeFromName,
} from "../src/lib/indiaStates.js";
import { gstinIssue, normalizeGstin } from "../src/lib/gstin.js";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}${ok ? "" : `\n        got ${a}\n        want ${e}`}`);
}

// --- inclusive pricing, intra-state: ₹1000 at 5% inclusive
const intra = computeLineTax({
  lineInclusive: 1000,
  gstRate: 5,
  priceIsGstInclusive: true,
  isIntraState: true,
});
check("inclusive intra taxable", intra.taxableValue, 952.38);
check("inclusive intra cgst+sgst = gst", intra.cgstAmount + intra.sgstAmount, 47.62);
check("inclusive intra no igst", intra.igstAmount, 0);
check(
  "inclusive intra foots to gross",
  Math.round((intra.taxableValue + intra.cgstAmount + intra.sgstAmount) * 100) / 100,
  1000,
);

// --- same line, inter-state: total tax must be identical, only the split differs
const inter = computeLineTax({
  lineInclusive: 1000,
  gstRate: 5,
  priceIsGstInclusive: true,
  isIntraState: false,
});
check("igst equals cgst+sgst total", inter.igstAmount, intra.cgstAmount + intra.sgstAmount);
check("inter taxable unchanged", inter.taxableValue, intra.taxableValue);

// --- exclusive pricing
const excl = computeLineTax({
  lineInclusive: 1000,
  gstRate: 5,
  priceIsGstInclusive: false,
  isIntraState: true,
});
check("exclusive taxable is gross", excl.taxableValue, 1000);
check("exclusive gst on top", excl.cgstAmount + excl.sgstAmount, 50);

// --- odd-paisa split must not lose a paisa
const odd = computeLineTax({
  lineInclusive: 333.33,
  gstRate: 5,
  priceIsGstInclusive: true,
  isIntraState: true,
});
check(
  "odd paisa halves foot to gross",
  Math.round((odd.taxableValue + odd.cgstAmount + odd.sgstAmount) * 100) / 100,
  333.33,
);

// --- discount allocation is exact
const lines = [1000, 555.55, 333.33];
const discounted = allocateCartDiscount(lines, 200);
const before = Math.round(lines.reduce((s, v) => s + v, 0) * 100) / 100;
const after = Math.round(discounted.reduce((s, v) => s + v, 0) * 100) / 100;
check("discount allocated exactly", Math.round((before - after) * 100) / 100, 200);
check("no discount is a no-op", allocateCartDiscount(lines, 0), lines);

// --- order totals foot to the sum of stored line values
const cart = [
  { gross: 1000, rate: 5, incl: true },
  { gross: 555.55, rate: 18, incl: true },
  { gross: 333.33, rate: 12, incl: false },
];
const charged = allocateCartDiscount(cart.map((c) => c.gross), 150);
const taxes = cart.map((c, i) =>
  computeLineTax({
    lineInclusive: charged[i]!,
    gstRate: c.rate,
    priceIsGstInclusive: c.incl,
    isIntraState: true,
  }),
);
const totals = sumLineTax(taxes);
const summed = {
  taxableAmount:
    Math.round(taxes.reduce((s, t) => s + t.taxableValue, 0) * 100) / 100,
  cgstAmount: Math.round(taxes.reduce((s, t) => s + t.cgstAmount, 0) * 100) / 100,
  sgstAmount: Math.round(taxes.reduce((s, t) => s + t.sgstAmount, 0) * 100) / 100,
  igstAmount: 0,
};
check("order totals = sum of lines", totals, summed);

// --- state resolution
check("normalize single digit", normalizeStateCode("9"), "09");
check("normalize numeric", normalizeStateCode(19), "19");
check("reject unknown code", normalizeStateCode("88"), null);
check("reject empty", normalizeStateCode(""), null);
check("name West Bengal", stateCodeFromName("West Bengal"), "19");
check("name case/space insensitive", stateCodeFromName("  west   bengal "), "19");
check("alias Orissa", stateCodeFromName("Orissa"), "21");
check("alias NCT of Delhi", stateCodeFromName("NCT of Delhi"), "07");
check("ampersand form", stateCodeFromName("Jammu & Kashmir"), "01");
check("Telangana", stateCodeFromName("Telangana"), "36");
check("unknown name", stateCodeFromName("Atlantis"), null);

// --- GSTIN validation. These four are documented-valid numbers.
for (const valid of [
  "27AAACR5055K1Z7",
  "12AAACI1681G1Z0",
  "27AAPFU0939F1ZV",
  "29AAGCB7383J1Z4",
]) {
  check(`gstin ${valid} accepted`, gstinIssue(valid), null);
}
check("lowercase accepted", gstinIssue("27aaacr5055k1z7"), null);
check("spaces stripped", gstinIssue(" 27 AAACR5055K1Z7 "), null);
check("normalize uppercases", normalizeGstin(" 27aaacr5055k1z7 "), "27AAACR5055K1Z7");

// Wrong check digit: last character bumped by one.
check(
  "bad checksum rejected",
  gstinIssue("27AAACR5055K1Z8"),
  "GSTIN checksum does not match — please re-check the number",
);
// State code 47 does not exist.
check(
  "unknown state code rejected",
  gstinIssue("47AAACI1681G1ZN"),
  'Unknown GST state code "47"',
);
check("too short rejected", gstinIssue("27AAACR5055K1Z"), "GSTIN must be exactly 15 characters");
check("empty rejected", gstinIssue(""), "GSTIN must be exactly 15 characters");
check(
  "wrong shape rejected",
  gstinIssue("2AAACR5055K1ZZ7"),
  "That does not look like a valid GSTIN",
);
// 14th character must be a literal Z.
check(
  "non-Z 14th char rejected",
  gstinIssue("27AAACR5055K1A7"),
  "That does not look like a valid GSTIN",
);
// A transposition the checksum is known not to catch would still pass shape
// checks, so confirm a single-character typo in the PAN is caught.
check(
  "single-char PAN typo caught",
  gstinIssue("27AAACR5055K1Z7".replace("R5055", "R5065")) !== null,
  true,
);

console.log(failures === 0 ? "\nAll checks passed" : `\n${failures} check(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);

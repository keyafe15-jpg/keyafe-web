import type { PincodeCheckResult } from "@/hooks/usePincodeCheck";

const MISSING_DETAILS: [fields: string[], label: string][] = [
  [["date"], "a date"],
  [["name"], "your name"],
  [["phone"], "your phone number"],
  [["email"], "a valid email"],
  [["companyName", "gstin"], "your GST details"],
  [["recipientName", "deliveryPhone"], "the recipient's details"],
  [["mapSearchQuery", "line1", "pincode", "stateCode"], "your delivery address"],
  [["billMapSearchQuery", "billLine1", "billPincode", "billStateCode"], "the billing address"],
  [["advanceAmount"], "an advance amount"],
];

/**
 * Short reason an order button is blocked, e.g. "Add your name and delivery
 * address to continue", or null when nothing is missing.
 */
export function missingDetailsHint(
  errors: Record<string, string>,
  pincodeResult?: PincodeCheckResult | null,
): string | null {
  if (errors.schedule) return "Update your delivery date & time to continue";
  if (errors.pincode && pincodeResult && !pincodeResult.serviceable) return errors.pincode;
  const missing = MISSING_DETAILS.filter(([fields]) => fields.some((f) => errors[f])).map(
    ([, label], i) => (i > 0 ? label.replace(/^your /, "") : label),
  );
  if (missing.length === 0) return null;
  const list =
    missing.length === 1
      ? missing[0]
      : `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}`;
  return `Add ${list} to continue`;
}

/** Brings the first field showing an error into view after a blocked submit. */
export function scrollToFirstFieldError() {
  requestAnimationFrame(() => {
    document
      .querySelector("[data-field-error]")
      ?.closest("label")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

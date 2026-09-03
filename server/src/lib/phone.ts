/** Digits only — used for coupon per-customer limits. */
export function digitsPhone(phone: string): string {
  const raw = phone.replace(/\D/g, "");
  return raw.length > 10 ? raw.slice(-10) : raw;
}

/**
 * Canonical phone for DB storage and lookup.
 * Indian mobiles → 10-digit (9876543210). Other numbers keep a + prefix.
 */
export function normalizeCustomerPhone(value: string): string {
  const compact = value.trim().replace(/[\s().-]/g, "");
  const digits = compact.replace(/\D/g, "");

  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return digits;
  }
  if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2))) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith("0") && /^[6-9]/.test(digits.slice(1))) {
    return digits.slice(1);
  }

  if (compact.startsWith("+")) {
    return `+${digits}`;
  }
  return digits || compact;
}

/** Legacy rows may use +91… while checkout sends 10-digit — try all variants. */
export function phoneLookupVariants(phone: string): string[] {
  const canonical = normalizeCustomerPhone(phone);
  const variants = new Set<string>([canonical]);
  const digits = canonical.replace(/\D/g, "");

  if (/^[6-9]\d{9}$/.test(digits)) {
    variants.add(digits);
    variants.add(`+91${digits}`);
    variants.add(`91${digits}`);
    variants.add(`0${digits}`);
  }

  return [...variants];
}

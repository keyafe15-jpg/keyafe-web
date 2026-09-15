/** 500g = 1 pound = reference unit for basePrice. */
export const CAKE_BASE_GRAMS = 500;

/**
 * Volume discount above 1 lb: ₹50 off per half-pound step above 1 lb.
 * Example: 1.5 lb → linear × 1.5 − ₹50; 2 lb → × 2 − ₹100; ≤1 lb → no discount.
 */
export const CAKE_VOLUME_DISCOUNT_PER_HALF_LB = 30;

export function gramsToPounds(grams: number): number {
  return grams / CAKE_BASE_GRAMS;
}

export function cakeVolumeDiscount(grams: number): number {
  const pounds = gramsToPounds(grams);
  if (!(pounds > 1)) return 0;
  const halfPoundsAboveOne = (pounds - 1) / 0.5;
  return CAKE_VOLUME_DISCOUNT_PER_HALF_LB * halfPoundsAboveOne;
}

/**
 * Cake unit price before add-ons / slot surcharge.
 * (basePrice + flavourAdditional) × (grams/500) − volume discount.
 */
export function computeCakeUnitPrice(
  basePrice: number,
  grams: number,
  flavourAdditional = 0,
  flavourPricedIn = false,
): number {
  const pounds = gramsToPounds(grams);
  const delta = flavourPricedIn ? 0 : flavourAdditional;
  const linear = (basePrice + delta) * pounds;
  return Math.max(0, Math.round(linear - cakeVolumeDiscount(grams)));
}

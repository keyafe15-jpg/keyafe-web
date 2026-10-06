/** 500g = 1 pound = reference unit for basePrice. */
export const CAKE_BASE_GRAMS = 500;

/** Added to cakes under 1 lb; the result never exceeds the 1 lb price. */
export const CAKE_SMALL_SIZE_EXTRA = 100;

/** Lowest cake price before any product discount factor. */
export const CAKE_MIN_PRICE = 300;

/**
 * Volume discount above 1 lb. Each slab's rate applies only to the
 * half-pounds that fall inside it, so the discount grows without jumps.
 */
export const CAKE_VOLUME_SLABS: readonly { upToPounds: number; offPerHalfPound: number }[] = [
  { upToPounds: 2, offPerHalfPound: 30 },
  { upToPounds: 4, offPerHalfPound: 50 },
  { upToPounds: Infinity, offPerHalfPound: 85 },
];

export function cakeVolumeDiscount(grams: number): number {
  const pounds = grams / CAKE_BASE_GRAMS;
  let from = 1;
  let off = 0;
  for (const slab of CAKE_VOLUME_SLABS) {
    if (!(pounds > from)) break;
    const inSlab = Math.min(pounds, slab.upToPounds) - from;
    off += (inSlab / 0.5) * slab.offPerHalfPound;
    from = slab.upToPounds;
  }
  return off;
}

export function cakeSmallSizeExtra(grams: number): number {
  return grams < CAKE_BASE_GRAMS ? CAKE_SMALL_SIZE_EXTRA : 0;
}

/** Cake unit price before add-ons, slot surcharge and discount factor. */
export function computeCakeUnitPrice(
  basePrice: number,
  grams: number,
  flavourAdditional = 0,
  flavourPricedIn = false,
): number {
  const perPound = basePrice + (flavourPricedIn ? 0 : flavourAdditional);
  const linear = perPound * (grams / CAKE_BASE_GRAMS);
  const price =
    grams < CAKE_BASE_GRAMS
      ? Math.min(linear + cakeSmallSizeExtra(grams), perPound)
      : linear - cakeVolumeDiscount(grams);
  return Math.max(CAKE_MIN_PRICE, Math.round(price));
}

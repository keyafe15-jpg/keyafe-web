import { CAKE_BASE_GRAMS } from "@keyafe/shared";

export {
  CAKE_BASE_GRAMS,
  CAKE_MIN_PRICE,
  CAKE_SMALL_SIZE_EXTRA,
  CAKE_VOLUME_SLABS,
  cakeSmallSizeExtra,
  cakeVolumeDiscount,
  computeCakeUnitPrice,
} from "@keyafe/shared";

export function gramsToPounds(grams: number): number {
  return grams / CAKE_BASE_GRAMS;
}

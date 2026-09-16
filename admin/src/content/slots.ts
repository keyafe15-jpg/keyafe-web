// Kept in sync with client/src/content/product.ts → PRODUCT_COPY.timeSlots.
export const TIME_SLOTS = [
  { key: "morning", label: "Morning · 9 AM – 12 PM" },
  { key: "afternoon", label: "Afternoon · 12 – 4 PM" },
  { key: "evening", label: "Evening · 4 – 8 PM" },
  { key: "late-evening", label: "Late Evening · 8 – 11 PM" },
  { key: "midnight", label: "Midnight · 11 PM – 11:59 PM" },
] as const;

export type TimeSlotKey = (typeof TIME_SLOTS)[number]["key"];

/**
 * Chronological position of a slot, for ordering within a single day.
 * Needed because slot keys sort alphabetically in SQL ("afternoon" before
 * "morning"), which is not the order cakes go out in. Same-day and any
 * unrecognised key sort last, since they have no fixed window.
 */
export function slotRank(key: string | null | undefined): number {
  if (!key) return TIME_SLOTS.length + 1;
  const index = TIME_SLOTS.findIndex((s) => s.key === key);
  return index === -1 ? TIME_SLOTS.length : index;
}

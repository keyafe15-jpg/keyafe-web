// Kept in sync with client/src/content/product.ts → PRODUCT_COPY.timeSlots.
export const TIME_SLOTS = [
  { key: "morning", label: "Morning · 9 AM – 12 PM" },
  { key: "afternoon", label: "Afternoon · 12 – 4 PM" },
  { key: "evening", label: "Evening · 4 – 8 PM" },
  { key: "late-evening", label: "Late Evening · 8 – 11 PM" },
  { key: "midnight", label: "Midnight · 11 PM – 11:59 PM" },
] as const;

export type TimeSlotKey = (typeof TIME_SLOTS)[number]["key"];

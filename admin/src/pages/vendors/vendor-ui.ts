export const VENDOR_SUPPLY_TAGS = [
  "dairy",
  "flour",
  "eggs",
  "chocolate",
  "fruits",
  "dry-goods",
  "packaging",
  "boxes",
  "toppers",
  "ice-cream",
  "delivery",
  "gas",
  "fuel",
] as const;

export function supplyLabel(tag: string): string {
  if (tag === "dry-goods") return "Dry goods";
  if (tag === "ice-cream") return "Ice cream";
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

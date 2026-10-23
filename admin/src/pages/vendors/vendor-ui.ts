export const VENDOR_CHANNELS = ["OFFLINE", "ONLINE"] as const;
export type VendorChannel = (typeof VENDOR_CHANNELS)[number];

export function channelLabel(channel: string) {
  return channel === "ONLINE" ? "Online" : "Offline";
}

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

export const BRAND = {
  name: "Keyafe",
  legalName: "Keyafe Bakery",
  tagline: "Handcrafted cakes, cookies & bakes — baked fresh, delivered warm.",
  supportEmail: "keyafe15@gmail.com",
  supportPhone: "+91 93300 48665",
  altPhone: "+91 98831 86892",
  logoSrc: "/logo.png",
  logoAlt: "Keyafe logo",
  socials: {
    instagram: "https://instagram.com/keyafe",
    facebook: "https://facebook.com/keyafe",
    whatsapp: "https://wa.me/919330048665",
    // Update these when the listing URLs change.
    zomato: "https://www.zomato.com/",
    swiggy: "https://www.swiggy.com/",
  },
  /**
   * Delivery-app ratings — maintained by hand (no public API).
   * Update when Zomato / Swiggy numbers move.
   */
  platformRatings: {
    zomato: { rating: 4.2, count: 1198 },
    swiggy: { rating: 4.4, count: 224 },
  },
  /**
   * Name, address and phone as published to search engines. Keep this in step
   * with the Google Business Profile — inconsistent details across the web are
   * what weaken a local listing.
   *
   * TODO(keyafe): fill in `street` and confirm `openingHours` before relying on
   * the local listing. Anything left empty is omitted from the JSON-LD rather
   * than guessed, since wrong details rank worse than absent ones.
   */
  location: {
    street: "",
    locality: "Belur",
    city: "Howrah",
    region: "West Bengal",
    postalCode: "711202",
    country: "IN",
    areaServed: ["Kolkata", "Howrah", "Hooghly"],
    openingHours: "" as string,
  },
  /** Public site origin, used for canonical URLs and absolute OG images. */
  siteUrl: "https://keyafe.com",
} as const;

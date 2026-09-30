/**
 * Built-in defaults. Everything except `siteUrl`, `logoSrc` and `location.country`
 * is edited in Admin → Settings and read through useStoreProfile(); these values
 * only show until that request loads (or if it fails).
 */
export const BRAND = {
  name: "Keyafe",
  legalName: "Keyafe Foods",
  tagline: "Handcrafted cakes, cookies & bakes — baked fresh, delivered warm.",
  supportEmail: "support@keyafe.com",
  supportPhone: "+91 93300 48665",
  altPhone: "+91 98831 86892",
  /** Bundled logo, used when no logo has been uploaded in Settings. */
  logoSrc: "/logo.png",
  socials: {
    instagram: "https://instagram.com/keyafe",
    facebook: "https://facebook.com/keyafe",
    zomato: "https://www.zomato.com/",
    swiggy: "https://www.swiggy.com/",
  },
  platformRatings: {
    zomato: { rating: 4.2, count: 1198 },
    swiggy: { rating: 4.4, count: 224 },
  },
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

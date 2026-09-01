import { BRAND } from "./brand";

export const FOOTER_COPY = {
  brandBlurb: BRAND.tagline,
  headline: ["Something special and unique,", "made just for you."] as const,
  cta: { to: "/get-quote", label: "Get a quote" },
  sections: {
    shop: {
      heading: "Shop",
    },
    order: {
      heading: "Order",
    },
    studio: {
      heading: "The studio",
      email: BRAND.supportEmail,
    },
  },
  copyright: (year: number) => `© ${year} ${BRAND.name}`,
  scrollTop: "Back to top",
} as const;

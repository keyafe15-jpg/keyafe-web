import { BRAND } from "./brand";

export const FOOTER_COPY = {
  brandBlurb: BRAND.tagline,
  sections: {
    shop: {
      heading: "Shop",
      // Category list is rendered from /api/categories via useCategories() in Footer.tsx.
    },
    contact: {
      heading: "Contact",
      email: BRAND.supportEmail,
    },
  },
  copyright: (year: number) => `© ${year} ${BRAND.name}. All rights reserved.`,
} as const;

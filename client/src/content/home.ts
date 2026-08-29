// HOME_CATEGORIES removed — HomePage now fetches from /api/categories.

export const HOME_COPY = {
  hero: {
    eyebrow: "Handcrafted daily",
    heading: ["Baked with love,", "delivered fresh."] as const,
    sub: "Celebration cakes, dry cakes, tubs, pizzas & house-special savoury — same-day delivery available on select items.",
    primaryCta: { to: "/category/celebration-cakes", label: "Order a cake" },
    secondaryCta: {
      to: "/category/house-special-snacks",
      label: "Browse savoury",
    },
  },
  sectionHeadings: {
    shopByCategory: "Shop by category",
  },
  quoteBanner: {
    eyebrow: "Something custom?",
    title: "Can't find what you're looking for?",
    body: "Share a reference or describe your dream bake — we'll get back within a few hours with a quote.",
    cta: { to: "/get-quote", label: "Get a quote" },
  },
} as const;

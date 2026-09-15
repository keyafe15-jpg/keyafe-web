export type HomeCollection = {
  title: string;
  line: string;
  to: string;
  categorySlug?: string;
  mobileCategorySlug?: string;
};

export const HOME_COLLECTIONS: HomeCollection[] = [
  {
    title: "Celebration cakes",
    line: "Birthdays, weddings and custom art — start here.",
    to: "/category/celebration-cakes",
    categorySlug: "celebration-cakes",
    mobileCategorySlug: "birthday-cakes",
  },
  {
    title: "Everyday sweets",
    line: "Dry cakes and tea-time bakes for the week.",
    to: "/category/dry-cakes",
    categorySlug: "dry-cakes",
    mobileCategorySlug: "tubs",
  },
  {
    title: "Pizzas",
    line: "Hand-tossed, wood-fired, ready when you are.",
    to: "/category/pizzas",
    categorySlug: "pizzas",
    mobileCategorySlug: "panuozzo",
  },
  {
    title: "Same day",
    line: "Need it today? Shop what’s baking now.",
    to: "/same-day",
    mobileCategorySlug: "kids-cakes",
  },
  {
    title: "Healthy treats",
    line: "Lighter recipes without losing the joy.",
    to: "/healthy",
    mobileCategorySlug: "tubs",
  },
];

export const HOME_COPY = {
  hero: {
    eyebrow: "Handcrafted daily",
    heading: ["Baked with love,", "delivered fresh."] as const,
    sub: "Cakes, tubs, pizzas and house snacks — pick a store and order.",
    primaryCta: { to: "/store/dessert", label: "Dessert store" },
    secondaryCta: { to: "/store/savory", label: "Savoury store" },
    coverage: {
      beforeLink: "Delivering all over Kolkata. A few treats also ",
      linkLabel: "ship pan-India",
      afterLink: ".",
      to: "/pan-india",
    },
  },
  collections: {
    badge: "Shop this",
  },
  film: {
    src: "/hero/keyafeoverall.mp4",
    eyebrow: "Six years with you",
    title: "15000+ orders delivered",
    body: "15000+ bakes from our Belur kitchen — for 2,000+ customers, most of whom come back and send the kindest words.",
    points: [
      "2,000+ customers since we started",
      "Most of you return — that’s the bit we’re proudest of",
      "Baked fresh for Kolkata, one order at a time",
    ],
  },
  storeDoors: {
    eyebrow: "Browse",
    heading: "Two stores, one kitchen",
    enter: "Enter store",
    fallbackLine: "See everything in this shop.",
    bySlug: {
      dessert: "Cakes, tubs, cookies and everyday sweets.",
      savory: "Pizzas, panuozzo, focaccia and house snacks.",
    },
  },
  quoteBanner: {
    eyebrow: "Something custom?",
    title: "Can't find what you're looking for?",
    body: "Share a reference or describe your dream bake — we'll get back within a few hours with a quote.",
    cta: { to: "/get-quote", label: "Get a quote" },
  },
} as const;

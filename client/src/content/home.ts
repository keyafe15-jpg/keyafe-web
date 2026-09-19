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

/**
 * Everything we make, including the made-to-order items that never appear as
 * catalogue products. Declared in the homepage structured data so search
 * engines know we offer them even though there is no page per item.
 */
export const KEYAFE_OFFERINGS = [
  "Custom celebration cakes",
  "Birthday and anniversary cakes",
  "Wedding cakes",
  "Cookies",
  "Brownies",
  "Cake and cookie tubs",
  "Gift hampers",
  "Pizzas",
  "Panuozzo and focaccia sandwiches",
  "Party trays and house snacks",
  "Corporate gifting and bulk orders",
] as const;

export const HOME_SEO = {
  title: "Custom Cakes, Cookies, Brownies & Hampers in Kolkata",
  description:
    "Keyafe bakes custom celebration cakes, cookies, brownies, hampers, pizzas and party trays in Kolkata. Small party and corporate orders welcome, with GST invoices for businesses.",
};

export const HOME_COPY = {
  hero: {
    eyebrow: "Handcrafted daily",
    heading: ["Baked fresh,", "Made just for you!"] as const,
    // The plain-language line: what we make and where. Kept deliberately
    // literal so both first-time visitors and search engines can tell at a
    // glance what this bakery actually sells.
    offering: "Custom cakes, cookies, brownies, hampers & pizzas in Kolkata",
    sub: "Celebration and custom cakes, cookies, cake tubs, brownies, hampers, pizzas and house snacks — for homes, small parties and corporate orders across Kolkata.",
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
  delivery: {
    src: "/hero/deliveryvideo.mp4",
    eyebrow: "Our own riders",
    title: "From Belur to your door",
    body: "We don’t hand your cake to a stranger’s bag. Keyafe rides deliver across Kolkata so everything arrives the way it left the kitchen — fresh, upright and on time.",
    points: [
      "Same-day slots across Kolkata",
      "Handled by our team, not a marketplace bag",
      "Packed to travel — boxes stay upright",
    ],
    cta: { to: "/same-day", label: "Shop same-day" },
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
  // Shoppable shortcuts under the hero. Every one of these points at a real
  // category, so the labels double as the page's internal link text.
  shopChips: [
    { to: "/category/celebration-cakes", label: "Celebration cakes" },
    { to: "/category/custom-cakes", label: "Custom design cakes" },
    { to: "/category/cookies", label: "Cookies" },
    { to: "/category/tubs", label: "Cake & cookie tubs" },
    { to: "/category/pizzas", label: "Pizzas" },
    { to: "/category/house-special-snacks", label: "House snacks" },
  ],
  search: {
    placeholder: "Search cakes, cookies, pizzas…",
    submitLabel: "Search",
  },
  googleReviews: {
    eyebrow: "Loved on the apps",
    heading: "Ratings that travel with every order",
    sub: "Guests rate us on Zomato, Swiggy and Google — here’s the latest snapshot.",
    writeCta: "Leave a Google review",
    seeAllCta: "See all on Google",
  },
  enquiries: {
    eyebrow: "Need something special?",
    heading: "Two ways to request a quote",
    corporate: {
      eyebrow: "Corporate",
      title: "Office celebrations & client gifting",
      body: "Bulk boxes, festival hampers and party trays for teams across Kolkata — with a GST invoice in your company name.",
      points: [
        "GST invoice in your company name",
        "Signed delivery challan with the goods",
        "Sized around your headcount and date",
      ],
      cta: { to: "/get-quote?type=corporate", label: "Corporate enquiry" },
    },
    custom: {
      eyebrow: "Custom order",
      title: "Can't find it on the site?",
      body: "Theme cakes, one-off designs and made-to-order bakes that aren’t in our catalogue — send a reference and we’ll quote what’s possible.",
      points: [
        "Celebration and theme cakes",
        "Reference photos welcome",
        "Planned around your date",
      ],
      cta: { to: "/get-quote?type=custom", label: "Custom order enquiry" },
    },
  },
  // Kept for any older references; prefer `enquiries` above.
  corporate: {
    eyebrow: "Corporate & party orders",
    title: "Office celebrations, client gifting and house parties",
    body: "Festival hampers, bulk boxes and party trays for teams and gatherings across Kolkata — plus brownies, hampers and custom trays we bake to order.",
    points: [
      {
        title: "GST invoice in your company name",
        body: "Share your company name and GSTIN and your invoice carries both, so you can claim input tax credit.",
      },
      {
        title: "Delivery challan with the goods",
        body: "Every corporate delivery travels with a signed challan on its own number series, cross-referenced to the invoice.",
      },
      {
        title: "Built around your date",
        body: "Tell us the occasion, headcount and delivery date, and we'll come back with a quote.",
      },
    ],
    cta: { to: "/get-quote?type=corporate", label: "Corporate enquiry" },
    secondaryCta: { to: "/get-quote?type=custom", label: "Custom order enquiry" },
  },
  tagSections: {
    seeAll: "See all",
    // Headline per tag slug. Tags an admin flags later fall back to their own
    // name, so a new section never renders without a heading.
    headingBySlug: {
      "best-seller": "The ones everyone keeps coming back for",
      "new-launch": "Fresh off the bench",
      "same-day": "Order today, enjoy today",
      eggless: "Every bit as good, entirely eggless",
    } as Record<string, string>,
  },
} as const;

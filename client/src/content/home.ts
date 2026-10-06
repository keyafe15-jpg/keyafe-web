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
    "Keyafe bakes custom celebration cakes, cookies, brownies, hampers, pizzas and party trays, delivered across Kolkata, Howrah and Hooghly. Small party and corporate orders welcome, with GST invoices for businesses.",
};

export const HOME_COPY = {
  hero: {
    // The home page h1: what we make and where. Kept deliberately literal so
    // both first-time visitors and search engines can tell at a glance what
    // this bakery actually sells.
    offering: "Custom cakes, cookies, brownies, hampers, pizzas & creative savouries",
    offeringPlace: "baked to order in Kolkata, Howrah & Hooghly",
    primaryCta: { to: "/store/dessert", label: "Dessert store" },
    secondaryCta: { to: "/store/savory", label: "Savoury store" },
  },
  // Hero fallback when no slides are live in admin → Hero slider.
  banner: {
    eyebrow: "Kolkata · Howrah · Hooghly",
    title: "Freshly baked, every single day",
    line: "Cakes, cookies, brownies, hampers and pizzas — baked to order, never off a shelf.",
  },
  delivery: {
    src: "/hero/deliveryvideo.mp4",
    body: "We deliver across Kolkata, Howrah and Hooghly. Every box is packed to travel and sent with a trusted delivery partner, or brought over by us — fresh, upright and on time.",
    points: [
      "Same-day slots across Kolkata, Howrah and Hooghly",
      "Trusted delivery partners, or we bring it ourselves",
      "Packed to travel — boxes stay upright",
    ],
    cta: { to: "/same-day", label: "Shop same-day" },
  },
  storeDoors: {
    eyebrow: "Browse",
    heading: "Our stores, one kitchen",
    enter: "Enter store",
    fallbackLine: "See everything in this shop.",
    bySlug: {
      dessert: "Cakes, tubs, cookies and everyday sweets.",
      savory: "Pizzas, panuozzo, focaccia and house snacks.",
      "gift-hamper": "Curated boxes of our bakes, ready to gift.",
      festive: "Seasonal bakes for every celebration.",
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
  categoryRow: {
    heading: "Shop by category",
  },
  highlights: {
    chip: "Trending",
    tabsLabel: "Trending highlights",
  },
  rails: {
    swipeHint: "Swipe",
    seeAllTile: "See all",
    featured: {
      chip: "Keyafe picks",
      heading: "Handpicked from our kitchen",
    },
    category: {
      chip: "Category",
    },
    recent: {
      chip: "Recently viewed",
      heading: "Pick up where you left off",
      clear: "Clear",
    },
  },
  quickTiles: {
    heading: "Shop your way",
    tiles: [
      {
        key: "same-day",
        to: "/same-day",
        title: "Same-day delivery",
        line: "Order today, enjoy today",
      },
      {
        key: "healthy",
        to: "/healthy",
        title: "Healthy treats",
        line: "Lighter bakes, same joy",
      },
      {
        key: "pan-india",
        to: "/pan-india",
        title: "Ships pan-India",
        line: "Send a treat anywhere",
      },
    ],
  },
  why: {
    custom: {
      eyebrow: "Why custom cakes & hampers?",
      title: "It’s an emotion, not just a cake",
      body: "It shows who they are, what they love and how well you know them.",
      cta: { to: "/get-quote", label: "Plan a custom order" },
    },
    fresh: {
      eyebrow: "And everything else",
      title: "Baked only when you order",
      body: "Nothing waits on a shelf. Every order starts its own batch.",
      points: [
        { key: "batch", label: "Fresh batch" },
        { key: "pure", label: "No preservatives" },
        { key: "quality", label: "Quality ingredients" },
      ],
    },
  },
  trust: [
    { key: "batch", label: "Baked to order" },
    { key: "pure", label: "Preservative-free" },
    { key: "packed", label: "Packed with care" },
  ],
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

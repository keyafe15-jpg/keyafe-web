export const HEALTHY_COPY = {
  eyebrow: "Healthy Desserts",
  title: "Treats that go easy on you.",
  sub: "Whole-grain, jaggery-sweetened, and sugar-free bakes — same craft, lighter on refined sugar.",
  placeholderNote:
    "Products with our healthy flavours will show here once the catalogue is wired.",
} as const;

// Placeholder tiles until the catalog API lands. Slugs correspond to Flavor.slug.
export const HEALTHY_PLACEHOLDER = [
  {
    slug: "atta-jaggery-chocolate",
    name: "Atta Jaggery Chocolate",
    blurb: "Whole wheat with jaggery — no refined sugar.",
  },
  {
    slug: "vanilla-sugar-free",
    name: "Vanilla (Sugar-Free)",
    blurb: "Classic vanilla, sweetened without sugar.",
  },
  {
    slug: "strawberry-sugar-free",
    name: "Strawberry (Sugar-Free)",
    blurb: "Real strawberry, no added sugar.",
  },
  {
    slug: "chocolate-sugar-free",
    name: "Chocolate (Sugar-Free)",
    blurb: "Rich cocoa without the sugar spike.",
  },
  {
    slug: "butterscotch-sugar-free",
    name: "Butterscotch (Sugar-Free)",
    blurb: "Caramel notes, guilt-free.",
  },
  {
    slug: "blueberry-sugar-free",
    name: "Blueberry (Sugar-Free)",
    blurb: "Berry-forward, sugar-free.",
  },
] as const;

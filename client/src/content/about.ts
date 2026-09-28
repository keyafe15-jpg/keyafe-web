// Photos below are stock placeholders — swap each `src` for Keyafe's own
// pictures (drop files in client/public/about/ and use "/about/<file>").
// Videos: use `type: "video"` with a short muted-friendly .mp4 (< 5 MB) and a `poster` image.

export type AboutMedia = {
  type: "image" | "video";
  src: string;
  poster?: string;
  alt: string;
  caption?: string;
};

export type MomentShape = "tall" | "wide" | "square";

export type AboutMoment = AboutMedia & { shape: MomentShape };

export type BirthdayCelebration = {
  year: number;
  place: string;
  note: string;
  photos: AboutMedia[];
};

export const KEYAFE_FOUNDED_YEAR = 2019;

export const ABOUT_BANNER = {
  image:
    "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=2000&q=80",
  alt: "Team Keyafe together",
  caption: "Team Keyafe",
  /** CSS object-position — keep faces in frame when the banner crops. */
  focus: "center 40%",
};

export const ABOUT_BIRTHDAY_COPY = {
  eyebrow: "Every 16 December",
  title: "Keyafe’s birthday is our team’s day out.",
  body: "Every year on Keyafe’s birthday, we close the kitchen and take our whole team — and their families — out for a proper meal at a good hotel. The people who bake with us are family, and this is our thank-you.",
};

export const ABOUT_BIRTHDAYS: BirthdayCelebration[] = [
  {
    year: 2025,
    place: "Team dinner, Kolkata",
    note: "Our biggest table yet — staff, parents, partners and a lot of little ones.",
    photos: [
      {
        type: "image",
        src: "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=800&q=80",
        alt: "Team and families sharing a meal",
        caption: "The whole family at one table",
      },
      {
        type: "image",
        src: "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=800&q=80",
        alt: "Birthday cake",
        caption: "Cutting the birthday cake",
      },
      {
        type: "image",
        src: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=800&q=80",
        alt: "Dinner table set for the celebration",
        caption: "Table for everyone",
      },
      {
        type: "image",
        src: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=800&q=80",
        alt: "Balloons at the celebration",
        caption: "Six years of Keyafe",
      },
    ],
  },
  {
    year: 2024,
    place: "Team dinner, Kolkata",
    note: "Five candles, one long table and a night off for the ovens.",
    photos: [
      {
        type: "image",
        src: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80",
        alt: "Plated dinner at the hotel",
        caption: "Someone else cooked for once",
      },
      {
        type: "image",
        src: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=800&q=80",
        alt: "Decorated dinner table",
        caption: "All set for the team",
      },
      {
        type: "image",
        src: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80",
        alt: "Dessert at the celebration",
        caption: "Dessert, judged by bakers",
      },
    ],
  },
  {
    year: 2023,
    place: "Team dinner, Kolkata",
    note: "Four years in — the year our team’s families first joined us.",
    photos: [
      {
        type: "image",
        src: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
        alt: "Hotel restaurant",
        caption: "Our night out",
      },
      {
        type: "image",
        src: "https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&w=800&q=80",
        alt: "Warm restaurant lights",
        caption: "Lights, laughter, dinner",
      },
      {
        type: "image",
        src: "https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=800&q=80",
        alt: "Doughnuts and sweets",
        caption: "Sweet ending",
      },
    ],
  },
];

export const ABOUT_MOMENTS_COPY = {
  eyebrow: "Little moments",
  title: "Life around the Keyafe kitchen.",
};

export const ABOUT_MOMENTS: AboutMoment[] = [
  {
    type: "image",
    shape: "tall",
    src: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
    alt: "Fresh bread out of the oven",
    caption: "First batch of the day",
  },
  {
    type: "image",
    shape: "wide",
    src: "https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=800&q=80",
    alt: "Trays of food ready to go",
    caption: "Big order, packed with care",
  },
  {
    type: "image",
    shape: "square",
    src: "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=600&q=80",
    alt: "Cupcakes",
    caption: "Frosting o’clock",
  },
  {
    type: "image",
    shape: "wide",
    src: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=800&q=80",
    alt: "Cake slice",
    caption: "Taste-testing (for quality)",
  },
  {
    type: "image",
    shape: "tall",
    src: "https://images.unsplash.com/photo-1571115177098-24ec42ed204d?auto=format&fit=crop&w=600&q=80",
    alt: "Decorated cake",
    caption: "Finishing touches",
  },
  {
    type: "image",
    shape: "square",
    src: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80",
    alt: "Savoury dish",
    caption: "Savoury side of Keyafe",
  },
  {
    type: "image",
    shape: "wide",
    src: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=800&q=80",
    alt: "Plated meal",
    caption: "Staff lunch",
  },
  {
    type: "image",
    shape: "tall",
    src: "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=600&q=80",
    alt: "Breakfast spread",
    caption: "Morning fuel",
  },
];

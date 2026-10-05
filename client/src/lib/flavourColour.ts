export interface FlavourColour {
  fill: string;
  /** Pale fills need an outline to show on white chips. */
  outlined?: boolean;
}

// First match wins, so specific names ("red velvet", "black forest") come before generic ones.
const RULES: [RegExp, FlavourColour][] = [
  [/red\s*velvet/i, { fill: "#a61e2c" }],
  [/white\s*forest/i, { fill: "#f4ead2", outlined: true }],
  [
    /black\s*forest|chocolate|choco|truffle|oreo|nutella|ferrero|cocoa|brownie|praline|granola/i,
    { fill: "#5a3420" },
  ],
  [/coffee|mocha|caramel|jaggery|gur\b/i, { fill: "#8a5a36" }],
  [/biscoff|lotus|cookie|biscuit/i, { fill: "#c0844e" }],
  [/strawberry|rose|raspberry|cherry/i, { fill: "#e8577c" }],
  [/blueberry|black\s*currant|blackcurrant/i, { fill: "#5a5fc8" }],
  [/butterscotch/i, { fill: "#d9963a" }],
  [/mango|pineapple|lemon|orange|thandai|kesar|saffron/i, { fill: "#f2b632" }],
  [/pistachio|matcha|mint|kiwi/i, { fill: "#7fb45a" }],
  [/litchi|lychee/i, { fill: "#f2c9c0" }],
  [/vanilla|custard|cream|rasmalai|milk/i, { fill: "#f4ead2", outlined: true }],
];

const NEUTRAL: FlavourColour = { fill: "#d8c7a4" };

/** Swatch guessed from the flavour name; falls back to a neutral beige. */
export function flavourColour(name: string): FlavourColour {
  return RULES.find(([re]) => re.test(name))?.[1] ?? NEUTRAL;
}

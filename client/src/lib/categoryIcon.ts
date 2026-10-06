import {
  Cake,
  CakeSlice,
  ChefHat,
  Cookie,
  Croissant,
  Gift,
  Pizza,
  Popcorn,
  Sandwich,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

// First match wins, so more specific words sit above broader ones.
const RULES: [RegExp, LucideIcon][] = [
  [/hamper|gift|box/i, Gift],
  [/festive|festival|diwali|christmas|season/i, Sparkles],
  [/pizza/i, Pizza],
  [/panuozzo|focaccia|sandwich|burger|wrap/i, Sandwich],
  [/snack|savou?ry|bite/i, Popcorn],
  [/cookie|tub|brownie|biscuit/i, Cookie],
  [/croissant|bread|puff|pastry|bun/i, Croissant],
  [/dry cake|loaf|muffin|cupcake/i, CakeSlice],
  [/cake/i, Cake],
];

/** Stand-in icon for a category that has no uploaded image, guessed from its name. */
export function categoryIcon(name: string): LucideIcon {
  return RULES.find(([pattern]) => pattern.test(name))?.[1] ?? ChefHat;
}

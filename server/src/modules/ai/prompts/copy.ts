export const SUGGEST_KINDS = [
  "productCopy",
  "itemCopy",
  "categoryCopy",
  "addonCopy",
  "flavourCopy",
  "couponCopy",
] as const;

export type SuggestKind = (typeof SUGGEST_KINDS)[number];

export const PHOTO_KINDS = new Set<SuggestKind>([
  "productCopy",
  "itemCopy",
  "categoryCopy",
  "addonCopy",
]);

export type SuggestContext = {
  kind: SuggestKind;
  name?: string;
  shortDescription?: string;
  description?: string;
  flavour?: string;
  size?: string;
  group?: string;
  extra?: string;
};

const KIND_GUIDE: Record<SuggestKind, string> = {
  productCopy: [
    "Return a JSON object with:",
    '- "names": 3 to 5 Title Case catalog product names. Distinct. No prices.',
    '- "shortDescription": one line, max ~90 characters, for a product card.',
    '- "description": 2–4 sentences for the product page. Markdown ok.',
    '- "metaTitle": 3 to 5 SEO titles under 60 characters. Include Keyafe when it fits.',
    '- "metaDescription": one SEO meta description under 155 characters.',
    "If a working title is given, treat it as staff context (occasion, flavour, design). Use it in the descriptions. Still suggest improved names that may keep or refine that title — do not ignore it.",
  ].join("\n"),
  itemCopy: [
    "Return a JSON object with:",
    '- "names": 3 to 5 Title Case names for this bakery order line. Short and appetizing. No prices.',
    '- "description": 1–2 sentences for a custom item / hamper writeup. Omit if nothing useful to add.',
  ].join("\n"),
  categoryCopy: [
    "Return a JSON object with:",
    '- "names": 3 to 5 Title Case shop category names. Clear and browseable.',
    '- "description": 1–2 sentences for the category landing page.',
  ].join("\n"),
  addonCopy: [
    "Return a JSON object with:",
    '- "names": 3 to 5 Title Case add-on names (candles, toppers, extras). No prices.',
  ].join("\n"),
  flavourCopy: [
    "Return a JSON object with:",
    '- "names": 3 to 5 Title Case cake flavour names that fit the group. Appetizing, not cutesy.',
    "Do not repeat any flavour already listed. If the group is empty, suggest a starter set.",
  ].join("\n"),
  couponCopy: [
    "Return a JSON object with:",
    '- "names": 3 to 5 homepage headlines under 80 characters. Energetic, not shouty. No hashtags.',
    '- "description": one homepage writeup under 220 characters. Mention how to use the code.',
    "Do not copy another coupon's headline. Mention this offer's code and discount.",
  ].join("\n"),
};

export function buildCopyPrompt(ctx: SuggestContext, hasPhoto: boolean): string {
  const lines = [
    "You write copy for Keyafe, a bakery and cafe in Kolkata, India.",
    "Warm, simple English. No prices, no hashtags, no emoji.",
    "Names in Title Case. Do not invent allergens or claims we did not give you.",
  ];
  if (hasPhoto) {
    lines.push(
      "Use the photo as the primary source for what the item looks like. Do not invent colours, toppers, or flavours that are not visible or given below.",
    );
  }
  lines.push(KIND_GUIDE[ctx.kind]);
  lines.push("Reply with that JSON object only. No markdown fence, no commentary.");
  if (ctx.name?.trim()) {
    lines.push(
      `Working title (staff typed this — use it as context, you may still suggest a better name): ${ctx.name.trim()}`,
    );
  }
  if (ctx.shortDescription?.trim()) lines.push(`Existing short description: ${ctx.shortDescription.trim()}`);
  if (ctx.description?.trim()) lines.push(`Existing description: ${ctx.description.trim()}`);
  if (ctx.flavour?.trim()) lines.push(`Flavour: ${ctx.flavour.trim()}`);
  if (ctx.size?.trim()) lines.push(`Size: ${ctx.size.trim()}`);
  if (ctx.group?.trim()) lines.push(`Group: ${ctx.group.trim()}`);
  if (ctx.extra?.trim()) lines.push(`Notes: ${ctx.extra.trim()}`);
  return lines.join("\n");
}

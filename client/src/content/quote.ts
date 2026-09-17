export const QUOTE_SEO = {
  title: "Corporate & Party Orders in Kolkata — Bulk Cakes, Hampers & Gifting",
  description:
    "Corporate gifting, office parties and house celebrations in Kolkata. Bulk cakes, brownies, cookies, hampers and party trays, with a GST invoice in your company name and a signed delivery challan.",
};

export const QUOTE_COPY = {
  eyebrow: "Corporate, party & custom orders",
  title: "Corporate and party orders in Kolkata",
  intro:
    "Office celebrations, client gifting, house parties and custom bakes — tell us the occasion and we'll come back with a quote.",
  // What we take on. Some of these are made to order and never appear in the
  // online catalogue, which is exactly why this page exists.
  offerings: [
    "Custom and celebration cakes",
    "Cookies and cake tubs",
    "Brownies and dessert boxes",
    "Festival and gifting hampers",
    "Pizzas, panuozzo and focaccia",
    "Party trays and house snacks",
  ],
  // Only documents we genuinely issue. Nothing here about corporate rates,
  // credit terms or purchase orders — none of that exists.
  trust: [
    {
      title: "GST invoice in your company name",
      body: "Add your company name and GSTIN and the invoice carries both, so your finance team can claim input tax credit.",
    },
    {
      title: "Signed delivery challan",
      body: "Corporate deliveries travel with a challan on its own number series that cross-references the invoice.",
    },
    {
      title: "Delivered across Kolkata",
      body: "We run our own deliveries across the city, and ship selected shelf-stable treats pan-India.",
    },
  ],
  formHeading: "Tell us about your order",
  submitCta: "Send request",
  submittingCta: "Sending…",
  successTitle: "Thanks — we'll be in touch!",
  successBody:
    "Our team will review your request and reach out with a quote. If it's urgent, feel free to call us directly at 9330048665 / 9883186892.",
  backToHome: "Back to home",
  submitAnother: "Submit another",
  fields: {
    name: { label: "Your name" },
    phone: { label: "Phone", placeholder: "10-digit mobile" },
    email: { label: "Email", hint: "Optional — for quote confirmation." },
    address: {
      label: "Delivery address",
      hint: "Full address including city & pincode.",
    },
    deliveryDate: { label: "Delivery date" },
    description: {
      label: "What are you looking for?",
      hint: "Items, flavours, quantities, theme or design — tell us as much as you can.",
      placeholder:
        "e.g., 40 brownie boxes for a Diwali client gifting, or a 2-tier unicorn birthday cake, roughly 2kg…",
    },
    image: {
      label: "Reference image",
      hint: "Optional — upload an inspiration photo (design, colour, packaging).",
    },
    notes: {
      label: "Anything else?",
      hint: "Allergies, dietary notes, delivery instructions.",
    },
    isBusiness: {
      label: "This is a corporate or business order",
      hint: "We'll raise a GST invoice in your company name.",
    },
    companyName: { label: "Company name", placeholder: "Registered business name" },
    gstin: { label: "GSTIN", placeholder: "15-character GSTIN", hint: "Optional." },
    headcount: {
      label: "Roughly how many people?",
      placeholder: "e.g., 40",
      hint: "Optional — helps us size the order.",
    },
    eventType: { label: "Occasion", hint: "Optional." },
  },
} as const;

/** Must stay in sync with QUOTE_EVENT_TYPES on the server. */
export const QUOTE_EVENT_TYPES = [
  { value: "corporate-gifting", label: "Corporate gifting" },
  { value: "office-party", label: "Office party or celebration" },
  { value: "house-party", label: "House party or small gathering" },
  { value: "birthday", label: "Birthday" },
  { value: "wedding", label: "Wedding" },
  { value: "festival", label: "Festival order" },
  { value: "other", label: "Something else" },
] as const;

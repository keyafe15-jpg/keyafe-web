export const QUOTE_SEO = {
  title: "Get a Quote — Custom Cakes & Corporate Orders in Kolkata",
  description:
    "Request a quote for a custom cake or a corporate / party order in Kolkata. GST invoices for businesses, signed delivery challans, and made-to-order bakes.",
  corporate: {
    title: "Corporate Order Quote — GST Invoice & Delivery Challan",
    description:
      "Enquire about corporate gifting, office parties and bulk orders in Kolkata. GST invoice in your company name and a signed delivery challan with every delivery.",
  },
  custom: {
    title: "Custom Order Quote — Cakes, Designs & Celebrations",
    description:
      "Tell us about a custom cake, theme design or celebration order in Kolkata. Share references and we'll come back with a quote.",
  },
};

export type QuoteKind = "corporate" | "custom";

export const QUOTE_COPY = {
  // Landing chooser when /get-quote has no ?type=
  chooser: {
    eyebrow: "Get a quote",
    title: "What kind of order is this?",
    intro: "Pick the path that matches your enquiry — the form asks only what’s relevant.",
    corporate: {
      title: "Corporate / business",
      body: "Office celebrations, client gifting, bulk boxes and festival hampers — with a GST invoice in your company name.",
      cta: "Corporate enquiry",
    },
    custom: {
      title: "Custom order",
      body: "Celebration cakes, theme designs, house parties and made-to-order bakes that aren’t in the online catalogue.",
      cta: "Custom enquiry",
    },
  },

  corporate: {
    eyebrow: "Corporate",
    title: "Corporate enquiry",
    intro: "Occasion, headcount and date — we’ll quote back. GST invoice available.",
    formHeading: "Your details",
    offerings: [
      "Client & festival gifting",
      "Office parties",
      "Bulk dessert boxes",
      "Hampers & trays",
      "GST invoice",
      "Delivery challan",
    ],
    trust: [
      {
        title: "GST invoice in your company name",
        body: "Company name and GSTIN go on the invoice for input tax credit.",
      },
      {
        title: "Signed delivery challan",
        body: "Each delivery carries a challan cross-referenced to the invoice.",
      },
      {
        title: "Delivered across Kolkata",
        body: "We deliver to offices and venues across the city.",
      },
    ],
  },

  custom: {
    eyebrow: "Custom order",
    title: "Custom enquiry",
    intro: "Design, size and date — add a reference photo if you have one.",
    formHeading: "Your details",
    offerings: [
      "Celebration cakes",
      "Theme designs",
      "Cookies & tubs",
      "Brownies",
      "House parties",
      "Made-to-order trays",
    ],
    trust: [
      {
        title: "Made around your date",
        body: "We plan the bake around when you need it.",
      },
      {
        title: "Design references welcome",
        body: "Upload inspiration photos for colour, theme and finish.",
      },
      {
        title: "Delivered across Kolkata",
        body: "City delivery, plus pan-India for selected shelf-stable treats.",
      },
    ],
  },

  submitCta: "Send request",
  submittingCta: "Sending…",
  successTitle: "Thanks — we'll be in touch!",
  successBody:
    "Our team will review your request and reach out with a quote. If it's urgent, feel free to call us directly at 9330048665 / 9883186892.",
  backToHome: "Back to home",
  submitAnother: "Submit another",
  switchKind: "Wrong type? Switch enquiry",
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
      corporate: {
        label: "What do you need?",
        hint: "Items, quantities, packaging, branding — as much as you can share.",
        placeholder:
          "e.g., 40 brownie boxes for Diwali client gifting, delivered to our Salt Lake office…",
      },
      custom: {
        label: "Describe your cake or order",
        hint: "Size, flavours, theme, colours, message on cake — tell us as much as you can.",
        placeholder: "e.g., 2-tier unicorn birthday cake, roughly 2kg, pastel purple and white…",
      },
    },
    image: {
      label: "Reference image",
      hint: "Optional — upload an inspiration photo (design, colour, packaging).",
    },
    notes: {
      label: "Anything else?",
      hint: "Allergies, dietary notes, delivery instructions.",
    },
    companyName: { label: "Company name", placeholder: "Registered business name" },
    gstin: { label: "GSTIN", placeholder: "15-character GSTIN", hint: "Optional at enquiry stage." },
    headcount: {
      label: "Roughly how many people?",
      placeholder: "e.g., 40",
      hint: "Optional — helps us size the order.",
    },
    eventType: { label: "Occasion", hint: "Optional." },
  },
} as const;

/** Corporate-facing occasions. */
export const CORPORATE_EVENT_TYPES = [
  { value: "corporate-gifting", label: "Corporate gifting" },
  { value: "office-party", label: "Office party or celebration" },
  { value: "festival", label: "Festival order" },
  { value: "other", label: "Something else" },
] as const;

/** Personal / custom-order occasions. */
export const CUSTOM_EVENT_TYPES = [
  { value: "birthday", label: "Birthday" },
  { value: "wedding", label: "Wedding" },
  { value: "house-party", label: "House party or small gathering" },
  { value: "festival", label: "Festival order" },
  { value: "other", label: "Something else" },
] as const;

/** Full list — keep in sync with the server enum. */
export const QUOTE_EVENT_TYPES = [
  ...CORPORATE_EVENT_TYPES.filter((o) => o.value !== "other" && o.value !== "festival"),
  ...CUSTOM_EVENT_TYPES,
].filter(
  (option, index, all) => all.findIndex((o) => o.value === option.value) === index,
);

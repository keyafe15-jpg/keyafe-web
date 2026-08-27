export const QUOTE_COPY = {
  eyebrow: "Custom orders",
  title: "Get a Quote",
  intro:
    "Have a specific design or theme in mind? Share the details and we'll get back to you within a few hours with a quote.",
  submitCta: "Send request",
  submittingCta: "Sending…",
  successTitle: "Thanks — we'll be in touch!",
  successBody:
    "Our team will review your request and reach out within a few hours with a quote. If it's urgent, feel free to call us directly at 9330048665 / 9883186892.",
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
      hint: "Cake theme, tiers, flavours, size — tell us as much as you can.",
      placeholder:
        "e.g., 2-tier birthday cake with unicorn theme, chocolate + vanilla, roughly 2kg…",
    },
    image: {
      label: "Reference image",
      hint: "Optional — upload an inspiration photo (design, colour, tier count).",
    },
    notes: {
      label: "Anything else?",
      hint: "Allergies, dietary notes, delivery instructions.",
    },
  },
} as const;

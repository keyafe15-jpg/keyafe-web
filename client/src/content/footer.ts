export const FOOTER_COPY = {
  headline: ["Something special and unique,", "made just for you."] as const,
  cta: { to: "/get-quote", label: "Get a quote" },
  sections: {
    shop: {
      heading: "Shop",
    },
    order: {
      heading: "Order",
    },
    studio: {
      heading: "The studio",
    },
  },
  copyright: (year: number, name: string) => `© ${year} ${name}`,
  scrollTop: "Back to top",
} as const;

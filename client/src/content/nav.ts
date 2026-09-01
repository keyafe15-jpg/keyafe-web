// Highlighted / special nav items — rendered separately from category listings.
// Regular categories are fetched from /api/categories via useCategories().

// Highlighted / special nav items — rendered separately from regular categories.
export const SAMEDAY_NAV = {
  to: "/same-day",
  label: "Same Day",
} as const;

export const HEALTHY_NAV = {
  to: "/healthy",
  label: "Healthy Treats",
} as const;

export const PANINDIA_NAV = {
  to: "/pan-india",
  label: "Pan India",
} as const;

export const UTILITY_LINKS = [
  { to: "/get-quote", label: "Get a Quote" },
] as const;

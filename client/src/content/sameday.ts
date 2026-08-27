export const SAMEDAY_COPY = {
  eyebrow: "Same Day Delivery",
  title: "Ready to bake, ready to eat.",
  sub: "Order between 11 AM and 11 PM. Fresh bakes at your door in a couple of hours.",
  hoursLabel: {
    open: "Open now · delivering till 11 PM",
    closed: "Closed · opens at 11 AM",
  },
  emptyCategory: "Nothing in this category right now — check another.",
  deliveryFeeNote:
    "Delivery fee for same-day is slightly higher — depends on your pincode.",
  sidebarHeading: "Categories",
  sidebarMobileLabel: "Browse",
} as const;

// SAMEDAY_CATEGORIES removed — fetched from /api/store/same-day-categories.

// Six placeholder products per category so the grid isn't empty.
export const SAMEDAY_PLACEHOLDER_PRODUCTS = [1, 2, 3, 4, 5, 6] as const;

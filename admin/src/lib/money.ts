const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** ₹1,23,456 — whole rupees, Indian digit grouping. */
export function formatINR(value: number) {
  return inr.format(Math.round(value));
}

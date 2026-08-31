export const PRODUCT_COPY = {
  labels: {
    size: "Size",
    flavour: "Flavour",
    messageOnCake: "Message on cake",
    messageHint: (max: number) => `Up to ${max} characters, optional.`,
    specialInstructions: "Special instructions",
    specialInstructionsHint: "Anything for the kitchen or delivery partner?",
    deliveryOrPickup: "Delivery or pickup?",
    delivery: "Home delivery",
    pickup: "Store pickup",
    pincodeLabel: "Delivery pincode",
    pincodePlaceholder: "6-digit pincode",
    checkCta: "Check",
    date: "Delivery date",
    timeSlot: "Time slot",
    quantity: "Quantity",
    addToCart: "Add to cart",
    total: "Total",
    priceIncludesGst: "Inclusive of all taxes",
  },
  timeSlots: [
    {
      key: "morning",
      label: "Morning · 9 AM – 12 PM",
      surcharge: 0,
      endHour: 12,
      endMinute: 0,
    },
    {
      key: "afternoon",
      label: "Afternoon · 12 – 4 PM",
      surcharge: 0,
      endHour: 16,
      endMinute: 0,
    },
    {
      key: "evening",
      label: "Evening · 4 – 8 PM",
      surcharge: 0,
      endHour: 20,
      endMinute: 0,
    },
    {
      key: "late-evening",
      label: "Late Evening · 8 – 11 PM",
      surcharge: 30,
      endHour: 23,
      endMinute: 0,
    },
    {
      key: "midnight",
      label: "Midnight · 11 PM – 11:59 PM",
      surcharge: 200,
      endHour: 23,
      endMinute: 59,
    },
  ],
  pincode: {
    idle: "Enter your pincode to check delivery.",
    unserviceable:
      "We may still deliver here, please call or WhatsApp us to confirm, or you can opt for pickup.",
    serviceable: (city: string, fee: number) =>
      fee === 0
        ? `Great — we deliver to ${city}, free delivery.`
        : `Great — we deliver to ${city}, ₹${fee} delivery.`,
    invalid: "Please enter a valid 6-digit pincode.",
  },
} as const;

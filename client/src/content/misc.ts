export const CART_COPY = {
  empty: {
    title: "Your cart is empty",
    body: "Browse our bakes and add something sweet.",
    cta: "Continue shopping",
  },
  heading: "Your cart",
  subtotal: "Subtotal",
  proceed: "Proceed to checkout",
  remove: "Remove",
} as const;

export const CHECKOUT_COPY = {
  heading: "Checkout",
  placeholder: "Guest form, coupon + Razorpay integration coming in Phase 2.",
} as const;

export const NOT_FOUND_COPY = {
  code: "404",
  body: "This page is out of the oven.",
  backLink: "Back home",
} as const;

export const ORDER_SUCCESS_COPY = {
  title: "Order confirmed!",
  orderIdLabel: "Order ID",
} as const;

export const CATEGORY_PLACEHOLDER_COPY = {
  body: "Category listing — products & filters coming soon.",
  variantsSoon: "₹— · variants coming soon",
} as const;

export const PRODUCT_PLACEHOLDER_COPY = {
  body: "Product detail — variant selectors, message-on-cake, delivery slot, add-to-cart coming soon.",
  addToCartStub: "Add to cart (stub)",
} as const;

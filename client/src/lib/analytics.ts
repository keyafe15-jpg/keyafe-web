import type { CartLine } from "@/types/domain";
import type { Order } from "@/hooks/useOrders";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

/** Google Analytics 4 — production builds with a measurement ID only. */
export function initAnalytics() {
  if (!import.meta.env.PROD || !MEASUREMENT_ID || window.gtag) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer ?? [];
  // gtag.js only understands the `arguments` object, not a plain array.
  window.gtag = function gtag() {
    // oxlint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID);
}

export function track(event: string, params: Record<string, unknown> = {}) {
  window.gtag?.("event", event, params);
}

type GaItem = {
  item_id: string;
  item_name: string;
  item_variant?: string;
  item_category?: string;
  price: number;
  quantity: number;
};

function lineItem(line: Omit<CartLine, "id">): GaItem {
  return {
    item_id: line.productId,
    item_name: line.name,
    item_variant: line.sizeLabel || line.flavourName || undefined,
    item_category: line.categorySlug || undefined,
    price: line.unitPrice,
    quantity: line.qty,
  };
}

const value = (items: GaItem[]) => items.reduce((s, i) => s + i.price * i.quantity, 0);

export function trackViewItem(product: {
  id: string;
  name: string;
  basePrice: number | string;
  categories?: Array<{ slug: string }>;
}) {
  const price = Number(product.basePrice);
  track("view_item", {
    currency: "INR",
    value: price,
    items: [
      {
        item_id: product.id,
        item_name: product.name,
        item_category: product.categories?.[0]?.slug,
        price,
        quantity: 1,
      },
    ],
  });
}

export function trackAddToCart(line: Omit<CartLine, "id">) {
  const items = [lineItem(line)];
  track("add_to_cart", { currency: "INR", value: value(items), items });
}

export function trackBeginCheckout(lines: CartLine[]) {
  const items = lines.map(lineItem);
  track("begin_checkout", { currency: "INR", value: value(items), items });
}

const PURCHASE_KEY = "keyafe-ga-purchase:";
const PURCHASE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Sent once per order per browser, so revisiting the success page doesn't
 * double-count. Older orders opened from "My orders" are skipped.
 */
export function trackPurchase(order: Order) {
  if (!window.gtag) return;
  if (Date.now() - new Date(order.createdAt).getTime() > PURCHASE_WINDOW_MS) return;
  const key = PURCHASE_KEY + order.id;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
  } catch {
    // Private mode without storage: still record it.
  }
  track("purchase", {
    transaction_id: order.orderNumber,
    currency: "INR",
    value: Number(order.total),
    shipping: Number(order.deliveryFee),
    tax: Number(order.cgstAmount) + Number(order.sgstAmount) + Number(order.igstAmount),
    coupon: order.couponCode || undefined,
    items: order.items.map((it) => ({
      item_id: it.productId,
      item_name: it.productName,
      item_variant: it.sizeLabel || it.flavourName || undefined,
      price: Number(it.unitPrice),
      quantity: it.qty,
    })),
  });
}

export function trackContactClick(method: "whatsapp" | "phone", location: string) {
  track("contact_click", { method, location });
}

import type { Page } from "@playwright/test";

export const API = "http://127.0.0.1:4000";
export const ADMIN = "http://127.0.0.1:5175";

export const E2E_ADMIN_PHONE = "9883186892";
export const E2E_CUSTOMER_PHONE = "9876543210";
export const E2E_COUPON = "E2E10";

type PublicProduct = {
  id: string;
  slug: string;
  name: string;
  images?: string[];
  basePrice?: number | string;
  price?: number | string;
  isAvailable?: boolean;
  isActive?: boolean;
  canBeDeliveredPanIndia?: boolean;
};

export async function fetchFirstProduct(): Promise<PublicProduct> {
  const res = await fetch(`${API}/api/products/same-day`);
  if (!res.ok) throw new Error(`same-day API ${res.status}`);
  const items = (await res.json()) as PublicProduct[];
  const product = items.find((p) => p.isAvailable !== false) ?? items[0];
  if (!product) throw new Error("No same-day products in e2e DB — seed failed?");
  return product;
}

/** Tomorrow as YYYY-MM-DD in local time. */
export function tomorrowYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function seedCart(
  page: Page,
  opts: { fulfillment?: "delivery" | "pickup" } = {},
) {
  const product = await fetchFirstProduct();
  const unitPrice = Number(product.basePrice ?? product.price ?? 499);
  const fulfillment = opts.fulfillment ?? "pickup";
  const date = tomorrowYmd();

  const line = {
    id: `e2e-${Date.now()}`,
    productId: product.id,
    slug: product.slug,
    name: product.name,
    image: product.images?.[0],
    fulfillment,
    date,
    slotKey: "evening",
    slotLabel: "Evening · 4 – 8 PM",
    isPanIndia: false,
    unitPrice,
    qty: 1,
  };

  await page.addInitScript(
    ({ cartLine }) => {
      localStorage.setItem(
        "keyafe-cart",
        JSON.stringify({ state: { lines: [cartLine] }, version: 2 }),
      );
    },
    { cartLine: line },
  );

  return { product, line };
}

export async function sendOtp(phone: string) {
  const res = await fetch(`${API}/api/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  const data = (await res.json()) as { otp?: string; message?: string };
  if (!res.ok) throw new Error(data.message ?? `send-otp ${res.status}`);
  if (!data.otp) throw new Error("Expected OTP in non-production send-otp response");
  return data.otp;
}

export async function fillCheckoutCustomer(
  page: Page,
  opts: { name?: string; phone?: string; email?: string } = {},
) {
  await page.getByPlaceholder("Aarav Sharma").fill(opts.name ?? "E2E Tester");
  await page.getByPlaceholder("9330048665").first().fill(opts.phone ?? E2E_CUSTOMER_PHONE);
  if (opts.email) {
    await page.getByPlaceholder("you@example.com").fill(opts.email);
  }
}

export async function fillDeliveryAddress(page: Page) {
  await page.getByPlaceholder("711202").first().fill("711202");
  await page.getByPlaceholder("Flat / building / street").first().fill("12 Belur Math Road");

  const mapQuery = "Belur Math Howrah";
  const places = page.locator("gmp-place-autocomplete");
  const fallback = page.getByPlaceholder(/Start typing your building|Search unavailable|type a place/i);

  // Wait briefly for Places widget or the text fallback — never .fill() the custom element.
  await Promise.race([
    places.first().waitFor({ state: "attached", timeout: 8_000 }),
    fallback.waitFor({ state: "visible", timeout: 8_000 }),
  ]).catch(() => undefined);

  if (await places.count()) {
    await places.first().evaluate((el, value) => {
      const node = el as HTMLElement & { value: string };
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
    }, mapQuery);
  } else {
    await fallback.fill(mapQuery);
  }
}

/** Click Send OTP in the UI and return the OTP from that response body. */
export async function sendOtpViaUi(page: Page, sendButtonName: RegExp | string = /Send OTP/i) {
  const otpResponse = page.waitForResponse(
    (r) => r.url().includes("/api/auth/send-otp") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: sendButtonName }).click();
  const res = await otpResponse;
  const body = (await res.json()) as { otp?: string; error?: string; message?: string };
  if (!res.ok) {
    throw new Error(body.error ?? body.message ?? `send-otp ${res.status}`);
  }
  if (!body.otp) {
    throw new Error("Expected OTP in non-production send-otp response");
  }
  return body.otp;
}

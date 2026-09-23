import { expect, test } from "@playwright/test";
import {
  E2E_COUPON,
  E2E_CUSTOMER_PHONE,
  fillCheckoutCustomer,
  fillDeliveryAddress,
  seedCart,
  sendOtpViaUi,
} from "../helpers";

test.describe("storefront checkout smokes", () => {
  test("guest COD pickup checkout reaches success", async ({ page }) => {
    await seedCart(page, { fulfillment: "pickup" });
    await page.goto("/checkout");

    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
    await page.getByRole("button", { name: /Store pickup/i }).click();
    await fillCheckoutCustomer(page);

    await page.getByRole("button", { name: /Place order/i }).click();
    await expect(page).toHaveURL(/\/order\/.+\/success/, { timeout: 30_000 });
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("checkout applies E2E10 coupon", async ({ page }) => {
    await seedCart(page, { fulfillment: "pickup" });
    await page.goto("/checkout");
    await page.getByRole("button", { name: /Store pickup/i }).click();
    await fillCheckoutCustomer(page, { phone: "9876501111" });

    await page.getByRole("button", { name: /Have a promo code/i }).click();
    await page.getByPlaceholder("Enter code").fill(E2E_COUPON);
    await page.getByRole("button", { name: /^Apply$/i }).click();

    await expect(page.getByText(/E2E10/i).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /Place order/i }).click();
    await expect(page).toHaveURL(/\/order\/.+\/success/, { timeout: 30_000 });
  });

  test("delivery surprise gift fields submit", async ({ page }) => {
    await seedCart(page, { fulfillment: "delivery" });
    await page.goto("/checkout");

    await page.getByRole("button", { name: /Home delivery/i }).click();
    await fillCheckoutCustomer(page, { phone: "9876501234" });
    await fillDeliveryAddress(page);

    await page.locator("label").filter({ hasText: "Surprise gift" }).locator("input").check();

    await page.getByRole("button", { name: /Place order/i }).click();
    await expect(page).toHaveURL(/\/order\/.+\/success/, { timeout: 30_000 });
  });
});

test.describe("auth OTP smoke", () => {
  test("customer can complete OTP login", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Log in" }).first().click();
    await expect(page.getByRole("heading", { name: /Continue with OTP/i })).toBeVisible();

    await page.getByPlaceholder("Phone number").fill(E2E_CUSTOMER_PHONE);
    const otp = await sendOtpViaUi(page);

    await page.getByPlaceholder("123456").fill(otp);
    await page.getByRole("button", { name: /^Verify OTP$/i }).click();

    const nameField = page.getByPlaceholder("Your name");
    if (await nameField.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await nameField.fill("E2E Customer");
      await page.getByRole("button", { name: /Create account/i }).click();
    }

    await expect(page.getByRole("button", { name: "Log in" })).toHaveCount(0, {
      timeout: 25_000,
    });
  });
});
